# Architecture

**Read this before changing anything.** It is a map, not a changelog: it says
where things live, what must stay true, and how this project actually fails.
If a change makes this document wrong, fix it in the same commit.

---

## Shape

```
Browser ──► Next.js (Vercel) ──► FastAPI (Render) ──► PostgreSQL 18 (Supabase)
            apps/web              apps/api             db/migrations
```

The browser never talks to Postgres, and never holds more than one page of
rows. Filtering, sorting, pagination and aggregation all happen in SQL.

## File map

### `db/`

| Path | Owns |
|---|---|
| `migrations/001_init.sql` | The entire schema: tables, enums, indexes, constraints, the `coin_balance` view. Applied in filename order. |
| `seed/transactions.raw.json` | The supplied feed, unmodified. Never edit it — it is the fixture every count is checked against. |

### `apps/api/coinfold/`

| Path | Owns | Never |
|---|---|---|
| `core/config.py` | Settings from env. No usable production defaults. | Never add a fallback for `DATABASE_URL` or `JWT_SECRET`. |
| `core/errors.py` | **The fault registry.** Every failure class, with what/why/action. | Never raise a bare `HTTPException`. |
| `core/logging.py` | One JSON log at `apps/api/logs/coinfold.log`, with per-request trace ids and key-name redaction. | Never log a value whose key is in `_REDACT`. |
| `core/security.py` | Argon2id hashing, JWT issue/decode, timing equalisation. | Never decode a token without checking the `kind` claim. |
| `db/pool.py` | One connection pool per process. | — |
| `db/transactions.py` | Read path: filters, sort, pagination, analytics. | **Never interpolate a client string into SQL.** Sort keys resolve through allow-lists. |
| `db/rewards.py` | The redeem transaction. | Never trust a client-supplied balance. |
| `db/users.py` | User lookup, creation, per-user data copy. | — |
| `api/schemas.py` | Request/response models. Validation lives here, not in route bodies. | — |
| `api/deps.py` | Auth, connection, filters, paging as dependencies. | — |
| `api/routes.py` | Thin HTTP layer. Validate → delegate → shape. | Never put a business rule here. |
| `ingest/normalize.py` | **The dirty-data policy**, as pure functions. | Never repair a value without returning an `Anomaly` describing it. |
| `ingest/seed.py` | One-command schema + load + ledger, in one transaction. | — |
| `main.py` | App factory, middleware, exception handlers. | — |

### `apps/web/src/`

| Path | Owns |
|---|---|
| `app/page.tsx` | The scroll-driven landing story: four photographic chapters. |
| `app/login/page.tsx`, `app/signup/page.tsx` | The two auth routes. |
| `app/app/layout.tsx` | **The authenticated area**: the session guard, the shared dashboard state, and the shell. Everything below it inherits all three. |
| `app/app/page.tsx` | Overview — the conclusion, not the evidence. |
| `app/app/transactions/page.tsx` | The table and its filters, given the whole viewport. |
| `app/app/analytics/page.tsx` | Both charts, plus the filter bar. |
| `app/app/rewards/page.tsx` | Catalogue, balance, and redemption history. |
| `app/globals.css` | **All design tokens.** The only file allowed to contain a raw colour. |
| `components/app/AppShell.tsx` | Sidebar, top bar, mobile drawer. |
| `components/app/DashboardContext.tsx` | Lifts `useDashboard` to the layout so filters survive navigation. |
| `hooks/useDashboard.ts` | **The single source of query state.** One reducer, one debounce, one abort controller. Loading is derived from a request key, never stored. |
| `hooks/useBrowserState.ts` | Media query, theme and session reads via `useSyncExternalStore`. |
| `lib/api.ts` | Typed client, token refresh, `ApiError` carrying the server's fault. |
| `lib/format.ts` | All money/date formatting. Indian digit grouping, IST rendering. |
| `components/table/TransactionTable.tsx` | The hand-built table. No component library. |
| `components/ui/Overlay.tsx` | The hand-built modal/drawer primitive: focus trap, Escape, restore. |
| `components/charts/SpendCharts.tsx` | Both charts. Click-to-filter. |
| `components/rewards/RewardsPanel.tsx` | Redeem flow, optimistic update, rollback. |
| `components/landing/StoryBackdrop.tsx` | The scroll-driven photography, and the auth Ken Burns drift. |

---

## Invariants

Break one of these and something is quietly wrong rather than loudly broken.

1. **Money is `NUMERIC`, never a float.** Coerce via `str()` at the boundary.
2. **A balance is `SUM(coin_ledger.delta)`.** Never a stored counter. The ledger
   is append-only: no `UPDATE`, no `DELETE`.
3. **One `EARN` entry per transaction**, enforced by a unique partial index — so
   re-running the seed cannot double a balance.
4. **A repaired value always produces an `ingest_anomaly` row** recording the
   original. Nothing is changed silently.
5. **The table and both charts read one `Query` object**, and the API builds
   their `WHERE` clause from one shared function (`_where`). They cannot
   disagree about what is filtered.
