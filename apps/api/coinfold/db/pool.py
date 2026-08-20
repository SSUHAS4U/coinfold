"""Connection pooling.

One pool for the process, opened on startup and closed on shutdown. Free-tier
Postgres allows few connections, so the pool is small by default and a request
waits briefly for a connection rather than opening its own.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from coinfold.core.errors import AppFault

_pool: ConnectionPool | None = None


def open_pool(database_url: str, *, min_size: int, max_size: int) -> ConnectionPool:
    global _pool  # noqa: PLW0603 - one pool per process is the point
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=database_url,
            min_size=min_size,
            max_size=max_size,
            kwargs={"row_factory": dict_row},
            # Fail fast rather than hanging a request for the client's timeout.
            timeout=10.0,
            # Recycle before a pooler's idle cutoff silently kills a connection.
            max_idle=180.0,
            open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool  # noqa: PLW0603
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    """Hand out a pooled connection, translating exhaustion into a fault.

    Without the translation this surfaces as a 500 with a psycopg traceback,
    which tells the user nothing about what to do. DB_UNAVAILABLE tells them
    to check whether the database is paused.
    """
    if _pool is None:
        raise AppFault("DB_UNAVAILABLE", reason="pool not opened")
    try:
        with _pool.connection() as conn:
            yield conn
    except psycopg.OperationalError as exc:
        raise AppFault("DB_UNAVAILABLE", reason=type(exc).__name__) from exc
