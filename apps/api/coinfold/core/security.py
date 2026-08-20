"""Password hashing and token issuing.

Argon2id for passwords: it is the current password-hashing competition winner
and is memory-hard, which is the property that makes GPU cracking expensive.
The cost parameters are argon2-cffi's defaults, which track current guidance.

Tokens are short-lived HS256 JWTs. `sub` carries the user id and nothing else
sensitive: a JWT is signed, not encrypted, so anything inside it is readable by
whoever holds it.
"""

from __future__ import annotations

import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from coinfold.core.errors import AppFault

_hasher = PasswordHasher()

TokenKind = Literal["access", "refresh"]


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, stored_hash: str) -> tuple[bool, str | None]:
    """Verify a password, returning (ok, rehash_if_needed).

    Returns a new hash when argon2's parameters have moved on since the stored
    digest was written, so accounts get upgraded on next sign-in rather than
    staying on old cost parameters forever.
    """
    try:
        _hasher.verify(stored_hash, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False, None

    if _hasher.check_needs_rehash(stored_hash):
        return True, _hasher.hash(plain)
    return True, None


def verify_dummy_password(plain: str) -> None:
    """Burn the same CPU time as a real verify, for unknown emails.

    Without this, an unknown email returns in microseconds while a known one
    takes ~50ms, and that timing difference tells an attacker which addresses
    have accounts.
    """
    try:
        _hasher.verify(
            "$argon2id$v=19$m=65536,t=3,p=4$"
            "c29tZXNhbHRzb21lc2FsdA$K5eF1KJUqFRPTn6f0Xx0Yy8mVQm0KfPQd3rMh7l0Zq0",
            plain,
        )
    except Exception:  # noqa: BLE001, S110 - elapsed time is the point, not the result
        pass


def create_token(
    *,
    user_id: str,
    secret: str,
    algorithm: str,
    kind: TokenKind,
    ttl: timedelta,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_token(token: str, *, secret: str, algorithm: str, expect: TokenKind) -> str:
    """Return the user id, or raise a registered fault.

    The `kind` check matters: without it a refresh token would be accepted as an
    access token, silently giving a long-lived credential the access a
    short-lived one was designed to limit.
    """
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=[algorithm],
            options={"require": ["exp", "sub", "kind"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AppFault("AUTH_TOKEN_EXPIRED") from exc
    except jwt.PyJWTError as exc:
        raise AppFault("AUTH_TOKEN_INVALID") from exc

    # compare_digest rather than != so the check is not timing-variable.
    if not hmac.compare_digest(str(claims.get("kind", "")), expect):
        raise AppFault("AUTH_TOKEN_INVALID", expected=expect)

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise AppFault("AUTH_TOKEN_INVALID")
    return subject
