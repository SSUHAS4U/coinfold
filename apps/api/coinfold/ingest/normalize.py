"""Pure normalisation of the raw transaction feed.

No database, no I/O: every function here takes a value and returns a value, so
the whole dirty-data policy is unit-testable without Postgres running.

The feed is genuinely dirty. Profiled across all 10,000 rows:

  timestamp    5 distinct formats (ISO-Z, ISO+05:30, epoch millis,
               DD/MM/YYYY HH:MM:SS, and bare YYYY-MM-DD)
  amount       20 rows arrive as JSON strings; 148 are negative; 1 is a
               999999999.0 sentinel
  status       25 rows use lowercase 'success'
  category     200 rows are null, empty, or missing the key entirely
  id           40 values repeat, on rows whose payloads genuinely differ

Each repair returns the value it produced *and* an Anomaly describing what was
changed, so nothing is silently rewritten behind the reviewer's back.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any

# --- Policy constants -------------------------------------------------------

# Above this, a "consumer credit-card transaction" is not credible and is almost
# certainly a sentinel. Exactly one row in the feed exceeds it (999999999.0).
# The next largest genuine values are 742350 and 518900, which are large but
# plausible, so the threshold deliberately sits above them.
IMPLAUSIBLE_AMOUNT = Decimal("1000000.00")

# The source feed's local timezone. The DD/MM/YYYY and bare-date rows carry no
# offset; India Standard Time is the only reading consistent with an all-INR,
# all-Indian-merchant dataset.
SOURCE_TZ_OFFSET_MINUTES = 330  # UTC+05:30


class AnomalyKind(str, Enum):
    TIMESTAMP_NON_ISO = "TIMESTAMP_NON_ISO"
    AMOUNT_NOT_NUMERIC = "AMOUNT_NOT_NUMERIC"
    AMOUNT_NEGATIVE = "AMOUNT_NEGATIVE"
    AMOUNT_OUT_OF_RANGE = "AMOUNT_OUT_OF_RANGE"
    CATEGORY_MISSING = "CATEGORY_MISSING"
    STATUS_CASE_MISMATCH = "STATUS_CASE_MISMATCH"
    DUPLICATE_SOURCE_ID = "DUPLICATE_SOURCE_ID"


@dataclass(frozen=True)
class Anomaly:
    """One repair the loader made, with enough detail to audit it."""

    kind: AnomalyKind
    original_value: str | None
    resolution: str


class NormalisationError(ValueError):
    """A row could not be repaired and must not be loaded.

    Carries the field and the offending value so the caller can report which
    source row failed and why, rather than a bare stack trace.
    """

    def __init__(self, field: str, value: Any, reason: str) -> None:
        self.field = field
        self.value = value
        self.reason = reason
        super().__init__(f"{field}={value!r}: {reason}")


# --- Timestamps -------------------------------------------------------------

_ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_ISO_OFFSET = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$")
_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_SLASH_DMY = re.compile(r"^(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2}):(\d{2})$")

_SOURCE_TZ = timezone(timedelta(minutes=SOURCE_TZ_OFFSET_MINUTES))


def normalise_timestamp(raw: Any) -> tuple[datetime, Anomaly | None]:
    """Coerce any of the feed's five timestamp shapes to an aware UTC datetime.

    The DD/MM/YYYY form is read day-first, and that is a proven reading rather
    than a guess: of the 841 slash-formatted rows, 498 have a first component
    greater than 12 and none have a second component greater than 12. A
    month-first reading would make 498 rows unparseable.
    """
    # Epoch milliseconds, as a JSON number.
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        moment = datetime.fromtimestamp(raw / 1000, tz=timezone.utc)
        return moment, Anomaly(
            AnomalyKind.TIMESTAMP_NON_ISO,
            str(raw),
            "epoch milliseconds read as UTC",
        )

    if not isinstance(raw, str) or not raw.strip():
        raise NormalisationError("timestamp", raw, "missing or non-textual")

    text = raw.strip()

    if _ISO_Z.match(text):
        return datetime.fromisoformat(text.replace("Z", "+00:00")), None

    if _ISO_OFFSET.match(text):
        moment = datetime.fromisoformat(text).astimezone(timezone.utc)
        return moment, Anomaly(
            AnomalyKind.TIMESTAMP_NON_ISO,
            text,
            "ISO-8601 with a non-UTC offset, converted to UTC",
        )

    if _DATE_ONLY.match(text):
        # The regex only proves the shape; "2025-13-45" passes it and is still
        # not a date. Wrap so a malformed value leaves as NormalisationError
        # naming the field, not a bare ValueError from deep in the stdlib.
        try:
            day = date.fromisoformat(text)
        except ValueError as exc:
            raise NormalisationError("timestamp", text, str(exc)) from exc
        moment = datetime(
            day.year, day.month, day.day, tzinfo=_SOURCE_TZ
        ).astimezone(timezone.utc)
        return moment, Anomaly(
            AnomalyKind.TIMESTAMP_NON_ISO,
            text,
            "date without a time, anchored to 00:00:00 IST",
        )

    slash = _SLASH_DMY.match(text)
    if slash:
        dd, mm, yyyy, hh, mi, ss = (int(g) for g in slash.groups())
        try:
            moment = datetime(
                yyyy, mm, dd, hh, mi, ss, tzinfo=_SOURCE_TZ
            ).astimezone(timezone.utc)
        except ValueError as exc:
            raise NormalisationError("timestamp", text, str(exc)) from exc
        return moment, Anomaly(
            AnomalyKind.TIMESTAMP_NON_ISO,
            text,
            "DD/MM/YYYY read day-first in IST, converted to UTC",
        )

    raise NormalisationError("timestamp", text, "unrecognised format")


# --- Amounts ----------------------------------------------------------------


def normalise_amount(raw: Any) -> tuple[Decimal, list[Anomaly], bool]:
    """Coerce an amount to Decimal and judge whether analytics may use it.

    Returns the amount, the repairs made, and whether the row is anomalous
    (excluded from charts, still shown in the table).

    Negative amounts are kept as-is. They read as refunds and reversals, which
    are real events a user should see on a statement; erasing them would make
    the table disagree with the source. They earn no coins.
    """
    anomalies: list[Anomaly] = []

    if isinstance(raw, bool) or raw is None:
        raise NormalisationError("amount", raw, "missing or non-numeric")

    if isinstance(raw, str):
        try:
            value = Decimal(raw.strip())
        except (InvalidOperation, AttributeError) as exc:
            raise NormalisationError("amount", raw, "not a numeric string") from exc
        anomalies.append(
            Anomaly(
                AnomalyKind.AMOUNT_NOT_NUMERIC,
                raw,
                "numeric string parsed to NUMERIC(14,2)",
            )
        )
    elif isinstance(raw, (int, float)):
        # str() first: Decimal(float) would carry the binary rounding error into
        # a money column.
        value = Decimal(str(raw))
    else:
        raise NormalisationError("amount", raw, "unsupported type")

    value = value.quantize(Decimal("0.01"))

    is_anomalous = False
    if abs(value) > IMPLAUSIBLE_AMOUNT:
        is_anomalous = True
        anomalies.append(
            Anomaly(
                AnomalyKind.AMOUNT_OUT_OF_RANGE,
                str(raw),
                f"exceeds the {IMPLAUSIBLE_AMOUNT} plausibility ceiling; kept in "
                "the table, excluded from analytics",
            )
        )
    elif value < 0:
        anomalies.append(
            Anomaly(
                AnomalyKind.AMOUNT_NEGATIVE,
                str(raw),
                "negative amount kept as a refund/reversal; earns no coins",
            )
        )

    return value, anomalies, is_anomalous


# --- Status and method ------------------------------------------------------

_VALID_STATUSES = {"SUCCESS", "PENDING", "FAILED"}

_METHOD_MAP = {
    "credit card": "CREDIT_CARD",
    "debit card": "DEBIT_CARD",
    "upi": "UPI",
    "netbanking": "NETBANKING",
}


def normalise_status(raw: Any) -> tuple[str, Anomaly | None]:
    """Upper-case the status, recording the 25 lowercase 'success' rows.

    This one matters more than it looks: an exact-match filter or a coin rule
    written against 'SUCCESS' would silently skip those rows, under-reporting
    both the transaction count and the user's balance.
    """
    if not isinstance(raw, str) or not raw.strip():
        raise NormalisationError("status", raw, "missing")

    text = raw.strip()
    upper = text.upper()
    if upper not in _VALID_STATUSES:
        raise NormalisationError("status", raw, "not a known status")

    if upper != text:
        return upper, Anomaly(
            AnomalyKind.STATUS_CASE_MISMATCH,
            text,
            f"case-normalised to {upper}",
        )
    return upper, None


def normalise_method(raw: Any) -> str:
    if not isinstance(raw, str) or raw.strip().lower() not in _METHOD_MAP:
        raise NormalisationError("payment_method", raw, "not a known method")
    return _METHOD_MAP[raw.strip().lower()]


# --- Category ---------------------------------------------------------------


def normalise_category(
    raw: Any, merchant: str, merchant_to_category: dict[str, str]
) -> tuple[str, Anomaly | None]:
    """Resolve a category, imputing from the merchant when the feed omits one.

    Imputation is safe here because it is measured, not assumed: across the
    whole feed no merchant ever appears under two different categories, and
    every one of the 200 category-less rows names a merchant seen elsewhere
    with a category. So the merchant determines the category exactly.

    If a future feed breaks that property, the merchant will be absent from the
    map and the row falls back to 'uncategorised' rather than guessing.
    """
    if isinstance(raw, str) and raw.strip():
        return raw.strip(), None

    imputed = merchant_to_category.get(merchant)
    if imputed:
        return imputed, Anomaly(
            AnomalyKind.CATEGORY_MISSING,
            repr(raw),
            f"imputed as {imputed!r} from merchant {merchant!r}, which maps to "
            "exactly one category across the feed",
        )

    return "Uncategorised", Anomaly(
        AnomalyKind.CATEGORY_MISSING,
        repr(raw),
        f"merchant {merchant!r} has no unambiguous category; fell back to "
        "'Uncategorised'",
    )


def build_merchant_category_map(rows: list[dict[str, Any]]) -> dict[str, str]:
    """Map merchant -> category, keeping only merchants with a single category.

    A merchant seen under two categories is deliberately excluded rather than
    resolved by majority vote: a wrong category is worse than an honest blank.
    """
    seen: dict[str, set[str]] = {}
    for row in rows:
        category = row.get("category")
        merchant = row.get("merchant")
        if isinstance(category, str) and category.strip() and isinstance(merchant, str):
            seen.setdefault(merchant, set()).add(category.strip())
    return {m: next(iter(c)) for m, c in seen.items() if len(c) == 1}


# --- Coins ------------------------------------------------------------------


def coins_for(
    amount: Decimal, status: str, is_anomalous: bool, rupees_per_coin: Decimal, cap: int
) -> int:
    """Coins earned by one transaction.

    Fails closed: only a successful, positive, non-anomalous payment accrues.
    A pending payment may still fail, a failed one took no money, a refund
    returns money, and an anomalous amount is not trustworthy enough to mint
    currency from. The per-transaction cap keeps one large payment from
    dominating the balance.
    """
    if status != "SUCCESS" or is_anomalous or amount <= 0:
        return 0
    return min(int(amount // rupees_per_coin), cap)
