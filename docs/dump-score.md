# Home board dump score

The home board is a single list ordered by **who is getting dumped on** — recent snow plus snow still coming. There are no Recent / Incoming tabs and no time-window chips.

## Formula

```
scoreIn = past72hIn + next7dIn
```

| Leg | Window | Source |
|---|---|---|
| `past72h` | Today and the two previous snapshot days (inclusive 3 days) | Open-Meteo `snowfall_sum` already observed in `snow.json` |
| `next7d` | The next forecast days after today, up to 7 | Same snapshot, days after `snow.today` |

Inches = centimeters / 2.54. **Ranking uses the combined score.** The hero number on each card is **fallen snow only** (past 72h), labeled `8″ last 72h`. Forecast is a separate accent chip (`+3″ coming`). Never show the sum as if it had already fallen.

A quiet line above the board reads **Ranked by last 72h + next 7 days**.

## Tie-breaks (deterministic)

1. Higher next-7d inches
2. Higher past-72h inches
3. Resort name A–Z

Implementation: `lib/dumpScore.js` (`dumpParts`, `compareDump`). Evals: `evals/dumpScore.mjs`.

## What this is not

- Not resort-reported storm totals
- Not a weighted or machine-learned rank
- Not season-to-date (last-7d is available on the snapshot if a card or storm-status line wants extra context)
