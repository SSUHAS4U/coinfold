# Technical decisions

The choices that mattered, and one line on why. Where a decision would flip
under different conditions, that condition is named — a decision without its
boundary is a preference.

---

## Pagination: offset, not keyset or virtualization

**Server-side offset pagination, 50 rows per page, with a total count.**

The table exposes a total ("1–50 of 10,000") and lets the user jump to an
arbitrary page. Keyset pagination can do neither: it has no notion of "page
137" and no cheap total. At 10,000 rows the deepest possible `OFFSET` is 9,950,
which Postgres serves from the sort index in under a millisecond.

**When this flips:** at roughly a million rows, deep `OFFSET` becomes a
sequential scan and keyset (with jump-to-page dropped) becomes correct.

**Why not virtualization:** virtualizing requires all 10,000 rows in the browser
— roughly 2.3 MB of JSON parsed on the main thread before the first paint,
re-sorted in JS on every column click. Server-side paging ships 50 rows and lets
Postgres do the sorting it already has indexes for. Virtualization would also
have made the server-side filtering the brief describes as "the stronger
approach" pointless.

**Stable ordering:** every sort carries `id` as a tiebreak. Without it, rows
sharing a timestamp or amount can appear on two pages or none as the window
moves — which reads to a user as data loss.

## State: one reducer, no state library

`useReducer` holding a single `Query` object, plus four request results.

Redux, Zustand or TanStack Query would each add a dependency and a directory
for behaviour this app does not need. The whole client state is one plain
object; the interesting part is not storing it but making sure the table and
both charts are looking at the *same* one.

They take the same `Query` value and the API builds their SQL `WHERE` clause
from one shared function, so the chart and the table underneath it cannot
disagree about what is filtered — the exact bug that two-way cross-filtering
makes visible.

**Handled explicitly rather than by a library:**

- **Debounce** — the search input updates on every keystroke for instant
  feedback, but the request waits 220 ms. Without it, typing "domino" fires six
  requests and the last to *arrive* wins, which is not necessarily the last one
  sent.
- **Abort** — each new query aborts the previous `fetch`. This is what actually
  prevents a slow early response overwriting a fast later one.
- **Stale-while-refetching** — rows stay on screen and dim during a refetch
  rather than being replaced by skeletons, so the user never loses their place.

## Schema: normalised, with the source preserved

Lookup tables for `category` and `merchant`, enums for status and method,
`NUMERIC(14,2)` for money, `TIMESTAMPTZ` for time.

- **`NUMERIC`, never float.** `0.1 + 0.2` is not `0.3`, and a money column is
  the last place to discover that. Floats are coerced via `str()` at ingest so
  no binary rounding error enters the column.
- **`id` is not the primary key**, because it repeats (see ASSUMPTIONS). A
  surrogate key plus `source_row_index` keeps every row traceable to its exact
  line in the file.
- **`category_id` is `NOT NULL`** pointing at a real row, so the read path never
  needs a `LEFT JOIN` or a null check.
- **Partial index for analytics** (`WHERE NOT is_anomalous AND status =
  'SUCCESS'`) so chart aggregates scan only the rows charts may see.
- **Trigram index on merchant** so `ILIKE '%domino%'` uses an index instead of
  the sequential scan a leading wildcard would otherwise force.

## Coins: an append-only ledger, not a counter

`coin_ledger` is insert-only; a balance is `SUM(delta)`, exposed as a view.

A mutable `balance` column can become wrong and then cannot be explained. A
ledger can always answer *why* the number is what it is. Database constraints
enforce the invariants rather than convention: an `EARN` entry must name its
transaction, a `REDEEM` must name its redemption, and a unique partial index
allows exactly one `EARN` per transaction — so running the seed twice cannot
double a balance.

Cost: a `SUM` per read instead of a column read. Mitigated with a covering
index (`INCLUDE (delta)`) making it an index-only scan. At millions of entries
this would want a periodic snapshot row.

## Redeem: locked, validated server-side, idempotent

The one write in the app, and the one place a race costs real value.

