"""HTTP routes.

Routes stay thin: they validate, delegate to the db layer, and shape a response.
Business rules live in coinfold/db/*, so they can be tested without HTTP.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Path, status

from coinfold.api import schemas
from coinfold.api.deps import ConnDep, FiltersDep, PageDep, SettingsDep, UserIdDep
from coinfold.core.errors import AppFault
from coinfold.core.logging import log_event
from coinfold.core.security import (
    create_token,
    decode_token,
    hash_password,
    verify_dummy_password,
    verify_password,
)
from coinfold.db import rewards as rewards_db
from coinfold.db import transactions as tx_db
from coinfold.db import users as users_db

health_router = APIRouter(tags=["health"])
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
tx_router = APIRouter(prefix="/api/transactions", tags=["transactions"])
analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])
rewards_router = APIRouter(prefix="/api/rewards", tags=["rewards"])


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@health_router.get("/health")
def health() -> dict[str, str]:
    """Dependency-free liveness probe.

    Deliberately does NOT touch the database. This is the endpoint the
    keep-warm workflow pings every 10 minutes; if it opened a connection, the
    keep-warm cron would also be a permanent load on a free-tier database.
    """
    return {"status": "ok"}


@health_router.get("/health/ready")
def readiness(conn: ConnDep) -> dict[str, str]:
    """Readiness probe. This one does check the database, on purpose."""
    conn.execute("SELECT 1")
    return {"status": "ready", "database": "reachable"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def _issue(settings: SettingsDep, user_id: str) -> schemas.TokenPair:
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    return schemas.TokenPair(
        access_token=create_token(
            user_id=user_id,
            secret=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
            kind="access",
            ttl=ttl,
        ),
        refresh_token=create_token(
            user_id=user_id,
            secret=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
            kind="refresh",
            ttl=timedelta(days=settings.refresh_token_ttl_days),
        ),
        expires_in=int(ttl.total_seconds()),
    )


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    body: schemas.RegisterRequest, conn: ConnDep, settings: SettingsDep
) -> schemas.AuthResponse:
    user = users_db.create(
        conn,
        email=str(body.email).lower(),
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    copied = users_db.copy_seed_data_to(conn, target_user_id=user["id"])
    conn.commit()

    log_event(logging.INFO, "user registered", user_id=str(user["id"]), seeded_rows=copied)
    return schemas.AuthResponse(
        user=schemas.UserOut(
            id=str(user["id"]), email=user["email"], display_name=user["display_name"]
        ),
        tokens=_issue(settings, str(user["id"])),
    )


@auth_router.post("/login")
def login(
    body: schemas.LoginRequest, conn: ConnDep, settings: SettingsDep
) -> schemas.AuthResponse:
    user = users_db.find_by_email(conn, str(body.email).lower())

    if user is None:
        # Spend the same time as a real verify before failing, so response
        # latency does not reveal whether the email exists.
        verify_dummy_password(body.password)
        raise AppFault("AUTH_INVALID_CREDENTIALS")

    ok, rehashed = verify_password(body.password, user["password_hash"])
    if not ok:
        raise AppFault("AUTH_INVALID_CREDENTIALS")

    if rehashed:
        users_db.update_password_hash(conn, user_id=user["id"], password_hash=rehashed)
    users_db.touch_login(conn, user["id"])
    conn.commit()

    log_event(logging.INFO, "user signed in", user_id=str(user["id"]))
    return schemas.AuthResponse(
        user=schemas.UserOut(
            id=str(user["id"]), email=user["email"], display_name=user["display_name"]
        ),
        tokens=_issue(settings, str(user["id"])),
    )


@auth_router.post("/refresh")
def refresh(body: schemas.RefreshRequest, settings: SettingsDep) -> schemas.TokenPair:
    user_id = decode_token(
        body.refresh_token,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expect="refresh",
    )
    return _issue(settings, user_id)


@auth_router.get("/me")
def me(user_id: UserIdDep, conn: ConnDep) -> schemas.UserOut:
    user = users_db.find_by_id(conn, user_id)
    if user is None:
        raise AppFault("AUTH_TOKEN_INVALID", reason="user no longer exists")
    return schemas.UserOut(
        id=str(user["id"]), email=user["email"], display_name=user["display_name"]
    )


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------


@tx_router.get("")
def list_transactions(
    user_id: UserIdDep,
    conn: ConnDep,
    filters: FiltersDep,
    paging: PageDep,
    sort_by: str = "date",
    direction: str = "desc",
) -> schemas.PageOut:
    page, page_size = paging
    result = tx_db.list_transactions(
        conn,
        user_id=user_id,
        filters=filters,
        sort_by=sort_by,
        direction=direction,
        page=page,
        page_size=page_size,
    )
    return schemas.PageOut(**result)


@tx_router.get("/facets")
def facets(user_id: UserIdDep, conn: ConnDep) -> schemas.FacetsOut:
    return schemas.FacetsOut(**tx_db.facets(conn, user_id=user_id))


@tx_router.get("/summary")
def summary(user_id: UserIdDep, conn: ConnDep, filters: FiltersDep) -> schemas.SummaryOut:
    return schemas.SummaryOut(**tx_db.summary(conn, user_id=user_id, filters=filters))


@tx_router.get("/{transaction_id}")
def get_transaction(
    user_id: UserIdDep,
    conn: ConnDep,
    transaction_id: Annotated[int, Path(ge=1)],
) -> schemas.TransactionDetailOut:
    row = tx_db.get_transaction(conn, user_id=user_id, transaction_id=transaction_id)
    if row is None:
        raise AppFault("TRANSACTION_NOT_FOUND", transaction_id=transaction_id)
    return schemas.TransactionDetailOut(**row)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@analytics_router.get("/by-category")
def by_category(
    user_id: UserIdDep, conn: ConnDep, filters: FiltersDep
) -> list[schemas.CategorySpendOut]:
    rows = tx_db.spend_by_category(conn, user_id=user_id, filters=filters)
    return [schemas.CategorySpendOut(**r) for r in rows]


@analytics_router.get("/monthly")
def monthly(
    user_id: UserIdDep, conn: ConnDep, filters: FiltersDep
) -> list[schemas.MonthlyPointOut]:
    rows = tx_db.monthly_trend(conn, user_id=user_id, filters=filters)
    return [schemas.MonthlyPointOut(**r) for r in rows]


# ---------------------------------------------------------------------------
# Rewards
# ---------------------------------------------------------------------------


@rewards_router.get("/balance")
def balance(user_id: UserIdDep, conn: ConnDep) -> schemas.BalanceOut:
    return schemas.BalanceOut(**rewards_db.get_balance(conn, user_id=user_id))


@rewards_router.get("/catalogue")
def catalogue(user_id: UserIdDep, conn: ConnDep) -> list[schemas.RewardOut]:
    rows = rewards_db.list_rewards(conn, user_id=user_id)
    return [schemas.RewardOut(**r) for r in rows]


@rewards_router.get("/redemptions")
def redemptions(
    user_id: UserIdDep, conn: ConnDep
) -> list[schemas.RedemptionHistoryOut]:
    rows = rewards_db.list_redemptions(conn, user_id=user_id)
    return [schemas.RedemptionHistoryOut(**r) for r in rows]


@rewards_router.post("/redeem")
def redeem(
    body: schemas.RedeemRequest, user_id: UserIdDep, conn: ConnDep
) -> schemas.RedemptionOut:
    """Spend coins on a reward.

    Commits only on success. Any fault raised inside leaves the transaction
    uncommitted, so a rejected redeem cannot have moved coins or stock — the
    rollback is the connection's, not something this handler has to remember.
    """
    result = rewards_db.redeem(
        conn,
        user_id=user_id,
        reward_id=body.reward_id,
        idempotency_key=body.idempotency_key,
    )
    conn.commit()

    log_event(
        logging.INFO,
        "reward redeemed",
        user_id=user_id,
        reward_id=body.reward_id,
        replayed=result["replayed"],
        balance=result["balance"],
    )
    return schemas.RedemptionOut(**result)
