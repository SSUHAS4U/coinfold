-- ============================================================================
-- Coinfold — initial schema
-- Target: PostgreSQL 18 (16+ compatible; nothing here needs 17/18-only syntax)
--
-- Design notes that matter (the "why", expanded in docs/DECISIONS.md):
--
--  * Money is NUMERIC(14,2), never float. The source feed carries floats and a
--    few numeric strings; both are coerced at ingest, once, at the boundary.
--  * The feed's `id` is NOT unique (40 collisions in 10,000 rows), so it cannot
--    be the primary key. We keep a surrogate BIGINT key and record the source id
--    plus its ordinal position in the file, which together are unique.
--  * Category is a real FK to a lookup table, not a free-text column. 250 source
--    rows have no usable category (null, "", or the key absent); they point at
--    the 'uncategorised' row so the read path never needs a LEFT JOIN.
--  * Every row the loader had to repair is recorded in ingest_anomaly with the
--    original value, so a reviewer can audit exactly what was changed and why.
--    Fault capture is part of the schema, not a log line.
--  * Coins live in an append-only ledger. A balance is SUM(delta), never a
--    mutable counter, so a wrong balance can always be explained by the entries
--    that produced it.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram index for merchant search
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE category (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug        TEXT     NOT NULL UNIQUE,
    label       TEXT     NOT NULL,
    -- Lets the UI colour a category identically in every chart, chip and row.
    accent_hue  SMALLINT NOT NULL CHECK (accent_hue BETWEEN 0 AND 360),
    is_fallback BOOLEAN  NOT NULL DEFAULT FALSE
);

COMMENT ON COLUMN category.is_fallback IS
    'True for the single synthetic row absorbing source rows with no category.';

-- Exactly one fallback category may ever exist.
CREATE UNIQUE INDEX category_one_fallback ON category ((TRUE)) WHERE is_fallback;

CREATE TABLE merchant (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT     NOT NULL UNIQUE,
    -- Lower-cased, whitespace-collapsed form used for case-insensitive search.
    search_name TEXT     NOT NULL
);

-- Trigram index backs "search merchants as you type" without the leading-wildcard
-- sequential scan a plain LIKE '%foo%' would force.
CREATE INDEX merchant_search_trgm ON merchant USING GIN (search_name gin_trgm_ops);

CREATE TYPE payment_status AS ENUM ('SUCCESS', 'PENDING', 'FAILED');
CREATE TYPE payment_method AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'NETBANKING');

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE app_user (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT      NOT NULL UNIQUE,
    display_name  TEXT        NOT NULL CHECK (length(btrim(display_name)) > 0),
    -- Argon2id digest. Never a reversible encoding, never logged.
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

CREATE TABLE transaction (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          UUID         NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,

    -- The feed's own id. NOT unique on its own: 40 values repeat in the file.
    source_id        TEXT         NOT NULL,
    -- Zero-based position in the source array. Makes every row addressable and
    -- gives the duplicate source_ids a stable tiebreak.
    source_row_index INTEGER      NOT NULL,

    occurred_at      TIMESTAMPTZ  NOT NULL,
    merchant_id      SMALLINT     NOT NULL REFERENCES merchant(id),
    category_id      SMALLINT     NOT NULL REFERENCES category(id),
    amount           NUMERIC(14,2) NOT NULL,
    currency         CHAR(3)      NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    status           payment_status NOT NULL,
    method           payment_method NOT NULL,

    -- True when the loader judged this row unfit for analytics: a sentinel
    -- amount, or a value so far outside the distribution that including it
    -- would flatten every chart axis. Excluded from charts by default; still
    -- visible in the table so nothing is silently hidden from the user.
    is_anomalous     BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Coins this row earned, materialised at ingest. Derived from amount and
    -- status via the rules in reward_rule; stored so the table read path never
    -- recomputes it per request.
    coins_earned     INTEGER      NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),

    CONSTRAINT transaction_source_row_unique UNIQUE (user_id, source_row_index)
);

COMMENT ON COLUMN transaction.amount IS
    'Signed. Negative values are refunds/reversals present in the source feed.';

-- Read-path indexes. The dashboard's default view is "this user, newest first",
-- and every filter narrows from there.
CREATE INDEX transaction_user_time_desc
    ON transaction (user_id, occurred_at DESC, id DESC);

CREATE INDEX transaction_user_amount
    ON transaction (user_id, amount, id);

-- Supports category / status / method filters combining with the date window.
CREATE INDEX transaction_user_facets
    ON transaction (user_id, category_id, status, method, occurred_at DESC);

CREATE INDEX transaction_merchant
    ON transaction (user_id, merchant_id, occurred_at DESC);

-- Analytics scan only the rows charts are allowed to see.
CREATE INDEX transaction_analytics
    ON transaction (user_id, occurred_at)
    WHERE NOT is_anomalous AND status = 'SUCCESS';

-- ---------------------------------------------------------------------------
-- Ingest fault capture
-- ---------------------------------------------------------------------------

CREATE TYPE anomaly_kind AS ENUM (
    'TIMESTAMP_NON_ISO',      -- epoch millis, DD/MM/YYYY, date-only, or offset form
    'AMOUNT_NOT_NUMERIC',     -- arrived as a JSON string
    'AMOUNT_NEGATIVE',        -- refund / reversal
    'AMOUNT_OUT_OF_RANGE',    -- sentinel or implausible magnitude
    'CATEGORY_MISSING',       -- null, empty string, or key absent
    'STATUS_CASE_MISMATCH',   -- 'success' rather than 'SUCCESS'
    'DUPLICATE_SOURCE_ID'     -- source id already seen earlier in the file
);

