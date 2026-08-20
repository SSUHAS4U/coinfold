"""User lookup and creation."""

from __future__ import annotations

from typing import Any

import psycopg

from coinfold.core.errors import AppFault


def find_by_email(conn: psycopg.Connection, email: str) -> dict[str, Any] | None:
    return conn.execute(
        "SELECT id, email, display_name, password_hash FROM app_user WHERE email = %s",
        (email,),
    ).fetchone()


def find_by_id(conn: psycopg.Connection, user_id: str) -> dict[str, Any] | None:
    return conn.execute(
        "SELECT id, email, display_name, created_at, last_login_at "
        "FROM app_user WHERE id = %s",
        (user_id,),
    ).fetchone()


def create(
    conn: psycopg.Connection, *, email: str, display_name: str, password_hash: str
) -> dict[str, Any]:
    try:
        return conn.execute(
            "INSERT INTO app_user (email, display_name, password_hash) "
            "VALUES (%s, %s, %s) RETURNING id, email, display_name, created_at",
            (email, display_name, password_hash),
        ).fetchone()
    except psycopg.errors.UniqueViolation as exc:
        # Let the database decide uniqueness. A read-then-insert would leave a
        # window where two concurrent signups both see the email as free.
        raise AppFault("AUTH_EMAIL_TAKEN") from exc


def touch_login(conn: psycopg.Connection, user_id: str) -> None:
    conn.execute("UPDATE app_user SET last_login_at = now() WHERE id = %s", (user_id,))


def update_password_hash(
    conn: psycopg.Connection, *, user_id: str, password_hash: str
) -> None:
    conn.execute(
        "UPDATE app_user SET password_hash = %s WHERE id = %s", (password_hash, user_id)
    )


def copy_seed_data_to(conn: psycopg.Connection, *, target_user_id: str) -> int:
    """Give a newly registered account its own copy of the sample data.

    The brief's dataset belongs to one demo user. Rather than showing a new
    account an empty dashboard (which demonstrates nothing) or letting every
    account read the same rows (which would be a data leak in a real product),
    each signup gets its own copy, and its own ledger derived from it.
    """
    seed_user = conn.execute(
        "SELECT id FROM app_user WHERE email = 'demo@coinfold.app'"
    ).fetchone()
    if seed_user is None or str(seed_user["id"]) == str(target_user_id):
        return 0

    conn.execute(
        """
        INSERT INTO transaction (user_id, source_id, source_row_index, occurred_at,
                                 merchant_id, category_id, amount, currency, status,
                                 method, is_anomalous, coins_earned)
        SELECT %s, source_id, source_row_index, occurred_at, merchant_id,
               category_id, amount, currency, status, method, is_anomalous,
               coins_earned
        FROM transaction WHERE user_id = %s
        """,
        (target_user_id, seed_user["id"]),
    )
    result = conn.execute(
        "INSERT INTO coin_ledger (user_id, delta, reason, transaction_id) "
        "SELECT user_id, coins_earned, 'EARN', id FROM transaction "
        "WHERE user_id = %s AND coins_earned > 0",
        (target_user_id,),
    )
    return result.rowcount
