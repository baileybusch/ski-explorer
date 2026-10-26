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

Inches = centimeters / 2.54. The hero number on each card is the combined total. The two legs stay visible as **Past 72h** and **Next 7d**.

## Tie-breaks (deterministic)

1. Higher next-7d inches
2. Higher past-72h inches
3. Resort name A–Z

Implementation: `lib/dumpScore.js` (`dumpParts`, `compareDump`). Evals: `evals/dumpScore.mjs`.

## What this is not

- Not resort-reported storm totals
- Not a weighted or machine-learned rank
- Not season-to-date (last-7d is available on the snapshot if a card or storm-status line wants extra context)