1. **Idempotency first.** The client sends a UUID per attempt. A repeat of the
   same key returns the original redemption instead of charging twice — which is
   what makes retrying a dropped response safe. A reused key for a *different*
   reward is a client bug and is refused.
2. **`SELECT ... FOR UPDATE` on the user row** before reading the balance. Two
   simultaneous redeems then serialise instead of both seeing the old balance
   and both succeeding. Locking the user (not the ledger) fixes the lock order,
   which is what keeps it deadlock-free.
3. **Balance re-read from the ledger inside the transaction.** Nothing the
   client claims about its balance is consulted.
4. **Stock decrements conditionally** (`UPDATE ... WHERE stock > 0 RETURNING`),
   so the check and the write are one atomic statement. A read-then-write would
   leave a gap where the last unit sells twice.
5. **Fails closed.** Any doubt and no coins move; the redemption and its ledger
   entry are written in one transaction, so a crash between them is impossible.

**Optimistic UI with real rollback:** the balance updates the instant the user
confirms and rolls back to the *exact* previous value on failure. The rollback
matters more than the optimism — a balance showing a number the server disagrees
with is worse than a spinner, because the user will act on it.

## Errors: a registered fault, never a bare status code

Every failure carries an id, **what** happened in the user's terms, **why**
(the mechanism), and a concrete **action**. "Try again later" is not an action;
the action names a screen or a field.

Raising an unregistered fault id throws immediately, so a failure path added
without its diagnosis fails in tests rather than shipping. The UI renders
`what` and `action` directly and hides `why` behind a disclosure — that part is
for whoever is debugging, not for someone paying a bill.

Pydantic's 422s are reshaped into the same envelope, so the client has one error
path rather than a special case for one status code.

## The table is hand-built; almost nothing else is

The brief forbids a component library for the table, so it is a real
`<table>` with `<thead>`, `<th scope>` and `aria-sort` — a grid of divs would
look identical and be unusable with a screen reader.

Elsewhere the rule was: reuse before building. Recharts for charts (explicitly
permitted), Lucide for icons, Next.js for the framework. The Modal, Drawer,
Button and Chip are hand-built because at this size a library is more overhead
than the code it replaces — and the Modal is where the focus-trap work the brief
calls out actually lives.

## Responsive: columns fold, the page never scrolls sideways

Below 1024px the method column goes, below 768px the date folds under the
merchant, below 640px status moves under the amount. Two-line cells carry the
information the removed columns held.

The alternative — a horizontally scrolling table — is what most dashboards do
and it is worse: it hides the amount, the column people came for. The table
scrolls inside its own container and the render tests assert
`documentElement.scrollWidth <= clientWidth` at 360px.

## Auth: short access token, refresh in the client, sessionStorage

Argon2id (memory-hard, so GPU cracking is expensive), 30-minute access tokens,
14-day refresh. Tokens live in `sessionStorage` so they die with the tab rather
than persisting on a shared machine.

The `kind` claim is checked on every decode: without it a refresh token would be
accepted as an access token, handing a long-lived credential the access a
short-lived one exists to limit.

Sign-in spends equal CPU on unknown emails, so response latency does not reveal
which addresses have accounts.

**Trade-off:** `sessionStorage` is readable by any script on the origin. An
httpOnly cookie plus CSRF protection is stronger, and is the right move if this
were real; it was not worth the cross-site cookie complexity for a review
deployment where the API and the frontend sit on different domains.

## Hosting: Vercel + Render + Supabase, and the quota that shapes it

Frontend on Vercel, backend as a Docker service on Render, Postgres on Supabase.

**Render's free tier grants 750 instance-hours per _workspace_ per calendar
month, not per service.** A calendar month is ~730 hours, so exactly one
always-on free service fits. Exceeding it suspends *every* free service in the
workspace until the month rolls over. That single fact drives the deployment
plan in `docs/DEPLOY.md`.

Render's own free Postgres was rejected: it is capped at one per workspace and
**expires 30 days after creation**, which would quietly delete the database
mid-review.

`/health` deliberately opens no database connection, so pinging it every ten
minutes to prevent cold starts costs no Supabase quota.
