# Coinfold — UI specification

Written before the first line of UI code, from references actually opened and screenshotted, not
from memory. If this file and the code disagree, the code is wrong.

---

## Product references (project-scoped)

| Product | Why this one | Capture |
|---|---|---|
| **Wise** | The closest real product to what Coinfold is: consumer money movement, amounts as the hero, trust without stuffiness. | `refs/wise-home.png`, `refs/wise-rows.png` |
| **Groww** | The reference for dense Indian-fintech tables — the exact problem the 10k-row table poses. | `~/.claude/design-library/captures/groww-option-chain.png` |
| **Linear** | Dark-theme text hierarchy and long-form density without cards. | `~/.claude/design-library/captures/linear-method-dark.png` |
| **SpaceX** | Cinematic dark restraint: what "expensive" looks like when almost nothing is boxed. | `~/.claude/design-library/captures/spacex-starship.png` |

Registries opened: **21st.dev** (via Magic MCP search), **Aceternity** (tracing beam), **shadcn/ui**
(structure), **Magic UI** (counters).

---

## REFERENCE NOTES

Decisions, not colours. Each line names a source and the thing being replicated.

```
Source              What I am replicating
─────────────────────────────────────────────────────────────────────────────────
SpaceX hero         Nothing is in a box. Title sits directly on the canvas — no card,
                    no glass panel, no scrim rectangle.
SpaceX hero         EXACTLY ONE framed element per screen. Because it is the only
                    bordered thing, it reads as live instrumentation. In Coinfold
                    that one element is the coin balance HUD.
SpaceX hero         Two type sizes in the hero and no third competing.
SpaceX hero         Motion that carries data beats motion that decorates. The scroll
                    story animates real seeded figures, never abstract shapes.
SpaceX nav          Nav is plain text. No pills, no active underline, no hover fill.

Linear method       Near-black canvas (#08090A), not pure black, so white text does
                    not vibrate and elevated surfaces have somewhere to go.
Linear method       Three-step text ladder only: near-white / dim / faint. Emphasis
                    comes from weight and size, never from colour.
Linear method       Vertical rhythm carries the hierarchy: ~56-64px between a heading
                    and the next block, ~24px inside a block.
Linear method       Long-form content uses ZERO cards. A border appears only where two
                    different kinds of thing meet.
Linear method       Exactly one saturated element per view — the primary CTA.

Groww chain         ~64px row height. A financial table does not have to be cramped
                    to be serious.
Groww chain         No zebra striping, no heavy borders. One hairline per row;
                    whitespace does the separating.
Groww chain         Two-line cells: primary value on top, secondary beneath. Halves
                    the column count for the same information.
Groww chain         Column headers small, dim, sentence case — never bold uppercase.
                    Headers are labels, not content.
Groww index         The accent is brand/CTA ONLY, never a data colour. Success and
                    failure get their own pair. This is the single biggest fix for
                    "everything is the same colour".
Groww index         List rows: name left, value right, sub-value beneath the value,
                    hairline divider. NO card per row.
Groww index         Hero figure is large (~34px) semibold sans, NOT monospace. Mono is
                    for columns that must align, not for a single hero number.

Wise home           The one saturated element in a composition carries the verb.
Wise home           Ink on a saturated field is near-black, never white (white on
                    mint is ~1.9:1 and unreadable).
Wise rows           Amount pill: large figure with a small dim caption beneath saying
                    what it means. A bare number is data; a captioned one is a fact.
Wise rows           Feature rows: thin outlined circle icon, bold title, dim subtitle,
                    hairline divider. No card per row.

Aceternity beam     Scroll progress rail: a hairline path with all the visual energy
                    in the travelling head, not the track.
Aceternity beam     Beam length responds to scroll velocity, so it reads as a moving
                    object rather than a fill meter.
```

### What is deliberately NOT shown by default

- Ingest repairs on a row (behind the detail drawer).
- Payment method, source id, row ordinal (detail drawer only).
- The `999999999` sentinel is excluded from charts but stays visible in the table — hidden data is
  a lie, flagged data is a disclosure.

### Where the eye lands first

The coin balance, in the one framed element on the screen. Everything else was made quieter to
make that true.

---

## Tokens

Dark is the designed default. Light is a designed theme, not an inversion — its neutrals are warmer
and its accent is darkened to hold contrast on a light field.

### Colour roles

