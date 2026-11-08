# Home board dump score

The home board is a single list. Default order is **who actually got the most snow** in the last 72 hours. Forecast sits beside actual with equal weight; it is not mixed into the fallen total.

## Formula

```
rank = past72h_observed
tie-break = next7d_forecast, then name A–Z
```

| Leg | Window | Source | Shown as |
|---|---|---|---|
| `past72h` | Last 72 hours ending at the latest observation | **US:** NRCS SNOTEL snow-depth peak-rise (SWE noise guard). **Elsewhere:** Open-Meteo `snowfall_sum`, labeled `est.` | Big number (`8″ last 72h` or `8″ last 72h est.`) |
| `next7d` | The next forecast days after today, up to 7 | Open-Meteo (MET Norway if `WEATHER_PROVIDER=metnorway`) | Equal column (`Next 7 days`) |

Inches = centimeters / 2.54. **Ranking uses last 72h observed only.** Never show the sum of actual + forecast as if it had already fallen.

Cards (phone) and table rows (desktop) show **Last 72h** and **Next 7 days** with equal weight, each on a snow-stake bar: solid for fallen snow, hatched for forecast, one shared scale. A compact **Rank by** control (Actual 72h default, Actual 24h, Forecast 7d, Name) reorders the whole board; on desktop the column headers do the same. **All regions** and **Observed only** filter the same list. Layout tokens live in `src/lib/boardLayout.ts`; see [design-tokens.md](design-tokens.md).

## Tie-breaks (deterministic)

1. Higher next-7d forecast inches
2. Resort name A–Z

Implementation: `lib/dumpScore.js` (`dumpParts`, `compareDump`). Observed derivation: `lib/snotel.js`. Evals: `evals/dumpScore.mjs`, `evals/observed.mjs`. Playwright: `tests/board-order.spec.ts` (full list is monotonic).

## What this is not

- Not resort-reported storm totals (see `docs/data-sources.md`)
- Not a weighted or machine-learned rank
- Not season-to-date
- Not model hindcast on US resorts that have a SNOTEL map
