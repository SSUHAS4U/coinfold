"""Coin balance and redemption.

The redeem path is the only write in this app, and it is the one place where
getting concurrency wrong costs a user real value. It therefore:

  * takes a row lock on the user before reading the balance, so two redeems
    submitted at the same moment serialise instead of both seeing the old
    balance and both succeeding,
  * re-reads the balance from the ledger inside the transaction rather than
    trusting anything the client sent,
  * decrements stock conditionally, so the last unit cannot be sold twice,
  * writes the redemption and the ledger debit in the same transaction, so a
    crash between them is impossible,
  * is idempotent on a client-supplied key, so a retry after a dropped response
    returns the original redemption instead of charging twice.

It fails closed: any doubt and no coins move.
"""

from __future__ import annotations

import secrets
from typing import Any

import psycopg

from coinfold.core.errors import AppFault

# Unambiguous alphabet: no O/0, no I/1, so a code read aloud or off a screen
# cannot be mistyped.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _voucher_code() -> str:
    body = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(12))
    return f"{body[:4]}-{body[4:8]}-{body[8:]}"


def get_balance(conn: psycopg.Connection, *, user_id: str) -> dict[str, Any]:
    row = conn.execute(
        "SELECT balance, lifetime_earned, lifetime_spent FROM coin_balance "
        "WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    return row or {"balance": 0, "lifetime_earned": 0, "lifetime_spent": 0}


def list_rewards(conn: psycopg.Connection, *, user_id: str) -> list[dict[str, Any]]:
    """The catalogue, annotated with whether this user can afford each item.

    `affordable` is computed server-side so the button's disabled state and the
    endpoint's validation can never disagree about the same balance.
    """
    balance = get_balance(conn, user_id=user_id)["balance"]
    rows = conn.execute(
        """
        SELECT id, slug, title, description, coin_cost, rupee_value, stock
        FROM reward WHERE is_active ORDER BY sort_order, coin_cost
        """
    ).fetchall()

    for row in rows:
        row["affordable"] = balance >= row["coin_cost"]
        row["coins_short"] = max(0, row["coin_cost"] - balance)
        row["in_stock"] = row["stock"] is None or row["stock"] > 0
    return rows


def list_redemptions(
    conn: psycopg.Connection, *, user_id: str, limit: int = 20
) -> list[dict[str, Any]]:
    return conn.execute(
        """
        SELECT r.id, r.coin_cost, r.status, r.voucher_code, r.created_at,
               w.title, w.slug, w.rupee_value
        FROM redemption r JOIN reward w ON w.id = r.reward_id
        WHERE r.user_id = %s ORDER BY r.created_at DESC, r.id DESC LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()


def redeem(
    conn: psycopg.Connection,
    *,
    user_id: str,
    reward_id: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Spend coins on a reward. Atomic, idempotent, and validated server-side.

    The caller runs this inside a transaction and commits only on success.
    """
    # --- Idempotency, before anything is locked or spent -------------------
    existing = conn.execute(
        """
        SELECT r.id, r.reward_id, r.coin_cost, r.status, r.voucher_code,
               r.created_at, w.title, w.slug, w.rupee_value
        FROM redemption r JOIN reward w ON w.id = r.reward_id
        WHERE r.user_id = %s AND r.idempotency_key = %s
        """,
        (user_id, idempotency_key),
    ).fetchone()

    if existing is not None:
        # Same key, same reward: this is a retry. Return the original result so
        # the client sees success without a second charge. The balance is the
        # *current* one, not the one at the time of the original redeem: the
        # client uses this response to paint the balance, so returning a stale
        # figure would make a retry visibly roll the number backwards.
        if existing["reward_id"] == reward_id:
            return {
                **existing,
                "balance": int(get_balance(conn, user_id=user_id)["balance"]),
                "replayed": True,
            }
        # Same key, different reward: the client has a bug. Refuse rather than
        # returning a redemption for something it did not ask for.
        raise AppFault(
            "REWARD_IDEMPOTENCY_CONFLICT",
            requested_reward=reward_id,
            original_reward=existing["reward_id"],
        )

    # --- Serialise concurrent redeems for this user ------------------------
    # Lock the user row first. Every redeem for this user takes the same lock,
    # so two simultaneous requests cannot both read a balance of 900 and both
    # spend it. Locking the user (not the ledger) also fixes the lock order,
    # which is what keeps this free of deadlocks.
    locked = conn.execute(
        "SELECT id FROM app_user WHERE id = %s FOR UPDATE", (user_id,)
    ).fetchone()
    if locked is None:
        raise AppFault("AUTH_TOKEN_INVALID", reason="user no longer exists")

    reward = conn.execute(
        "SELECT id, slug, title, coin_cost, rupee_value, stock FROM reward "
        "WHERE id = %s AND is_active",
        (reward_id,),
    ).fetchone()
    if reward is None:
        raise AppFault("REWARD_NOT_FOUND", reward_id=reward_id)

    # Balance is summed now, under the lock, from the ledger itself. Nothing the
    # client sent about its balance is consulted.
    balance = conn.execute(
        "SELECT COALESCE(sum(delta), 0) AS balance FROM coin_ledger WHERE user_id = %s",
        (user_id,),
    ).fetchone()["balance"]

    if balance < reward["coin_cost"]:
        raise AppFault(
            "REWARD_INSUFFICIENT_COINS",
            balance=int(balance),
            required=int(reward["coin_cost"]),
            short_by=int(reward["coin_cost"] - balance),
        )

    # --- Stock ------------------------------------------------------------
    # Conditional decrement: the WHERE clause is the check, so the last unit
    # cannot be sold twice even if two redeems arrive together. A separate
    # read-then-write would leave exactly that gap.
    if reward["stock"] is not None:
        claimed = conn.execute(
            "UPDATE reward SET stock = stock - 1 WHERE id = %s AND stock > 0 "
            "RETURNING stock",
            (reward_id,),
        ).fetchone()
        if claimed is None:
            raise AppFault("REWARD_OUT_OF_STOCK", reward_id=reward_id)

    # --- Write the redemption and its ledger entry together ----------------
    redemption = conn.execute(
        """
        INSERT INTO redemption (user_id, reward_id, coin_cost, idempotency_key,
                                voucher_code)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, coin_cost, status, voucher_code, created_at
        """,
        (user_id, reward_id, reward["coin_cost"], idempotency_key, _voucher_code()),
    ).fetchone()

    conn.execute(
        "INSERT INTO coin_ledger (user_id, delta, reason, redemption_id) "
        "VALUES (%s, %s, 'REDEEM', %s)",
        (user_id, -reward["coin_cost"], redemption["id"]),
    )

    new_balance = conn.execute(
        "SELECT COALESCE(sum(delta), 0) AS balance FROM coin_ledger WHERE user_id = %s",
        (user_id,),
    ).fetchone()["balance"]

    # A negative balance means the guard above was wrong. Raise rather than
    # commit: an unexplainable balance is worse than a failed redeem.
    if new_balance < 0:
        raise AppFault(
            "REWARD_INSUFFICIENT_COINS",
            balance=int(new_balance),
            required=int(reward["coin_cost"]),
            short_by=int(-new_balance),
        )

    return {
        **redemption,
        "title": reward["title"],
        "slug": reward["slug"],
        "rupee_value": reward["rupee_value"],
        "balance": int(new_balance),
        "replayed": False,
    }
