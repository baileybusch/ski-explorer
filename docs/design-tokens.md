# Design tokens

Scoreboard mono: **one hue (oklch 255)** with chroma near zero, punched for contrast. The card’s **lightness is the data** on phone cards — more snow, lighter block.

Default theme is **dark**. `next-themes` follows the system when the user has not picked.

## Brief

Pass holders deciding where to ski. The board answers two questions with equal weight: **last 72h** (SNOTEL snow-depth rise in the US, or `est.` from the model — not recorded snowfall) and **who is about to** (next 7 days, modeled). The vernacular is the base-area snow report board and the snow stake.

## The one bold thing: the snow stake

Every snow number sits on a stake bar.

- **Solid** = last 72h (SNOTEL snow-depth peak-rise or model `est.`). Lower opacity when the number is a model estimate.
- **Hatched** = snow the model expects (forecast).
- Both share **one scale per view** (floor 6″), so bar lengths compare across rows and across actual vs forecast.

Everything else stays quiet: no second hue, no gradients, no hover lifts.

## Named palette

| Name | Hex | Role |
|---|---|---|
| Ink | `#08090b` | Ground, inverted type |
| Slate | `#16181c` | Quiet card, panels |
| Fog | `#c8ccd3` | Mid snow |
| Paper | `#f2f3f5` | #1 featured block (inverted) |
| Ice | `#8fa6ba` | Focus ring / accent only |
| Graphite | `#7a808a` | Secondary type |

## Type

- **Barlow Condensed 800** — every snow number. Tabular figures. The inch mark is set as a raised prime (`Unit` in `SnowSplit.tsx`), not a trailing baseline glyph.
- **Sora** — UI. Sentence case everywhere. No all-caps labels, no eyebrows above headings, no middle-dot meta strings.

Scale (px, from the classic typographic scale): 11 · 12 · 13 · 15 · 18 · 21/20 · 24 · 28 · 36 · 48 · 72. Snow numbers: 24 (table rows) · 28 (phone cards) · 36–48 (phone featured) · 72 (featured row and resort hero).

## Layout

Tokens live in `src/lib/boardLayout.ts` — retune there when a desktop sketch arrives.

```
Phone (< 720px, "compact")              Desktop (≥ 720px, "full"; ≥1100px Ask docks right)
[mark POWTRACKER]          [≡]          [mark] [ search ........ ] [≡]      │ Ask SkiScope
[ search .................. ]           Rank by [Actual 72h] [All]          │ compact prompts
[Actual 72h][All regions]               Resort          24h  ↓Last 72h  Next 7 days
Resort Updated 3h  ↓Last 72h  Next 7d   ▒1 APPI Resort    0.1  est 8.6▬▬   0.1 ▨ ▒│ chips…
▒1 APPI Resort      est 8.6″   0.1″▒     2 Niseko …       1.2  est 6.9▬    1   ▨  │
 2 Niseko Annupuri  est 6.9″   1″        3 …                                      │ [ask… (↑)]
 3 …   (8+ rows on an iPhone 13)
```

- **One leaderboard list everywhere.** Every resort is a full-width row: rank, name + region on the left, then fixed stat columns on the right. Phones and desktop share `BoardList`; only the column template changes (`list.compact` / `list.full`).
- **Columns never move.** Changing Rank by re-ranks rows (280ms FLIP, off under reduced motion) but the column template is fixed. The active column gets the bright number and bright header with the sort arrow; inactive numbers drop to 55% and their stakes to 45%.
- **Headers are sticky and tappable.** On phones the Actual header taps 72h ↔ 24h; on desktop each column header sorts. Right-aligned headers put the arrow on the left so the label's right edge meets the numbers.
- **#1 is only lightly featured**: 7% tint and semibold name, same row height as everyone else so re-rank FLIP does not jump. It shares the template so its numbers sit in the same columns.
- **Desktop Ask is a docked side panel** (≥1100px, `role="complementary"`, no close X). The search box focuses its input instead of opening a sheet.
- Resort page uses the same 1200px column: hero (name left, two-stat right), storm status as the only raised panel (with Alert me), then ruled sections on a 12-column grid: Next 7 days (7) | Today on the mountain (5), Radar (7) | Mountain Facts (5), Snow history (12).

## Shape

