# AI search

Natural language on the board. Parser first. Tools second. LLM only if the Gateway is up.

## Flow

```
query
  → parseTripSentence  (always; Japan / California / Alps / Rockies / Colorado / Utah / Tahoe / PNW / Canada)
  → structured intent  { type, filters, pass, dates, metric, resort ids, party }
  → executeTool        get_leaderboard | get_resort_snow | plan_trip_snapshot
  → optional generateText refine when AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN
  → board: interpretation chip, ranked cards (actual + forecast chip), Clear / Back to all, context CTA
```

Gateway down → same parser + same tools. Fast. Logged.

## Intent types

| `type` | Example | Tool |
|---|---|---|
| `country` | Japan, Canada | `get_leaderboard` |
| `state` | California, Utah, Colorado, Tahoe | `get_leaderboard` |
| `region` | Alps, Rockies, PNW | `get_leaderboard` |
| `resort` | Niseko, Mammoth | `get_resort_snow` |
| `trip` | Deer Valley in April; Mammoth Dec 20–27 | `plan_trip_snapshot` |
| `ranking` | top snow in Colorado | `get_leaderboard` (`metric` from the phrase) |
| `compare` | Alta vs Snowbird | `compare_resorts` |

`metric`: `past72` / `next7` / `dump` / `std` / `vsavg`. Board rank can still use dump score; the **headline number is last 72h actual**.

## API

`POST /api/search` `{ text, pass, units }`  
`GET /api/search?q=Japan`

Cached by normalized query (~2 min). Rate limited. The browser `/api/agent` path still streams UI actions; both call the shared tool layer for snow.

## Context CTA

| Intent | Button |
|---|---|
| Region / country / state | Monitor the situation in Japan |
| Trip | Get alerts for your trip |
| Resort | Alert me |
| Home (no scope) | Monitor your home resort |

All of those open the **same** signup (resort / region / trip → email → double opt-in). Alert me is the only filled primary.
