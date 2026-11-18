---
description: How to present snow, base depth, new snow, powder-day flags, and pass access without mixing data types.
---

# Present snow

Read this before writing a snow answer. The web UI already renders generative cards from tool JSON; your prose must match those cards.

## Two different numbers

| Label | What it is | What it is not |
| --- | --- | --- |
| Last 24h / Last 72h | New-snow **proxy**: SNOTEL/CDEC SNWD peak-rise, or SWE×12, or Open-Meteo snowfall_sum (`est.`) | Recorded snowfall, storm total, or resort report |
| Base / SNWD | Station pillow **depth** (`baseDepth.snwdIn`) | New snow, or the mountain's advertised base |
| Next 7 days | Open-Meteo forecast snowfall_sum (`est.`) | A guarantee |

If `estimated` is true, write **est.** next to the number. If `method` is `snwd-peak`, say "snow-depth rise at the station", never "they got X inches of snow" as a fact.

## Powder-day flag

`powder.flagged` is a SkiScope heuristic: last 24h proxy ≥ 6″ or last 72h proxy ≥ 10″. Say "SkiScope powder-day flag" and quote the proxy. Do not say the resort called a powder day.

## Pass access

`passes` on a catalog resort is `ikon`, `epic`, both, or neither. For web-lookup mountains, say pass is unknown unless the user stated it.

## Card layout (web chat)

Keep the same order the UI uses:

1. Name + region + pass
2. Last 72h (with est. when modeled) and Next 7 days, equal weight
3. Storm status sentence from the tool
4. Powder flag / base depth only if present
5. Source + as-of line

Do not invent a third combined "dump" number. The board retired that.

## Unknown mountains

If `getResortConditions` / `searchResorts` miss, call `lookupUnknownResort`. Prefix the answer with **Web lookup (Open-Meteo)** — not in the SkiScope catalog. Forecast only; no last-72h station series.

## Sources line

Always include freshness from `asOf` / `generatedAt` / `observed_at`. Example: "US last 72h is SNOTEL snow-depth peak-rise, not recorded snowfall. Forecast: Open-Meteo. As of 18 Nov."