- Panels and cards: `--radius-card` 1.35rem. Pills: full. Stakes and bars: 2px. Table rows: square with hairline separators. Radius follows hierarchy, not one value everywhere.
- 44px minimum targets on phone; 32–36px controls on the desktop toolbar.

## Buttons

**Alert me** is the only filled (white) button. Everything else is outline or ghost. The home board does not have an Observed only filter; `est.` tags stay on modeled actuals, and source/coverage copy lives on the resort page.

## Motion

None on load. The radar loop is the only autoplay and it starts paused under `prefers-reduced-motion`. Board re-rank is a short FLIP slide, skipped under reduced motion. Home search ghosts fade and drift; they freeze while the user has typed a query and under reduced motion.

## Ask SkiScope (chat)

Subject: ski buddies trading "who's getting the most". The chat should look like the board answering back, not a generic assistant.

- **Third stake texture.** Solid = fell, hatched = forecast, **hollow outline = past-season average** (`.stake-history`). A historical average can never be mistaken for a forecast at a glance, and the caption always says "Historical average".
- **Answer first, evidence below.** The model's (or fallback's) sentence sits above the cards; cards are raised panels (`bg-card`, ring 10%) with a plain sentence-case caption ("Japan, ranked by actual 72h"). No bubbles on assistant text; the user's question is a small right-aligned bubble.
- **Ranked rows** reuse the leaderboard grammar: rank in Barlow, name (wraps to 2 lines) + region, then two equal columns with number and stake on one shared scale per answer. Sorted column header is brighter. Tap a row → resort page.
- **Footnote** per answer: sources and as-of date in 11px muted prose, no labels or dots.
- **Layout.** Phone: full-screen sheet, "‹ Board" back, composer pinned to the safe area. Desktop: 30rem right panel; at ≥1100px the board reflows beside it instead of being covered.
- **Buttons.** Send/stop are outline icon buttons; "See all N on the board" is ghost. Alert me stays the only filled white button.
- **Motion.** One moment only: the pending stake fills back and forth while the answer is on its way (off under reduced motion). No per-card entrances.

```
Phone                         Desktop ≥1100px
‹ Board   Ask SkiScope  New   ┌ board (reflowed) ──────┬ Ask SkiScope   New × ┐
            [question]         │                        │          [question] │
Answer sentence…               │                        │ Answer sentence…    │
┌ Japan, ranked by actual 72h ┐│                        │ ┌ ranked rows ─────┐│
│1 Name      8.6″▬   1″▨     ││                        │ └──────────────────┘│
└ See all 15 on the board ────┘│                        │ ┌ hollow month bars┐│
┌ Historical average by month ┐│                        │ footnote            │
│ ▯ ▯ ▯ ▯ ▯ ▯                 ││                        │ [ask…          (↑)] │
[Ask about snow…          (↑)]
```

## Brand

Everything brand-facing reads `lib/brand.js`: name, both wordmarks, logo mark id, page title, tagline, email sender name, favicon. `index.html` gets the default title + favicon at build time (Vite `brandHtml` plugin). `?brand=powtracker` (optionally `&wordmark=mixed`) swaps the brand in the browser only; internal links and URL rewrites carry the param. Server paths (emails, Resend sender) always use the default brand.

- **SkiScope mark**: monochrome mountain + flake.
- **PowTracker mark**: three ranked bars (the leaderboard), each wearing a domed cap of new snow, with a six-arm flake in the open corner. Caps solid, bars 40%, `currentColor` so it follows the slate theme. Bars and caps survive at 16px; the flake ticks resolve from ~32px. Favicon: `public/brand/powtracker.svg` (dark tile), mark alone: `powtracker-mark.svg`.
- **Wordmarks**: `caps` = Barlow Condensed 800, "POW" bright + "TRACKER" at 60% (matches the board's display face); `mixed` = Sora, bold "Pow" + medium "Tracker" at 60% for places condensed caps feel loud.

## Notes for the next pass

- Tried: 4-column card grid on desktop (pass 5). Rejected: zigzag rank order, no column alignment.
- Tried: 2-up phone cards (pass 9). Rejected: numbers didn't line up between cards, and the sort column couldn't stay put.
- Tried: uppercase micro-labels on stats. Rejected: template tell, and they truncated at 320px.
