<div align="center">

# Coinfold

**Pay the bill. Keep the change.**

A credit-card bill payment app: a transactions dashboard over 10,000 rows,
spend analytics, and reward coins you can actually spend.

</div>

---

## Live

| | |
|---|---|
| **Frontend** | https://coinfold.vercel.app |
| **Backend** | https://coinfold-api.onrender.com |
| **API docs** | https://coinfold-api.onrender.com/docs (OpenAPI, left on deliberately for reviewers) |

**Demo account** — also pre-filled on the sign-in form, so you are in with one click:

```
demo@coinfold.app
coinfold-demo-2026
```

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Charts | Recharts |
| Backend | Python 3.12, FastAPI, psycopg 3 |
| Database | **PostgreSQL 18** |
| Auth | Argon2id + JWT (short access token, refresh rotation) |
| Tests | pytest (unit), Playwright (render + behaviour), an end-to-end API smoke suite |

The transaction table is **hand-built** — no component library, per the brief.

---

## Run it locally

Under five minutes, including the seed. You need **Docker**, **Python 3.12+**
and **Node 20+**.

### 1. Postgres 18

```bash
docker run -d --name coinfold-pg -e POSTGRES_PASSWORD=coinfold_dev -e POSTGRES_DB=coinfold -p 55432:5432 postgres:18-alpine
```

### 2. Schema + seed — one command

```bash
cd apps/api && python -m venv .venv && ./.venv/Scripts/pip install -e ".[dev]" && DATABASE_URL="postgresql://postgres:coinfold_dev@localhost:55432/coinfold" ./.venv/Scripts/python -m coinfold.ingest.seed --reset
```

> On macOS/Linux use `.venv/bin/` instead of `.venv/Scripts/`.

That single command applies every migration, loads all 10,000 rows, records
every data repair, and mints the coin ledger — in one transaction, so a failure
leaves the database untouched. It prints what it had to repair:

```
  loaded 10,000 transactions

  repairs made during ingest:
    TIMESTAMP_NON_ISO         4,524
    CATEGORY_MISSING            200
    AMOUNT_NEGATIVE             148
    DUPLICATE_SOURCE_ID          40
    STATUS_CASE_MISMATCH         25
    AMOUNT_NOT_NUMERIC           20
    AMOUNT_OUT_OF_RANGE           1

  coin ledger: 8,651 EARN entries, balance 362,629
  date range:  2025-06-30 to 2026-07-15
```

### 3. API

```bash
cd apps/api && cp .env.example .env && ./.venv/Scripts/python -m uvicorn coinfold.main:app --port 8000
```

Fill `.env` first — `DATABASE_URL` and a 32+ character `JWT_SECRET`. The app
**refuses to start** on a missing or placeholder secret rather than running on a
guessable one.

### 4. Web

```bash
cd apps/web && npm install && echo "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000" > .env.local && npm run dev
```

Open **http://localhost:3000**.

---

## What the data actually looks like

The supplied feed is dirty, deliberately. Profiled across all 10,000 rows:

| Issue | Count | How it is handled |
|---|---|---|
| Timestamp formats | **5 distinct** | All parsed to `TIMESTAMPTZ`. The `DD/MM/YYYY` form is **proven** day-first: 498 rows have a first component > 12, none have a second > 12. |
| Duplicate `id` | **40** | Kept. All 40 groups have genuinely different merchants, dates and amounts — distinct payments that collided on a label, so `id` is not the primary key. |
| Missing category | **200** | **Imputed from the merchant.** No merchant in the feed ever spans two categories, so the mapping is exact rather than a guess. |
| `status` casing | **25** | `success` → `SUCCESS`. Silently breaks filters *and* coin accrual if missed. |
| String amounts | **20** | `"5065.00"` → `NUMERIC(14,2)`, via `str()` so no float error reaches a money column. |
| Negative amounts | **148** | Kept as refunds. Earn no coins, excluded from spend, totalled separately. |
| Sentinel amount | **1** | `999999999.0` — flagged, kept visible in the table, excluded from every chart. |