6. **Sort keys and directions resolve through allow-lists.** A client string
   never reaches `ORDER BY`.
7. **Every query is scoped by `user_id`.** Another account's row reads as absent,
   never as forbidden.
8. **Every failure is a registered `AppFault`.** An unknown id raises `KeyError`
   immediately rather than returning an undiagnosed error.
9. **Redeem fails closed.** Lock the user row, re-read the balance from the
   ledger, decrement stock conditionally, write both records in one transaction.
10. **No raw hex in a component.** If a colour is needed that no token covers,
    the token set is wrong.
11. **The page never scrolls horizontally.** Wide content scrolls in its own
    container. Asserted by test at 360px.
12. **Loading is derived, never stored.** Each result carries the request key it
    was fetched for; loading is "the key I hold is not the key I want". Storing
    a flag means setting it synchronously in an effect, which cascades renders.
13. **Browser state is read with `useSyncExternalStore`**, not with an effect
    that calls setState on mount.
14. **Anything placed on a photographic surface pins its own ink.** Those
    surfaces are dark in BOTH themes; following `--text` renders near-black on a
    dark photograph in light mode.

## Fault capture

A failure carries its own diagnosis, or it is not finished.

```
what    the user-facing sentence, no jargon
why     the mechanism, so a fix targets the cause
action  a concrete step naming a screen, a field or a file
```

Registered in `core/errors.py`. The UI renders `what` and `action`; `why` sits
behind a disclosure for whoever is debugging. Every response carries an
`X-Trace-Id` matching a line in `logs/coinfold.log`.

**Read the log before forming a theory.** It caught the idempotent-replay bug in
this build by naming the exact line, with no guessing involved.

## Static analysis runs before tests

`ruff check` runs first and blocks the suite, both locally and in CI. The rule
set is deliberately narrow and bug-driven — `F` (undefined names, the Python
equivalent of `no-undef`), `B`, `S` (injection, weak crypto), `DTZ` (naive
datetimes), `ASYNC`, `T20`. A linter reporting 400 style complaints gets
ignored, and then it catches nothing on the day it matters.

---

## How this project actually fails

Real failure modes, in the order they have bitten.

### 1. A failure path added without its diagnosis

**Symptom:** a 500 with `INTERNAL_UNEXPECTED`.
**Cause:** a branch that returns a differently-shaped result — the idempotent
replay path returned no `balance`, and the route needed one.
**Where to look:** `logs/coinfold.log`, filter `level=ERROR`. The traceback
names the line.
**Prevention:** the smoke suite exercises failure paths, not just happy ones.

### 2. CORS origin mismatch

**Symptom:** sign-in fails with a preflight error; the API log shows nothing,
because the request never arrived.
**Cause:** `ALLOWED_ORIGINS` does not exactly match the frontend origin.
`localhost` and `127.0.0.1` are different origins; so are `http` and `https`.
**Where to look:** the browser console, not the server log.

### 3. The database is paused or asleep

**Symptom:** `DB_UNAVAILABLE`, or a ~50s first request.
**Cause:** Supabase pauses idle free projects; Render idles a free service after
15 minutes.
**Fix:** the keep-warm workflow — but mind the 750-hour **per-workspace** quota
in `docs/DEPLOY.md`.

### 4. A chart disagreeing with the table beneath it

**Cause:** a filter added to one code path and not the other.
**Prevention:** both go through `_where()`. If you add a filter, add it there
and nowhere else.

### 5. A layout that only breaks at one width

**Symptom:** horizontal page scroll.
**Cause:** most recently, chapter scrims with negative insets escaping a
container that was no longer clipping them.
**Prevention:** the render suite asserts `scrollWidth <= clientWidth` at six
widths in both themes. It has caught this twice.

### 6. Third-party branding in stock photography

**Symptom:** another company's logo in your hero.
**Cause:** stock photographs of "credit cards" very often show real cards. Two
candidates got as far as being downloaded before review caught a VISA Infinite
card with an XP Investimentos logo, and a GENTCREATE wallet.
**Prevention:** look at every image before shipping it. `scripts/fetch_images.py`
records each source URL so a questionable asset can be traced and replaced.

### 7. Reading an animated figure mid-flight

**Symptom:** a test asserts on a number that is still counting up.
**Cause:** the coin HUD animates to its value over ~700ms.
**Prevention:** poll until two consecutive reads agree.

---

## Extending it

- **A new filter:** add it to `TransactionFilters`, `_where()`, `transaction_filters()`,
  the `Query` reducer, and `FilterBar`. Adding it anywhere less than all five
  makes the charts and table disagree.
- **A new failure:** register it in `FAULTS` first. The code will not let you
  raise it otherwise.
- **A new column:** the table folds columns by breakpoint. A seventh column
  needs a decision about what it displaces at 768px, not just a `<th>`.
- **A schema change:** add `db/migrations/002_*.sql`. Never edit `001`; the seed
  applies every file in order and CI asserts the resulting row counts.
