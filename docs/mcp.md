# SkiScope MCP

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server. Streamable HTTP at `/api/mcp`. Same tools as on-site search and the alert/readout agents (`lib/skiscope-tools`). **No subscriber, email, or alert data.**

## Install

```
claude mcp add --transport http skiscope https://skiscope.vercel.app/api/mcp
```

Cursor / other clients: transport `http`, URL `https://skiscope.vercel.app/api/mcp`.

`GET /api/mcp` returns server info + the tool list (for humans and install checks).

Hobby is capped at 12 serverless functions. `/api/mcp`, `/api/search`, and `/api/data` rewrite to one function (`api/headless.js`). The public URLs stay the same.

## Tools

| Tool | Args | Notes |
|---|---|---|
| `search_resorts` | `query`, `country`, `region`, `state`, `pass`, `limit`, `units` | Fuzzy + gazetteer |
| `list_regions` | — | Japan, California, Alps, Rockies, Tahoe, PNW, Canada, … |
| `get_leaderboard` | `region` / `country` / `state` / `pass`, `metric`, `limit`, `units` | `metric`: `past72` `next7` `dump` `std` `vsavg` |
| `get_resort_snow` | `resort`, `units` | Headline is last-72h **actual**. Forecast is separate. |
| `get_resort_forecast` | `resort`, `days`, `units` | Daily snapshot |
| `get_storm_status` | `resort`, `units` | Quiet → Winding down |
| `get_snow_history` | `resort`, `units` | 24h / 72h / storm / season vs last-five same date |
| `compare_resorts` | `ids[]` (1–8), `units` | Side-by-side |
| `plan_trip_snapshot` | `resort`, `start`, `end`, `units` | Trip brief from the same facts |

`units` is `in` (default) or `cm`. Every result includes `meta.generatedAt`, `meta.source`, `meta.attribution`.

## Public JSON (optional)

Same tools without MCP:

```
GET https://skiscope.vercel.app/api/data?tool=get_leaderboard&region=japan&metric=past72&units=in
GET https://skiscope.vercel.app/api/data?tool=get_resort_snow&resort=mammoth
```

## Limits

- 30 calls / 10 minutes / IP (same bucket family as `/api/agent`)
- CORS `*`
- Tool results cached ~60s
- Snapshot is modeled Open-Meteo (or MET Norway if `WEATHER_PROVIDER=metnorway`). Not resort-reported totals.

## What this is not

Not a write API. Not a subscriber store. Not live radar. Not booking.
