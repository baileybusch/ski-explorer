# Home board dump score

The home board is a single list ordered by **who actually got the most snow** in the last 72 hours. Forecast is a chip, not the rank.

## Formula

```
rank = past72h_observed
tie-break = next7d_forecast, then name A–Z
```

| Leg | Window | Source | Shown as |
|---|---|---|---|
| `past72h` | Last 72 hours ending at the latest observation | **US:** NRCS SNOTEL snow-depth peak-rise (SWE noise guard). **Elsewhere:** Open-Meteo `snowfall_sum`, labeled `est.` | Big number (`8″ last 72h` or `8″ last 72h est.`) |
| `next7d` | The next forecast days after today, up to 7 | Open-Meteo (MET Norway if `WEATHER_PROVIDER=metnorway`) | Accent chip (`+3″ coming`) |

Inches = centimeters / 2.54. **Ranking uses last 72h observed only.** Never show the sum of actual + forecast as if it had already fallen.

A quiet line above the board reads **Ranked by last 72h observed**, plus **Updated X min ago**.

## Tie-breaks (deterministic)

1. Higher next-7d forecast inches
2. Resort name A–Z

Implementation: `lib/dumpScore.js` (`dumpParts`, `compareDump`). Observed derivation: `lib/snotel.js`. Evals: `evals/dumpScore.mjs`, `evals/observed.mjs`. Playwright: `tests/board-order.spec.ts` (full list is monotonic).

## What this is not

- Not resort-reported storm totals (see `docs/data-sources.md`)
- Not a weighted or machine-learned rank
- Not season-to-date
- Not model hindcast on US resorts that have a SNOTEL map
