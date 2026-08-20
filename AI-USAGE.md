# AI usage

## Tools

| Tool | Where |
|---|---|
| **Claude (Opus)** in Claude Code | Most of the implementation: schema, ingest, API, React components, tests. |
| **Context7 MCP** | Fetching current library docs instead of trusting the model's memory. This caught a real bug — see #2. |
| **Playwright MCP** | Driving the real browser to screenshot and measure the UI, and to open the reference sites. |
| **Magic MCP (21st.dev)** | Searching component registries before building anything from scratch. |

**How it was used:** the data profiling, schema design, and the concurrency
design of the redeem path were decided first and then implemented with AI doing
the typing. The dirty-data findings in `docs/ASSUMPTIONS.md` came from actually
profiling the file, not from asking a model what might be wrong with it.

Everything below is a real thing that went wrong in this build.

---

## 1. Confidently wrong about a library API — Recharts 3

The generated `MonthlyTrend` chart handled clicks like this:

```tsx
onClick={(state) => {
  const month = state?.activePayload?.[0]?.payload?.month;
  if (month) onSelectMonth(month as string);
}}
```

That is the Recharts **2.x** API, and it is what the model had learned.
Recharts 3 **removed `CategoricalChartState` from mouse handlers entirely**;
`activePayload` does not exist on the handler argument any more.

`tsc` caught it (`Property 'activePayload' does not exist on type
'MouseHandlerDataParam'`), and Context7 gave the actual v3 shape: the handler
receives `activeLabel`. Since `month` is the `XAxis` `dataKey`, `activeLabel`
*is* the month:

```tsx
onClick={(state) => {
  const month = state?.activeLabel;
  if (typeof month === "string" && month) onSelectMonth(month);
}}
```

**Lesson:** this compiled in the model's head and would have been a silent
no-op at runtime — clicking a month would simply have done nothing, with no
error. Typechecking caught it; checking the docs explained it. Neither was
optional.

## 2. A failure path shipped without its own error handling

The redeem endpoint's idempotent replay branch returned the stored redemption:

```python
if existing["reward_id"] == reward_id:
    return {**existing, "replayed": True}
```

It looked right and passed review. It 500'd on the first retry, because the
route logs and returns `result["balance"]` and the replay branch never computed
one. The end-to-end test caught it (`retry is idempotent` → `INTERNAL_UNEXPECTED`).

The fix was not just adding the key — it was noticing that the replay must
return the **current** balance, not the one from the original redeem. Returning
the historical figure would make a retry visibly roll the user's balance
backwards.

**Lesson:** the happy path was tested by the code that wrote it; the retry path
was not. This is why the smoke suite exercises failure paths — unaffordable
redeems, reused keys, unknown rewards — rather than just the working case. It
also justified `logs/coinfold.log`: the traceback named the exact line, so no
theorising was needed.

## 3. A regex that validated the shape and not the value

The timestamp normaliser matched the bare-date format and then parsed it:

```python
if _DATE_ONLY.match(text):
    day = date.fromisoformat(text)
```

`"2025-13-45"` matches `^\d{4}-\d{2}-\d{2}$` perfectly and is not a date.
`date.fromisoformat` then raised a bare `ValueError` that escaped the
normaliser's own error type, so a malformed row would have crashed the seed with
a stdlib traceback instead of a message naming the field and the row.

Caught by a parametrised test written specifically to feed junk in
(`test_unparseable_values_raise_rather_than_guess`). The slash-format branch had
the `try/except`; the date-only branch did not — a classic case of one of two
similar branches getting the careful treatment.

## 4. A palette that was correct by construction and wrong in practice

The generated category colours spaced ten hues evenly around the wheel and
assigned them in category order. Perfectly defensible, and the donut rendered as
a single blue-violet mass.

The reason only shows up against the real data: the four largest categories by
spend — Education (38.5%), Insurance (18.1%), Shopping (16.2%), Travel (8.7%) —
had landed on hues 266, 232, 292 and 196. All neighbours. Together they are 82%
of the chart.

Fixed by assigning hues by **share of spend** so the biggest slices are
furthest apart, and by leaving 150–185 empty because that is where the brand
accent lives and the accent must never be a data colour.

**Lesson:** this was invisible in the code and obvious in a screenshot. It is
the clearest argument for the rule that a UI claim without a measured render is
an unverified claim.

## 5. Two smaller ones

- **CORS.** The API allowed `http://localhost:3000`. The browser was on
  `http://127.0.0.1:3000`. Those are different origins, sign-in failed with a
  preflight error, and the same class of mistake breaks the deployed app when
  the Vercel URL is not in the allow-list. Both spellings are now allowed in
  development.
- **A zero-height centring bug.** The landing's scroll chapters were
  `absolute top-1/2 -translate-y-1/2` inside a parent whose children were all
  absolutely positioned — so the parent had no height and `top-1/2` centred
  against nothing. Only visible in a screenshot.

---

## What was not delegated

- **The dirty-data policy.** Whether to dedupe the 40 colliding ids, whether to
  impute the 200 missing categories, where to draw the implausible-amount line —
  each was decided by profiling the file and checking the evidence. The
  day-first timestamp reading in particular is *proven* (498 rows have a first
  component > 12, none have a second > 12), not assumed.
- **The redeem concurrency design.** Lock order, idempotency, conditional stock
  decrement, and the choice to fail closed.
- **The design direction.** Real reference sites were opened and screenshotted,
  and the decisions taken from each are recorded in `docs/UI_SPEC.md`.
