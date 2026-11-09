# Home board dump score

The home board is a single list. Default order is **highest last-72h proxy**. Forecast sits beside it with equal visual weight; it is not mixed into the rank.

**Last 72h is not recorded snowfall.** US rows use NRCS SNOTEL snow-**depth** (SNWD) peak-rise, or SWE×12 when the pillow did not rise. Compaction, wind, and melt change SNWD without new snow. Elsewhere last 72h is Open-Meteo `snowfall_sum` (`est.`). Resort-reported storm totals are not ingested.

## Formula

```
rank = past72h_proxy
tie-break = next7d_forecast, then name A–Z
```

| Leg | Window | Source | Shown as |
|---|---|---|---|
| `past72h` | Last 72 hours ending at the latest observation | **US:** NRCS SNOTEL SNWD **peak-rise** (SWE noise guard). If pillow depth did not rise but WTEQ did, convert SWE at 12:1 (`method: swe-slr`) — still not a snowfall gauge. **Elsewhere:** Open-Meteo `snowfall_sum`, labeled `est.` | Big number (`8″ last 72h` or `8″ last 72h est.`) |
| `next7d` | The next forecast days after today, up to 7 | Open-Meteo (MET Norway if `WEATHER_PROVIDER=metnorway`) | Equal column (`Next 7 days`) |

Inches = centimeters / 2.54. **Ranking uses last 72h only.** Never show the sum of last 72h + forecast as if it had already fallen.

### Ranking impact of the SNWD proxy

- A resort whose pillow **rose then settled** can rank above one that received similar snow but compacted in place.
- `swe-slr` (12:1) can over- or under-rank vs true snowfall; it only fires when SNWD did not rise.
- A **model-est** row with a large `snowfall_sum` can outrank a SNOTEL `0` (noise discarded or no depth rise). `est.` marks the model rows; SNOTEL-backed rows are not tagged `est.` even though they are still not recorded snowfall.
- Visible sort labels are **Last 72h** / **Last 24h** / **Next 7 days** (internal ids stay `actual72` / `actual24` / `forecast7d`). Ranking methodology is unchanged: last-72h proxy, forecast as tie-break only. The resort-page source line states the metric.

Cards (phone) and table rows (desktop) show **Last 72h** and **Next 7 days** with equal weight, each on a snow-stake bar: solid for last 72h, hatched for forecast, one shared scale. A compact **Rank by** control (Last 72h default, Last 24h, Next 7 days, Name) reorders the whole board; on desktop the column headers do the same. **All regions** filters the same list; modeled last-72h stays on the board with an `est.` tag. Layout tokens live in `src/lib/boardLayout.ts`; see [design-tokens.md](design-tokens.md).

## Tie-breaks (deterministic)

1. Higher next-7d forecast inches
2. Resort name A–Z

Implementation: `lib/dumpScore.js` (`dumpParts`, `compareDump`). Observed derivation: `lib/snotel.js`. Contract: `lib/data/observation.js`. Evals: `evals/dumpScore.mjs`, `evals/observed.mjs`, `evals/observation.mjs`. Playwright: `tests/board-order.spec.ts` (full list is monotonic).

## What this is not

- Not recorded snowfall (SNWD is depth; see NRCS citing notes)
- Not resort-reported storm totals (see `docs/data-sources.md`)
- Not a weighted or machine-learned rank
- Not season-to-date
- Not model hindcast on US resorts that have a SNOTEL map
