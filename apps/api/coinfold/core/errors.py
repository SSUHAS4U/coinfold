"""Fault capture: every failure carries its own diagnosis.

A failure here is never a bare status code. It is a registered fault with three
things attached:

    what   the user-facing sentence, in their terms, no jargon
    why    the mechanism, so a fix targets the cause and not the symptom
    action a concrete next step. "Investigate" and "try again later" are not
           actions; the action names a screen, a field, or a file.

Every fault must be declared in FAULTS below. Raising an AppFault with an
unregistered id is itself a bug, and `test_faults.py` fails the build if any id
is missing a field or if any registered id is never referenced in the codebase.
That is what stops the registry from rotting into a list of dead constants.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FaultSpec:
    """The diagnosis attached to one class of failure."""

    status: int
    what: str
    why: str
    action: str


# ---------------------------------------------------------------------------
# The registry. Ids are stable strings: they appear in API responses and in the
# log, so a user can quote one and it can be found in exactly one place here.
# ---------------------------------------------------------------------------

FAULTS: dict[str, FaultSpec] = {
    # --- Authentication -----------------------------------------------------
    "AUTH_INVALID_CREDENTIALS": FaultSpec(
        status=401,
        what="That email and password combination did not match an account.",
        why=(
            "The email was not found, or the supplied password did not verify "
            "against the stored Argon2 digest. Which of the two is deliberately "
            "not distinguished, so this endpoint cannot be used to discover "
            "which email addresses have accounts."
        ),
        action="Re-enter the password on the sign-in screen, or use the demo account shown beneath the form.",
    ),
    "AUTH_TOKEN_EXPIRED": FaultSpec(
        status=401,
        what="Your session has expired.",
        why="The access token's exp claim is in the past. Access tokens are deliberately short-lived.",
        action="The app refreshes this automatically. If the sign-in screen appears, sign in again.",
    ),
    "AUTH_TOKEN_INVALID": FaultSpec(
        status=401,
        what="Your session could not be verified.",
        why=(
            "The bearer token failed signature verification, or its claims did "
            "not match the expected shape. This is what a tampered or "
            "wrong-environment token looks like."
        ),
        action="Sign out and sign in again. If it repeats, check that JWT_SECRET matches between the API and whatever issued the token.",
    ),
    "AUTH_EMAIL_TAKEN": FaultSpec(
        status=409,
        what="An account already exists for that email address.",
        why="app_user.email carries a UNIQUE constraint and the insert violated it.",
        action="Sign in with that email instead, on the sign-in tab.",
    ),
    # --- Request validation -------------------------------------------------
    "QUERY_INVALID_RANGE": FaultSpec(
        status=422,
        what="That filter range runs backwards.",
        why="The 'from' bound of a date or amount filter was greater than its 'to' bound, which can never match a row.",
        action="Swap the two values in the filter panel, or clear that filter.",
    ),
    "QUERY_PAGE_TOO_LARGE": FaultSpec(
        status=422,
        what="That page size is larger than this API will serve.",
        why=(
            "page_size exceeded MAX_PAGE_SIZE. The cap exists so one request "
            "cannot make the server materialise the whole table."
        ),
        action="Request a smaller page_size. The dashboard uses 50.",
    ),
    "QUERY_UNKNOWN_SORT": FaultSpec(
        status=422,
        what="The table cannot be sorted by that column.",
        why=(
            "sort_by was not one of the allowed columns. The list is a fixed "
            "allow-list rather than a passthrough, because interpolating a "
            "client string into ORDER BY is a SQL injection."
        ),
        action="Sort by date or amount. Those are the two sortable columns in the table header.",
    ),
    "TRANSACTION_NOT_FOUND": FaultSpec(
        status=404,
        what="That transaction is not on your statement.",
        why=(
            "No transaction with that id belongs to the signed-in user. The "
            "lookup is scoped by user_id, so another account's row reads as "
            "absent rather than forbidden — which is what stops this endpoint "
            "being used to probe for other people's transaction ids."
        ),
        action="Go back to the table and open the row from there.",
    ),
    # --- Rewards ------------------------------------------------------------
    "REWARD_NOT_FOUND": FaultSpec(
        status=404,
        what="That reward is no longer in the catalogue.",
        why="No active reward row matched the requested id. It was withdrawn or never existed.",
        action="Reopen the Rewards panel to load the current catalogue, then pick again.",
    ),
    "REWARD_OUT_OF_STOCK": FaultSpec(
        status=409,
        what="That reward just sold out.",
        why="The reward's stock reached zero between the catalogue being displayed and this redeem arriving.",
        action="Choose a different reward. Your coins have not been touched.",
    ),
    "REWARD_INSUFFICIENT_COINS": FaultSpec(
        status=409,
        what="You do not have enough coins for that reward yet.",
        why=(
            "The ledger balance, summed under a row lock at redeem time, was "
            "below the reward's cost. The balance is re-read inside the "
            "transaction rather than trusted from the client."
        ),
        action="Pick a cheaper reward, or earn more coins by paying a bill. The Rewards panel shows how many more you need.",
    ),
    "REWARD_IDEMPOTENCY_CONFLICT": FaultSpec(
        status=409,
        what="That redemption was already submitted with different details.",
        why=(
            "The idempotency key has been used before for this user, but for a "
            "different reward. Reusing a key for a different request would make "
            "the retry return the wrong redemption."
        ),
        action="Reload the Rewards panel and redeem again; the app generates a fresh key per attempt.",
    ),
    # --- Infrastructure -----------------------------------------------------
    "DB_UNAVAILABLE": FaultSpec(
        status=503,
        what="The app cannot reach its database right now.",
        why=(
            "The connection pool could not hand out a connection. On a free "
            "hosting tier this is usually the database instance being paused or "
            "the service having just woken from a cold start."
        ),
        action="Retry in about thirty seconds. If it persists, check the database is not paused in the Supabase dashboard.",
    ),
    "INTERNAL_UNEXPECTED": FaultSpec(
        status=500,
        what="Something went wrong that this app did not anticipate.",
        why="An exception reached the top-level handler without a registered fault id, which means a failure path was added without its diagnosis.",
        action="Quote the trace id shown below to find the full stack trace in apps/api/logs/coinfold.log.",
    ),
}


class AppFault(Exception):
    """A failure with a registered diagnosis attached.

    Raising this with an unknown id raises KeyError immediately rather than
    producing a response with no diagnosis, so the mistake surfaces in tests
    instead of in production.
    """

    def __init__(self, fault_id: str, **context: Any) -> None:
        if fault_id not in FAULTS:
            raise KeyError(
                f"{fault_id!r} is not a registered fault. Add it to FAULTS in "
                "coinfold/core/errors.py with what/why/action before raising it."
            )
        self.fault_id = fault_id
        self.spec = FAULTS[fault_id]
        self.context = context
        super().__init__(f"{fault_id}: {self.spec.what}")

    def to_payload(self, trace_id: str) -> dict[str, Any]:
        """The wire shape. The UI renders `what` and `action` directly."""
        return {
            "error": {
                "id": self.fault_id,
                "what": self.spec.what,
                "why": self.spec.why,
                "action": self.spec.action,
                "trace_id": trace_id,
                **({"context": self.context} if self.context else {}),
            }
        }
