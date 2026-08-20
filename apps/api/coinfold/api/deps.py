"""Shared route dependencies: settings, database handles, and the current user."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import Annotated

import psycopg
from fastapi import Depends, Header, Query

from coinfold.core.config import Settings, get_settings
from coinfold.core.errors import AppFault
from coinfold.core.security import decode_token
from coinfold.db import pool
from coinfold.db.transactions import TransactionFilters

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_conn() -> Iterator[psycopg.Connection]:
    with pool.connection() as conn:
        yield conn


ConnDep = Annotated[psycopg.Connection, Depends(get_conn)]


def current_user_id(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Resolve the caller from a bearer token, or raise a registered fault."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppFault("AUTH_TOKEN_INVALID", reason="missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    return decode_token(
        token,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expect="access",
    )


UserIdDep = Annotated[str, Depends(current_user_id)]


def _csv(value: str | None) -> list[str]:
    """Parse a repeated-value query parameter given as a comma-separated list."""
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def transaction_filters(
    search: Annotated[str | None, Query(max_length=120)] = None,
    categories: Annotated[str | None, Query(max_length=400)] = None,
    statuses: Annotated[str | None, Query(max_length=100)] = None,
    methods: Annotated[str | None, Query(max_length=100)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    include_anomalous: bool = True,
) -> TransactionFilters:
    """Build filters from the query string.

    The table and both charts take this same dependency, so they are guaranteed
    to be looking at the same slice of data — which is what makes the
    cross-filtering between them trustworthy.
    """
    return TransactionFilters(
        search=search,
        categories=_csv(categories),
        statuses=[s.upper() for s in _csv(statuses)],
        methods=[m.upper() for m in _csv(methods)],
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        include_anomalous=include_anomalous,
    )


FiltersDep = Annotated[TransactionFilters, Depends(transaction_filters)]


def page_params(
    settings: SettingsDep,
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
    page_size: Annotated[int, Query(ge=1)] = 50,
) -> tuple[int, int]:
    if page_size > settings.max_page_size:
        raise AppFault(
            "QUERY_PAGE_TOO_LARGE", requested=page_size, maximum=settings.max_page_size
        )
    return page, page_size


PageDep = Annotated[tuple[int, int], Depends(page_params)]
