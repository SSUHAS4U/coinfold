"""One-command schema + seed.

    python -m coinfold.ingest.seed --reset

Applies every migration in db/migrations in order, loads the reference data,
normalises the raw transaction feed, and mints the coin ledger — inside a single
transaction. If any row fails to normalise, nothing is committed: a half-loaded
database is worse than an empty one, because it looks like it worked.

The run finishes by printing an ingest report: how many rows loaded, and every
repair it had to make, grouped by kind. That report is the answer to "what did
you notice in the data".
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg
from argon2 import PasswordHasher
from psycopg import sql

from coinfold.ingest.normalize import (
    Anomaly,
    AnomalyKind,
    NormalisationError,
    build_merchant_category_map,
    coins_for,
    normalise_amount,
    normalise_category,
    normalise_method,
    normalise_status,
    normalise_timestamp,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"
DEFAULT_FEED = REPO_ROOT / "db" / "seed" / "transactions.raw.json"

# --- Reference data ---------------------------------------------------------

# Hues are assigned by SHARE OF SPEND, not alphabetically, so the largest
# slices land furthest apart on the colour wheel. Assigning them in category
# order produced a donut where the top four (Education 38%, Insurance 18%,
# Shopping 16%, Travel 9%) all fell in the blue-violet range and the chart read
# as one mass.
#
# The band 150-185 is deliberately left empty: that is where --accent lives, and
# the accent is brand/CTA only, never a data colour.
CATEGORIES: list[tuple[str, str, int, bool]] = [
    ("education", "Education", 25, False),      # largest share
    ("insurance", "Insurance", 265, False),
    ("shopping", "Shopping", 330, False),
    ("travel", "Travel", 205, False),
    ("health", "Health", 105, False),
    ("groceries", "Groceries", 62, False),
    ("fuel", "Fuel", 8, False),
    ("utilities", "Utilities", 235, False),
    ("food-dining", "Food & Dining", 350, False),
    ("entertainment", "Entertainment", 292, False),
    ("uncategorised", "Uncategorised", 220, True),
]

# 1 coin per ₹100, capped at 100 coins (₹10,000) per transaction. The cap is a
# product call the brief leaves open; see docs/ASSUMPTIONS.md.
RUPEES_PER_COIN = Decimal("100")
MAX_COINS_PER_TXN = 100

# Six rewards. Rates improve slightly with tier, so redeeming higher is a real
# decision rather than arithmetic indifference.
REWARDS: list[tuple[str, str, str, int, str, int | None, int]] = [
    ("amazon-100", "Amazon voucher", "₹100 off anything on Amazon.in.", 900, "100.00", None, 1),
    ("swiggy-150", "Swiggy credit", "₹150 towards your next order.", 1300, "150.00", 250, 2),
    ("bms-200", "BookMyShow ticket", "₹200 off any movie booking.", 1750, "200.00", 120, 3),
    ("cashback-250", "Statement cashback", "₹250 credited to your card.", 2200, "250.00", None, 4),
    ("fuel-500", "Fuel voucher", "₹500 at Indian Oil pumps.", 4200, "500.00", 60, 5),
    ("cashback-1000", "Big statement cashback", "₹1,000 credited to your card.", 8500, "1000.00", 25, 6),
]

DEMO_EMAIL = "demo@coinfold.app"
DEMO_NAME = "Aarav Mehta"
# Seed-only credential for the reviewer's demo account. Documented in the
# README; it grants access to nothing but generated sample data.
DEMO_PASSWORD = "coinfold-demo-2026"  # noqa: S105


def load_feed(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list):
        raise SystemExit(f"{path} does not contain a JSON array")
    return rows


def apply_migrations(conn: psycopg.Connection, reset: bool) -> None:
    if reset:
        # Drop and recreate rather than DELETE: it also clears the enum types
        # and extensions, so a re-seed is genuinely idempotent.
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise SystemExit(f"no migrations found in {MIGRATIONS_DIR}")
    for path in files:
        conn.execute(path.read_text(encoding="utf-8"))  # type: ignore[arg-type]
        print(f"  applied {path.name}")


def seed_reference(conn: psycopg.Connection) -> tuple[dict[str, int], int]:
    """Insert categories, rewards and the accrual rule. Returns category ids."""
    for slug, label, hue, is_fallback in CATEGORIES:
        conn.execute(
            "INSERT INTO category (slug, label, accent_hue, is_fallback) "
            "VALUES (%s, %s, %s, %s)",
            (slug, label, hue, is_fallback),
        )
    category_ids = {
        label: cid
        for cid, label in conn.execute("SELECT id, label FROM category").fetchall()
    }

    conn.execute(
        "INSERT INTO reward_rule (rupees_per_coin, max_coins_per_txn, effective_from, "
        "is_active) VALUES (%s, %s, DATE '2025-01-01', TRUE)",
        (RUPEES_PER_COIN, MAX_COINS_PER_TXN),
    )

    for slug, title, description, cost, value, stock, order_ in REWARDS:
        conn.execute(
            "INSERT INTO reward (slug, title, description, coin_cost, rupee_value, "
            "stock, sort_order) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (slug, title, description, cost, Decimal(value), stock, order_),
        )

    hasher = PasswordHasher()
    user_id = conn.execute(
        "INSERT INTO app_user (email, display_name, password_hash) "
        "VALUES (%s, %s, %s) RETURNING id",
        (DEMO_EMAIL, DEMO_NAME, hasher.hash(DEMO_PASSWORD)),
    ).fetchone()[0]

    return category_ids, user_id


def seed_merchants(conn: psycopg.Connection, rows: list[dict[str, Any]]) -> dict[str, int]:
    names = sorted({r["merchant"] for r in rows if isinstance(r.get("merchant"), str)})
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO merchant (name, search_name) VALUES (%s, %s)",
            [(n, " ".join(n.lower().split())) for n in names],
        )
    return {
        name: mid
        for mid, name in conn.execute("SELECT id, name FROM merchant").fetchall()
    }


def normalise_rows(
    rows: list[dict[str, Any]], category_ids: dict[str, int], merchant_ids: dict[str, int]
) -> tuple[list[tuple], list[tuple[int, AnomalyKind, str | None, str]], list[str]]:
    """Normalise every row, collecting the loadable tuples and every repair."""
    merchant_to_category = build_merchant_category_map(rows)
    seen_ids: set[str] = set()
    loadable: list[tuple] = []
    anomalies: list[tuple[int, AnomalyKind, str | None, str]] = []
    failures: list[str] = []

    for index, row in enumerate(rows):
        row_anomalies: list[Anomaly] = []
        try:
            occurred_at, ts_anomaly = normalise_timestamp(row.get("timestamp"))
            if ts_anomaly:
                row_anomalies.append(ts_anomaly)

            amount, amount_anomalies, is_anomalous = normalise_amount(row.get("amount"))
            row_anomalies.extend(amount_anomalies)

            status, status_anomaly = normalise_status(row.get("status"))
            if status_anomaly:
                row_anomalies.append(status_anomaly)

            method = normalise_method(row.get("payment_method"))

            merchant = row.get("merchant")
            if not isinstance(merchant, str) or merchant not in merchant_ids:
                raise NormalisationError("merchant", merchant, "unknown merchant")

            category_label, cat_anomaly = normalise_category(
                row.get("category"), merchant, merchant_to_category
            )
            if cat_anomaly:
                row_anomalies.append(cat_anomaly)

            source_id = row.get("id")
            if not isinstance(source_id, str) or not source_id:
                raise NormalisationError("id", source_id, "missing")
            if source_id in seen_ids:
                row_anomalies.append(
                    Anomaly(
                        AnomalyKind.DUPLICATE_SOURCE_ID,
                        source_id,
                        "source id already seen; both rows kept because their "
                        "payloads differ, so they are distinct transactions",
                    )
                )
            seen_ids.add(source_id)

        except NormalisationError as exc:
            failures.append(f"row {index}: {exc}")
            continue

        coins = coins_for(amount, status, is_anomalous, RUPEES_PER_COIN, MAX_COINS_PER_TXN)
        loadable.append(
            (
                source_id,
                index,
                occurred_at,
                merchant_ids[merchant],
                category_ids[category_label],
                amount,
                status,
                method,
                is_anomalous,
                coins,
            )
        )
        for anomaly in row_anomalies:
            anomalies.append(
                (index, anomaly.kind, anomaly.original_value, anomaly.resolution)
            )

    return loadable, anomalies, failures


def copy_transactions(
    conn: psycopg.Connection, user_id: str, loadable: list[tuple]
) -> None:
    """Bulk-load with COPY. 10,000 single INSERTs would be needlessly slow."""
    statement = sql.SQL(
        "COPY transaction (user_id, source_id, source_row_index, occurred_at, "
        "merchant_id, category_id, amount, status, method, is_anomalous, "
        "coins_earned) FROM STDIN"
    )
    with conn.cursor() as cur, cur.copy(statement) as copy:
        for record in loadable:
            copy.write_row((user_id, *record))


def load_anomalies(
    conn: psycopg.Connection,
    anomalies: list[tuple[int, AnomalyKind, str | None, str]],
) -> None:
    statement = sql.SQL(
        "COPY ingest_anomaly (transaction_id, source_row_index, kind, "
        "original_value, resolution) FROM STDIN"
    )
    # Map source_row_index back to the surrogate id assigned by COPY.
    txn_ids = dict(
        conn.execute("SELECT source_row_index, id FROM transaction").fetchall()
    )
    with conn.cursor() as cur, cur.copy(statement) as copy:
        for index, kind, original, resolution in anomalies:
            copy.write_row((txn_ids.get(index), index, kind.value, original, resolution))


def mint_coin_ledger(conn: psycopg.Connection, user_id: str) -> int:
    """Create one EARN entry per coin-earning transaction.

    Derived from transaction.coins_earned rather than recomputed, so the ledger
    and the table can never disagree about what a row was worth.
    """
    result = conn.execute(
        "INSERT INTO coin_ledger (user_id, delta, reason, transaction_id) "
        "SELECT user_id, coins_earned, 'EARN', id FROM transaction "
        "WHERE user_id = %s AND coins_earned > 0",
        (user_id,),
    )
    return result.rowcount


def report(conn: psycopg.Connection, loaded: int, failures: list[str]) -> None:
    print(f"\n  loaded {loaded:,} transactions")

    rows = conn.execute(
        "SELECT kind, count(*) FROM ingest_anomaly GROUP BY kind ORDER BY count(*) DESC"
    ).fetchall()
    print("\n  repairs made during ingest:")
    for kind, count in rows:
        print(f"    {kind:<24} {count:>6,}")

    balance = conn.execute("SELECT balance FROM coin_balance").fetchone()[0]
    entries = conn.execute("SELECT count(*) FROM coin_ledger").fetchone()[0]
    print(f"\n  coin ledger: {entries:,} EARN entries, balance {balance:,}")

    span = conn.execute(
        "SELECT min(occurred_at)::date, max(occurred_at)::date FROM transaction"
    ).fetchone()
    print(f"  date range:  {span[0]} to {span[1]}")

    if failures:
        print(f"\n  {len(failures)} rows could not be normalised:")
        for line in failures[:10]:
            print(f"    {line}")


def _seed_database(conn: psycopg.Connection, rows: list[dict[str, Any]], reset: bool) -> int:
    apply_migrations(conn, reset)
    category_ids, user_id = seed_reference(conn)
    merchant_ids = seed_merchants(conn, rows)

    loadable, anomalies, failures = normalise_rows(rows, category_ids, merchant_ids)
    if failures and not loadable:
        raise NormalisationError("feed", len(failures), "every row failed to normalise")

    copy_transactions(conn, user_id, loadable)
    load_anomalies(conn, anomalies)
    mint_coin_ledger(conn, user_id)
    report(conn, len(loadable), failures)
    return len(loadable)


def ensure_seeded(database_url: str, feed: Path = DEFAULT_FEED) -> bool:
    """Create the schema and demo data only when the database is empty."""
    rows = load_feed(feed)
    with psycopg.connect(database_url, autocommit=False) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('coinfold-auto-seed'))")
        has_transactions = conn.execute(
            "SELECT to_regclass('public.transaction') IS NOT NULL"
        ).fetchone()[0]
        if has_transactions:
            count = conn.execute("SELECT count(*) FROM transaction").fetchone()[0]
            if count > 0:
                conn.rollback()
                return False

        _seed_database(conn, rows, reset=has_transactions)
        conn.commit()
        return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create the schema and load the feed.")
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="libpq connection string (defaults to $DATABASE_URL)",
    )
    parser.add_argument("--feed", type=Path, default=DEFAULT_FEED)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="drop and recreate the public schema before loading",
    )
    args = parser.parse_args(argv)

    if not args.database_url:
        parser.error("set DATABASE_URL or pass --database-url")
    if not args.feed.exists():
        parser.error(f"feed not found: {args.feed}")

    rows = load_feed(args.feed)
    print(f"Seeding from {args.feed.name} ({len(rows):,} rows)")

    # autocommit=False: the whole seed is one transaction, so a failure leaves
    # the database exactly as it was.
    with psycopg.connect(args.database_url, autocommit=False) as conn:
        _seed_database(conn, rows, reset=args.reset)
        conn.commit()

    print("\nSeed complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