Every repair is written to `ingest_anomaly` with the original value, and is
visible in each row's detail drawer. Nothing was changed silently.

Full reasoning: [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

---

## Done

**Core**

- [x] All 10,000 rows: filter (category, date range, amount range, status, method — combinable), search-as-you-type, sort by date and amount. **All server-side.**
- [x] Two charts: category breakdown and monthly trend.
- [x] Rewards: always-visible balance, six-item catalogue, select → confirm → done.
- [x] Backend rejects invalid, unaffordable and out-of-stock redeems with proper status codes.
- [x] PostgreSQL 18, real schema, one-command seed.

**Nice-to-have**

- [x] **Two-way cross-filtering** — chart clicks filter the table, table filters reshape the charts. Both read the same filter object.
- [x] Server-side pagination, filtering and sorting.
- [x] Optimistic balance with rollback to the exact prior value on failure.
- [x] Hand-built modal: focus trap, Escape, focus restoration, scroll lock.

**Bonus**

- [x] Authentication (Argon2id, JWT, per-user data scoping).
- [x] **Idempotent redeem** — retry after a dropped response returns the original instead of charging twice.
- [x] 62 unit tests, 82-check API smoke suite, 23 Playwright render/behaviour tests.
- [x] Accessibility: semantic table with `aria-sort`, keyboard-operable rows, visible focus, 44px touch targets, colour never the sole signal.
- [x] Light and dark themes, both designed.
- [x] Scroll-driven landing page.

## Not done
## Not done

- **Walkthrough video** is optional because the frontend and backend are deployed; see the submission notes in [`docs/DEPLOY.md`](docs/DEPLOY.md) if one is still desired.

## Known issues

- **Free-tier cold start.** Render idles a free service after 15 minutes; the first request then takes ~50s. `.github/workflows/keep-warm.yml` prevents it — but Render's 750 hours are **per workspace, not per service**, so only one free service can be kept warm. Details in [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Tokens live in `sessionStorage`**, readable by any script on the origin. An httpOnly cookie is stronger; the trade-off is argued in [`docs/DECISIONS.md`](docs/DECISIONS.md).
- **Deep pagination is `OFFSET`-based.** Correct at 10,000 rows; would need keyset at a million.
- **The particle canvas draws 10,000 points.** Smooth on a laptop; on a low-end phone it is the heaviest thing on the landing page. It is disabled entirely under `prefers-reduced-motion`.

---

## Tests

```bash
cd apps/api && ./.venv/Scripts/python -m ruff check coinfold tests && ./.venv/Scripts/python -m pytest
```

Lint runs **before** the tests and blocks them. A syntax check does not catch a
name borrowed from another function's scope — that is valid code, it parses, and
it only fails when the line runs.

```bash
python scripts/smoke_api.py
```

82 end-to-end checks against a running API: the happy path, and every failure
path — unaffordable redeem, unknown reward, reused idempotency key, backwards
filter range, SQL injection in the sort parameter, oversized page.

```bash
cd apps/web && npx playwright test
```

Render verification at 360 / 414 / 768 / 1024 / 1280 / 1920, both themes,
asserting no horizontal page scroll, 44px touch targets, focus trapping, and
that the table scrolls inside its own container.

---

## Docs

| File | What it holds |
|---|---|
| [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) | Product calls, and every dirty-data decision with its evidence |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Technical choices, and the conditions under which each would flip |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | File-by-file map, invariants, and this project's real failure modes |
| [`docs/UI_SPEC.md`](docs/UI_SPEC.md) | Design tokens and the reference notes the UI was built from |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Deployment, and the Render free-tier quota that shapes it |
| [`AI-USAGE.md`](AI-USAGE.md) | Which tools, where, and five real things they got wrong |
