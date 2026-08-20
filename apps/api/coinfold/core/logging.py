"""One log file, one known path, every request and every failure.

    apps/api/logs/coinfold.log

Read it before forming a theory, not after the theory fails. Each line is JSON
so it can be grepped or piped through jq without a parser.

Redaction is not best-effort here: the payload keys that could carry a secret
are dropped by name before serialisation, so a password or bearer token cannot
reach the file even if a future handler passes the whole request body in.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_PATH = LOG_DIR / "coinfold.log"

# Set per request so every line emitted while handling it shares one id. A user
# reporting a failure quotes this id and the whole request is findable.
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")

# Dropped by name before anything is written.
_REDACT = {
    "password", "password_hash", "token", "access_token", "refresh_token",
    "authorization", "jwt_secret", "database_url", "secret", "api_key",
}


def new_trace_id() -> str:
    return uuid.uuid4().hex[:12]


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "trace_id": trace_id_var.get(),
            "message": record.getMessage(),
        }
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(_scrub(extra))
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def _scrub(value: Any) -> Any:
    """Drop secret-bearing keys at every depth before the value is serialised."""
    if isinstance(value, dict):
        return {
            k: ("<redacted>" if k.lower() in _REDACT else _scrub(v))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_scrub(v) for v in value]
    return value


def configure_logging(level: str = "INFO") -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("coinfold")
    logger.setLevel(level)
    logger.handlers.clear()
    logger.propagate = False

    # Bounded so a long-running free-tier instance cannot fill its disk.
    file_handler = RotatingFileHandler(
        LOG_PATH, maxBytes=5_000_000, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(JsonFormatter())
    logger.addHandler(file_handler)

    # Render and Vercel capture stdout, so the same lines are visible in the
    # hosting dashboard without shelling into the instance.
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(JsonFormatter())
    logger.addHandler(stream_handler)

    return logger


def log_event(level: int, message: str, **fields: Any) -> None:
    logging.getLogger("coinfold").log(
        level, message, extra={"extra_fields": fields}
    )
