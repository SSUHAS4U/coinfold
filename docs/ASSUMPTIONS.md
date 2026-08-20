# Assumptions

Product calls made where the brief was deliberately open, and the calls the
dataset forced. Each says what was decided and why, so a reviewer can disagree
with the decision rather than guess at it.

---

## The dataset

The feed is dirty on purpose. I profiled all 10,000 rows before designing the
schema; the counts below are measured, not estimated, and the seed re-derives
them on every run (`ingest_anomaly`).

### 1. `id` is not unique, so it is not the primary key

**40 values repeat.** I checked whether the collisions were duplicate records:
they are not. All 40 groups have genuinely different merchants, dates and
amounts — for example `TXN2025000336` is both a ₹3,133.69 ACT Fibernet bill and
a ₹655.81 McDonald's payment three weeks later.

**Decision:** keep both rows. They are distinct transactions that collided on a
label. The table uses a surrogate key plus `source_row_index` (position in the
file), which together are unique and let any row be traced back to the exact
line it came from. Deduplicating would have silently deleted 40 real payments.

### 2. Timestamps arrive in five formats

| Format | Rows |
|---|---|
| `2025-10-03T21:03:27Z` | 5,476 |
| `2026-03-25T06:08:03+05:30` | 1,961 |
| epoch milliseconds (`1768265109000`) | 1,007 |
| `12/10/2025 16:24:49` | 841 |
| `2025-07-03` | 715 |

**The slash format is day-first, and that is proven rather than assumed.** Of
the 841 slash rows, **498 have a first component greater than 12** and **zero
have a second component greater than 12**. A month-first reading would make 498
rows impossible dates.

**Decision:** all five parse to `TIMESTAMPTZ` in UTC. The two formats carrying
no offset (`DD/MM/YYYY` and bare dates) are anchored to **IST**, since every
merchant is Indian and every amount is INR. Bare dates land at 00:00 IST. The
UI renders in IST regardless of the viewer's timezone, so a payment made at
00:30 IST does not show as the previous evening to a European reviewer.

### 3. `status` has a casing inconsistency

**25 rows use lowercase `success`** alongside 8,775 `SUCCESS`.

**Decision:** normalise to upper case at ingest. This one is quietly dangerous:
an exact-match filter or a coin rule written against `'SUCCESS'` would skip
those 25 rows, under-reporting both the transaction count and the balance
without ever erroring.

### 4. 200 rows have no usable category — and they are recoverable

150 are `null` or absent, 50 are `""`. I checked whether the merchant could
supply the answer: **no merchant in the feed ever appears under two different
categories**, and all 200 category-less rows name a merchant seen elsewhere
with a category.

**Decision:** impute from the merchant. This is measured, not guessed — the
merchant determines the category exactly across all 10,000 rows. An
`Uncategorised` row still exists for safety, but nothing currently uses it. If
a future feed breaks the 1:1 property, that merchant is excluded from the map
and the row falls back rather than guessing.

### 5. 148 amounts are negative

**Decision:** keep them, as refunds and reversals. They are real events a user
should see on a statement, and deleting them would make the table disagree with
the source. They **earn no coins**, are excluded from "total spent", and are
totalled separately as "Refunded". The UI shows them in the success colour with
the explicit word *refund*, so colour is not the only signal.

### 6. One amount is `999999999.0`

The next largest genuine values are ₹742,350 and ₹518,900; the bulk of the data
tops out around ₹55,000. A ten-digit value is a sentinel, not a purchase.

**Decision:** kept and **flagged**, not deleted. It stays visible in the table
(hidden data is a lie; flagged data is a disclosure) but is excluded from every
chart and earns no coins. Including it would flatten every chart axis to a flat
line. The threshold is an explicit ₹10,00,000 ceiling, so ₹742,350 survives.

### 7. 20 amounts are JSON strings

`"5065.00"` rather than `5065.00`. Coerced to `NUMERIC(14,2)` at ingest via
`str()` first, so no float rounding error reaches a money column.

---

## Product decisions

### Coins

The brief says "one coin per ₹100 spent, capped per transaction" but does not
give the cap.

- **Cap: 100 coins per transaction (₹10,000 of spend).** Without a cap, a single
  ₹54,945 payment would mint 549 coins and dominate a balance built from
  thousands of small ones. 100 is round, easy to explain, and affects only the
  top few percent of payments.
- **Only `SUCCESS` accrues.** A pending payment may still fail and a failed one
  moved no money. It fails closed.
- **Rounded down.** ₹199.99 earns 1 coin, not 2.
- Rate and cap live in a `reward_rule` **row**, not a Python constant, so the
  API can explain the number it shows and the rule can change without a redeploy.

Seeded balance: **362,629 coins** from 8,651 earning transactions.

### Rewards catalogue

Six rewards, ₹100 to ₹1,000, at roughly ₹0.11–0.12 per coin with the rate
improving slightly at higher tiers — so redeeming higher is a real decision
rather than arithmetic indifference. Two carry unlimited stock, four are
limited, and one is seeded near sold-out so the out-of-stock path is visible
without having to drain it first.

### Redemption is irreversible in the UI

The API models `REVERSED` and the ledger supports `REDEEM_REVERSAL`, but no
endpoint exposes it. Reversal is a support action, not a self-service one.

### "Spend" means successful, positive, non-anomalous

Charts and the "Total spent" figure count only those rows. A failed payment
moved no money and a refund is not spending. Without this, the chart total and
the user's actual card statement would disagree.

### Every account gets its own copy of the data

The supplied dataset belongs to one demo user. A new signup gets its **own copy**
of the 10,000 rows and its own ledger. Showing a new account an empty dashboard
would demonstrate nothing; letting every account read one shared table would be
a data leak in anything real.

### Authentication was added, though the brief did not ask for it

The brief needs no auth. It was added because a per-user balance is meaningless
without it — "your coins" has to mean something. Argon2id, short-lived access
tokens, refresh rotation, and per-user scoping on every query.

Demo account, printed on the sign-in form so a reviewer is in with one click:

```
demo@coinfold.app  /  coinfold-demo-2026
```

### Dark theme is the default

Chosen deliberately as the designed state (see `docs/UI_SPEC.md`). A light
theme also exists and is genuinely designed rather than inverted — its accent is
darkened to hold 4.5:1 on a light field, where the dark accent would fail.

### Imagery

Photography is from **Pexels** (Pexels Licence: free for commercial use, no
attribution required). `scripts/fetch_images.py` fetches it and writes a
manifest recording every source URL, so asset provenance is auditable. No AI
image generation was available in this environment.