CREATE TABLE ingest_anomaly (
    id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id BIGINT       REFERENCES transaction(id) ON DELETE CASCADE,
    source_row_index INTEGER    NOT NULL,
    kind           anomaly_kind NOT NULL,
    -- The value exactly as it appeared in the feed, so the repair is auditable.
    original_value TEXT,
    -- What the loader wrote instead, and the rule it applied.
    resolution     TEXT         NOT NULL,
    detected_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ingest_anomaly_kind ON ingest_anomaly (kind, source_row_index);

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------

-- Accrual rules live in a row, not a constant in Python, so the API can explain
-- the number it shows the user and the rule can change without a redeploy.
CREATE TABLE reward_rule (
    id                   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rupees_per_coin      NUMERIC(10,2) NOT NULL CHECK (rupees_per_coin > 0),
    max_coins_per_txn    INTEGER  NOT NULL CHECK (max_coins_per_txn > 0),
    effective_from       DATE     NOT NULL,
    is_active            BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX reward_rule_one_active ON reward_rule ((TRUE)) WHERE is_active;

CREATE TABLE reward (
    id           SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug         TEXT     NOT NULL UNIQUE,
    title        TEXT     NOT NULL,
    description  TEXT     NOT NULL,
    coin_cost    INTEGER  NOT NULL CHECK (coin_cost > 0),
    -- Rupee value the user receives, shown so the exchange rate is legible.
    rupee_value  NUMERIC(10,2) NOT NULL CHECK (rupee_value > 0),
    -- NULL means unlimited stock. 0 means sold out.
    stock        INTEGER  CHECK (stock IS NULL OR stock >= 0),
    is_active    BOOLEAN  NOT NULL DEFAULT TRUE,
    sort_order   SMALLINT NOT NULL DEFAULT 0
);

CREATE TYPE ledger_reason AS ENUM ('EARN', 'REDEEM', 'REDEEM_REVERSAL', 'ADJUSTMENT');

-- Append-only. Never UPDATE, never DELETE. Balance is the sum of delta.
CREATE TABLE coin_ledger (
    id             BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        UUID          NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    -- Positive credits coins, negative debits them. Never zero: an entry that
    -- moves nothing is a bug, not a record.
    delta          INTEGER       NOT NULL CHECK (delta <> 0),
    reason         ledger_reason NOT NULL,
    transaction_id BIGINT        REFERENCES transaction(id) ON DELETE CASCADE,
    redemption_id  BIGINT,  -- FK added after redemption exists (mutual reference)
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- An EARN entry must name the transaction it came from; a REDEEM entry must
    -- name its redemption. This is what makes the balance explainable.
    CONSTRAINT coin_ledger_earn_has_txn
        CHECK (reason <> 'EARN' OR transaction_id IS NOT NULL),
    CONSTRAINT coin_ledger_redeem_has_redemption
        CHECK (reason NOT IN ('REDEEM', 'REDEEM_REVERSAL') OR redemption_id IS NOT NULL),
    CONSTRAINT coin_ledger_earn_is_credit
        CHECK (reason <> 'EARN' OR delta > 0),
    CONSTRAINT coin_ledger_redeem_is_debit
        CHECK (reason <> 'REDEEM' OR delta < 0)
);

-- One EARN entry per transaction, enforced by the database rather than by hoping
-- the seed script is never run twice.
CREATE UNIQUE INDEX coin_ledger_one_earn_per_txn
    ON coin_ledger (transaction_id) WHERE reason = 'EARN';

CREATE INDEX coin_ledger_user ON coin_ledger (user_id, created_at DESC, id DESC);

-- Covering index so the balance sum is an index-only scan.
CREATE INDEX coin_ledger_balance ON coin_ledger (user_id) INCLUDE (delta);

CREATE TYPE redemption_status AS ENUM ('CONFIRMED', 'REVERSED');

CREATE TABLE redemption (
    id              BIGINT            GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID              NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    reward_id       SMALLINT          NOT NULL REFERENCES reward(id),
    -- Cost captured at redeem time. If the catalogue price later changes, the
    -- historical record still shows what the user actually paid.
    coin_cost       INTEGER           NOT NULL CHECK (coin_cost > 0),
    status          redemption_status NOT NULL DEFAULT 'CONFIRMED',
    -- Client-supplied. Makes retrying a redeem safe: a repeat of the same key
    -- returns the original redemption instead of charging the user twice.
    idempotency_key UUID              NOT NULL,
    voucher_code    TEXT              NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),

    CONSTRAINT redemption_idempotent UNIQUE (user_id, idempotency_key)
);

ALTER TABLE coin_ledger
    ADD CONSTRAINT coin_ledger_redemption_fk
    FOREIGN KEY (redemption_id) REFERENCES redemption(id) ON DELETE CASCADE;

CREATE INDEX redemption_user ON redemption (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Balance view
-- ---------------------------------------------------------------------------

CREATE VIEW coin_balance AS
SELECT u.id                                  AS user_id,
       COALESCE(SUM(l.delta), 0)::BIGINT     AS balance,
       COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::BIGINT AS lifetime_earned,
       COALESCE(-SUM(l.delta) FILTER (WHERE l.delta < 0), 0)::BIGINT AS lifetime_spent
FROM app_user u
LEFT JOIN coin_ledger l ON l.user_id = u.id
GROUP BY u.id;

COMMIT;