| Role | Dark | Light | Notes |
|---|---|---|---|
| `--bg` | `#08090A` | `#FCFCFD` | Near-black, never `#000`. |
| `--surface-1` | `#0E1012` | `#FFFFFF` | Panels. |
| `--surface-2` | `#15181C` | `#F7F8FA` | Raised: drawer, modal, hover. |
| `--surface-3` | `#1D2126` | `#EEF0F3` | Pressed, selected row. |
| `--border` | `#22262C` | `#E4E7EC` | Hairline. 1px, always. |
| `--border-strong` | `#31363E` | `#CFD4DC` | Focus rings, the one framed element. |
| `--text` | `#F2F4F7` | `#12141A` | Near-white, not `#FFF`. |
| `--text-dim` | `#98A0AE` | `#5A6474` | Secondary. |
| `--text-faint` | `#666E7C` | `#8A93A3` | Captions, headers, `—`. |
| `--accent` | `#5BE9B9` | `#0E9E77` | Brand + CTA + coins. **Never a data colour.** |
| `--on-accent` | `#04120E` | `#FFFFFF` | Near-black ink on the accent, per Wise/Groww. |
| `--success` | `#3DD68C` | `#0B8A50` | SUCCESS status only. |
| `--warning` | `#F5B544` | `#9A6206` | PENDING status only. |
| `--danger` | `#F0654E` | `#C33A22` | FAILED status. Warm red, not fire-engine. |

Category hues come from the database (`category.accent_hue`), so a category is the same colour in
every chart, chip and row. They are the **only** other colours on screen.

### Type

Geist Sans for everything; Geist Mono only where columns must align.

| Token | Size / line | Tracking | Used for |
|---|---|---|---|
| `display` | 88px / 0.92 | −0.04em | Landing hero only |
| `title` | 34px / 1.15 | −0.02em | Hero figures (semibold sans, not mono) |
| `heading` | 20px / 1.3 | −0.01em | Panel headings |
| `body` | 14px / 1.5 | 0 | Default |
| `label` | 12px / 1.4 | 0.02em | Column headers, captions |
| `mono` | 13px / 1.4 | 0 | Table numerics, `tabular-nums` |

### Spacing / radius / shadow / motion

```
space   4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
radius  card 14px · control 9px · pill 999px
shadow  1  0 1px 2px rgb(0 0 0 / .30)
        2  0 12px 32px rgb(0 0 0 / .45)
        + 1px inset top highlight on raised surfaces
motion  interaction 160ms · state 200ms · value 300ms
easing  cubic-bezier(.2, 0, 0, 1)   ← one curve, everywhere
        exit = 65% of enter duration
```

`prefers-reduced-motion` **disables** motion, not reduces it.

### Density

- Table rows: **64px** comfortable (Groww), dropping to 56px under `compact`.
- Panel padding: 24px. Gutters: 24px desktop, 16px phone.

---

## Component inventory

| Component | Source | Note |
|---|---|---|
| `DataTable` | **Hand-built** | The brief forbids a component library here. Sticky header, hairline rows, no zebra. |
| `Modal` | **Hand-built** | Focus trap, Escape, restore focus, scroll lock. |
| `Drawer` | **Hand-built** | Shares the Modal's focus-trap primitive. |
| `Button` / `Card` / `Chip` / `Stat` | Hand-built on tokens | Small enough that a library is overhead. |
| Charts | Recharts | Explicitly permitted. Colours come from `accent_hue`. |
| Icons | Lucide | SVG only. Zero emoji. |
| Counters | Hand-built | `requestAnimationFrame`, reduced-motion aware. |
| `AppShell` | Hand-built | Persistent sidebar from `lg`, drawer below it. |
| Scroll story | Hand-built | Photographs scaled, drifted and cross-faded by one scroll-progress value. |

### Photography

Sourced from Pexels at 2400px (`scripts/fetch_images.py`, which writes a
provenance manifest). Scrims are **directional and light** — roughly half a
typical hero's — so the images read as photographs rather than a grey wash.
Every image is reviewed for third-party branding before it ships.

## Verification gates

Screenshots at **360 / 414 / 768 / 1024 / 1280 / 1920**, both themes, asserting:

- `documentElement.scrollWidth <= clientWidth` at every width
- every interactive target ≥ 44×44 at phone widths
- the table scrolls inside its own container, never the page
- contrast ≥ 4.5:1 body text, ≥ 3:1 meaningful graphics, checked per theme
