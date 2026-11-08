# Design tokens

Scoreboard mono: **one hue (oklch 255)** with chroma near zero, punched for contrast. The card’s **lightness is the data** on phone cards — more snow, lighter block.

Default theme is **dark**. `next-themes` follows the system when the user has not picked.

## Brief

Pass holders deciding where to ski. The board answers two questions with equal weight: **who actually got snow** (last 72h, observed or `est.`) and **who is about to** (next 7 days, modeled). The vernacular is the base-area snow report board and the snow stake.

## The one bold thing: the snow stake

Every snow number sits on a stake bar.

- **Solid** = snow that fell (actual). Lower opacity when the actual is a model estimate.
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
Phone (< 840px)                     Desktop (≥ 840px, max 1200px, centered)
[logo]                [≡]           [logo]      [ search ............ ]      [≡]
[ search ............. ]            Rank by [Actual 72h] [All regions] [Observed only]   Updated
Rank by [..] [regions]              ┌ 1  APPI Resort        24h   Last 72h      Next 7 days ┐
[Observed] Updated                  │    Hachimantai, Japan 0.1   8.6″ ▬▬▬▬▬   0.1″ ▨        │
┌ 1 Featured (full width) ┐         └──────────────────────────────────────────────────────┘
│ Last 72h     Next 7 days│              Resort      Region    Last 24h  Last 72h ↓  Next 7 days
│ 8.6″ ▬▬▬     0.1″ ▨     │          2   Niseko …    Japan        1.2″   6.9″ ▬▬▬    1″ ▨
└─────────────────────────┘          3   …
┌ 2 ……… ┐ ┌ 3 ……… ┐                    (rows stack-ranked; headers sort)
```

- **Desktop is a leaderboard table, not a card grid.** A 4-column grid reads rank order in a zigzag and scatters the numbers; a table lets the eye run straight down Last 72h or Next 7 days. The featured #1 row shares the table’s column template, so its numbers line up with the column below it (Playwright asserts this).
- **Phone stays compact 2-up cards** (3-up from 600px). Featured is one full-width row, never a screen-filler. No blank cells (`packCells`).
- Left-aligned text, right-aligned 24h figures, numbers left-aligned at their column start so the stake begins at the same x on every row.
- Resort page uses the same 1200px column: hero (name left, two-stat right), storm status as the only raised panel (with Alert me), then ruled sections on a 12-column grid: Next 7 days (7) | Today on the mountain (5), Radar (7) | Mountain Facts (5), Snow history (12).

## Shape

- Panels and cards: `--radius-card` 1.35rem. Pills: full. Stakes and bars: 2px. Table rows: square with hairline separators. Radius follows hierarchy, not one value everywhere.
- 44px minimum targets on phone; 32–36px controls on the desktop toolbar.

## Buttons

**Alert me** is the only filled (white) button. Everything else is outline or ghost, including the Observed only toggle (pressed = brighter outline + check).

## Motion

None on load. The radar loop is the only autoplay and it starts paused under `prefers-reduced-motion`.

## Notes for the next pass

- Tried: 4-column card grid on desktop (pass 5). Rejected: zigzag rank order, no column alignment.
- Tried: uppercase micro-labels on stats. Rejected: template tell, and they truncated at 320px.
- Phone cards keep lightness-by-snow; the desktop table drops it because the stakes already carry the amount.
