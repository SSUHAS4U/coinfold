"""Transaction reads: filtering, sorting, pagination and analytics.

All of it happens in Postgres, not in the browser. The client never receives
10,000 rows; it receives the 50 it is showing plus a total count.

Every value reaches SQL as a bound parameter. The only places a client string
influences SQL *structure* are the sort column and direction, and both are
resolved through fixed allow-lists — never interpolated. That is the difference
between a sortable table and a SQL injection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg
from psycopg import sql

from coinfold.core.errors import AppFault

# Client sort key -> the actual column expression. A key absent from this map is
# rejected; it is never passed through to SQL.
SORTABLE: dict[str, sql.Composable] = {
    "date": sql.SQL("t.occurred_at"),
    "amount": sql.SQL("t.amount"),
}

DIRECTIONS: dict[str, sql.Composable] = {
    "asc": sql.SQL("ASC"),
    "desc": sql.SQL("DESC"),
}


@dataclass
class TransactionFilters:
    """Every filter the dashboard can apply. All optional, all combinable."""

    search: str | None = None
    categories: list[str] = field(default_factory=list)
    statuses: list[str] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    include_anomalous: bool = True

    def validate(self) -> None:
        """Reject ranges that can never match, with a fault that says which."""
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise AppFault(
                "QUERY_INVALID_RANGE",
                field="date",
                from_=str(self.date_from),
                to=str(self.date_to),
            )
        if (
            self.amount_min is not None
            and self.amount_max is not None
            and self.amount_min > self.amount_max
        ):
            raise AppFault(
                "QUERY_INVALID_RANGE",
                field="amount",
                from_=str(self.amount_min),
                to=str(self.amount_max),
            )


def _where(user_id: str, filters: TransactionFilters) -> tuple[sql.Composed, list[Any]]:
    """Build the shared WHERE clause once, so table and charts cannot diverge.

    Both the paged read and the analytics aggregates call this. If they built
    their own clauses, a filter added to one and forgotten in the other would
    make the chart disagree with the table underneath it — the exact bug that
    two-way cross-filtering makes visible.
    """
    clauses: list[sql.Composable] = [sql.SQL("t.user_id = %s")]
    params: list[Any] = [user_id]

    if filters.search:
        # ILIKE against the pre-lowered column; the trigram index serves this
        # without a full scan even with a leading wildcard.
        clauses.append(sql.SQL("m.search_name LIKE %s"))
        params.append(f"%{' '.join(filters.search.lower().split())}%")

    if filters.categories:
        clauses.append(sql.SQL("c.slug = ANY(%s)"))
        params.append(filters.categories)

    if filters.statuses:
        clauses.append(sql.SQL("t.status = ANY(%s::payment_status[])"))
        params.append(filters.statuses)

    if filters.methods:
        clauses.append(sql.SQL("t.method = ANY(%s::payment_method[])"))
        params.append(filters.methods)

    if filters.date_from:
        clauses.append(sql.SQL("t.occurred_at >= %s"))
        params.append(datetime.combine(filters.date_from, datetime.min.time()))

    if filters.date_to:
        # Half-open upper bound: a date_to of the 5th must include everything on
        # the 5th, so compare against the start of the 6th rather than midnight
        # on the 5th, which would silently drop a whole day of rows.
        clauses.append(sql.SQL("t.occurred_at < (%s::date + INTERVAL '1 day')"))
        params.append(filters.date_to)

    if filters.amount_min is not None:
        clauses.append(sql.SQL("t.amount >= %s"))
        params.append(filters.amount_min)

    if filters.amount_max is not None:
        clauses.append(sql.SQL("t.amount <= %s"))
        params.append(filters.amount_max)

    if not filters.include_anomalous:
        clauses.append(sql.SQL("NOT t.is_anomalous"))

    return sql.SQL(" AND ").join(clauses), params


_FROM = sql.SQL(
    """
    FROM transaction t
    JOIN merchant m ON m.id = t.merchant_id
    JOIN category c ON c.id = t.category_id
    """
)


def list_transactions(
    conn: psycopg.Connection,
    *,
    user_id: str,
    filters: TransactionFilters,
    sort_by: str,
    direction: str,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    filters.validate()

    if sort_by not in SORTABLE:
        raise AppFault("QUERY_UNKNOWN_SORT", requested=sort_by, allowed=sorted(SORTABLE))
    if direction not in DIRECTIONS:
        raise AppFault("QUERY_UNKNOWN_SORT", requested=direction, allowed=sorted(DIRECTIONS))

    where, params = _where(user_id, filters)

    total = conn.execute(
        sql.SQL("SELECT count(*) AS n {frm} WHERE {where}").format(
            frm=_FROM, where=where
        ),
        params,
    ).fetchone()["n"]

    # id is the tiebreak so that rows sharing a timestamp or an amount keep a
    # stable order across pages. Without it, a row can appear on two pages or on
    # none, which looks like data loss to the user.
    order = sql.SQL("ORDER BY {col} {dir}, t.id {dir}").format(
        col=SORTABLE[sort_by], dir=DIRECTIONS[direction]
    )

    rows = conn.execute(
        sql.SQL(
            """
            SELECT t.id, t.source_id, t.occurred_at, m.name AS merchant,
                   c.slug AS category_slug, c.label AS category_label,
                   c.accent_hue, t.amount, t.currency, t.status, t.method,
                   t.is_anomalous, t.coins_earned
            {frm} WHERE {where} {order} LIMIT %s OFFSET %s
            """
        ).format(frm=_FROM, where=where, order=order),
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()

    return {
        "rows": rows,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def get_transaction(
    conn: psycopg.Connection, *, user_id: str, transaction_id: int
) -> dict[str, Any] | None:
    """One row plus the repairs the loader made to it.

    The detail drawer shows those repairs, so a reviewer clicking a row with an
    odd timestamp sees exactly what the original value was.
    """
    row = conn.execute(
        sql.SQL(
            """
            SELECT t.id, t.source_id, t.source_row_index, t.occurred_at,
                   m.name AS merchant, c.slug AS category_slug,
                   c.label AS category_label, c.accent_hue, t.amount, t.currency,
                   t.status, t.method, t.is_anomalous, t.coins_earned
            {frm} WHERE t.user_id = %s AND t.id = %s
            """
        ).format(frm=_FROM),
        (user_id, transaction_id),
    ).fetchone()

    if row is None:
        return None

    row["anomalies"] = conn.execute(
        "SELECT kind, original_value, resolution FROM ingest_anomaly "
        "WHERE transaction_id = %s ORDER BY id",
        (transaction_id,),
    ).fetchall()
    return row


def spend_by_category(
    conn: psycopg.Connection, *, user_id: str, filters: TransactionFilters
) -> list[dict[str, Any]]:
    """Category totals under the table's current filters.

    Only successful, non-anomalous, positive rows count as spend: a failed
    payment moved no money, and a refund is not spending. Including them would
    make the chart total disagree with what the user was actually charged.
    """
    filters.validate()
    where, params = _where(user_id, filters)

    return conn.execute(
        sql.SQL(
            """
            SELECT c.slug AS category_slug, c.label AS category_label,
                   c.accent_hue, sum(t.amount) AS total, count(*) AS transactions
            {frm} WHERE {where}
              AND t.status = 'SUCCESS' AND NOT t.is_anomalous AND t.amount > 0
            GROUP BY c.slug, c.label, c.accent_hue
            ORDER BY total DESC
            """
        ).format(frm=_FROM, where=where),
        params,
    ).fetchall()


def monthly_trend(
    conn: psycopg.Connection, *, user_id: str, filters: TransactionFilters
) -> list[dict[str, Any]]:
    """Spend per calendar month, with empty months present as zero.

    generate_series fills gaps: without it a month with no transactions is
    simply absent, and a line chart then draws a straight line across it as
    though spending were steady.
    """
    filters.validate()
    where, params = _where(user_id, filters)

    return conn.execute(
        sql.SQL(
            """
            WITH bounds AS (
                SELECT date_trunc('month', min(t.occurred_at)) AS lo,
                       date_trunc('month', max(t.occurred_at)) AS hi
                {frm} WHERE {where}
            ),
            months AS (
                SELECT generate_series(lo, hi, INTERVAL '1 month') AS month
                FROM bounds WHERE lo IS NOT NULL
            ),
            totals AS (
                SELECT date_trunc('month', t.occurred_at) AS month,
                       sum(t.amount) AS total, count(*) AS transactions
                {frm} WHERE {where}
                  AND t.status = 'SUCCESS' AND NOT t.is_anomalous AND t.amount > 0
                GROUP BY 1
            )
            SELECT to_char(m.month, 'YYYY-MM') AS month,
                   COALESCE(x.total, 0) AS total,
                   COALESCE(x.transactions, 0) AS transactions
            FROM months m LEFT JOIN totals x ON x.month = m.month
            ORDER BY m.month
            """
        ).format(frm=_FROM, where=where),
        [*params, *params],
    ).fetchall()


def summary(
    conn: psycopg.Connection, *, user_id: str, filters: TransactionFilters
) -> dict[str, Any]:
    """Headline figures for the stat row, under the same filters."""
    filters.validate()
    where, params = _where(user_id, filters)

    return conn.execute(
        sql.SQL(
            """
            SELECT
              count(*) AS matched,
              COALESCE(sum(t.amount) FILTER (
                  WHERE t.status = 'SUCCESS' AND NOT t.is_anomalous AND t.amount > 0
              ), 0) AS total_spend,
              COALESCE(sum(t.amount) FILTER (
                  WHERE t.status = 'SUCCESS' AND t.amount < 0
              ), 0) AS total_refunded,
              count(*) FILTER (WHERE t.status = 'FAILED') AS failed,
              count(*) FILTER (WHERE t.status = 'PENDING') AS pending,
              COALESCE(sum(t.coins_earned), 0) AS coins_earned,
              count(*) FILTER (WHERE t.is_anomalous) AS anomalous
            {frm} WHERE {where}
            """
        ).format(frm=_FROM, where=where),
        params,
    ).fetchone()


def facets(conn: psycopg.Connection, *, user_id: str) -> dict[str, Any]:
    """The filter panel's option lists and slider bounds.

    Derived from the data rather than hardcoded, so the amount slider spans
    exactly the range that exists and a category with no rows never appears as
    a filter that returns nothing.
    """
    categories = conn.execute(
        """
        SELECT c.slug, c.label, c.accent_hue, count(t.id) AS transactions
        FROM category c
        LEFT JOIN transaction t ON t.category_id = c.id AND t.user_id = %s
        GROUP BY c.slug, c.label, c.accent_hue
        HAVING count(t.id) > 0
        ORDER BY c.label
        """,
        (user_id,),
    ).fetchall()

    bounds = conn.execute(
        """
        SELECT min(amount) AS amount_min, max(amount) AS amount_max,
               min(occurred_at)::date AS date_min, max(occurred_at)::date AS date_max,
               count(*) AS total
        FROM transaction WHERE user_id = %s
        """,
        (user_id,),
    ).fetchone()

    return {
        "categories": categories,
        "statuses": ["SUCCESS", "PENDING", "FAILED"],
        "methods": ["CREDIT_CARD", "DEBIT_CARD", "UPI", "NETBANKING"],
        **bounds,
    }
