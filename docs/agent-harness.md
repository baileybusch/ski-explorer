# SkiScope agent harness

A small, readable first harness so Bailey can see every piece. Nothing here invents snow or booking URLs — tools wrap the same functions the map already uses.

```
browser agent bar
    │  POST /api/agent  { text, pass }
    ▼
api/agent.js
    1. rate limit (30 / 10 min / IP)
    2. deterministic parser  →  always
    3. if AI Gateway auth exists, ToolLoopAgent (≤4 steps)
    4. stream NDJSON: {type:status} … {type:done, mode, parsed, actions}
    ▼
App.applyActions
    setTrip / flyTo / showResorts / openResort / setWatchlist / …
```

If `/api/agent` is down (or you are on `vite` without `vercel dev`), the browser runs the same parser locally (`src/lib/agentClient.ts`).

## Files

| File | What it does |
|---|---|
| `lib/agent/parseTrip.js` | Gazetteer + date + people + pass parser. No LLM. Handles `spring break`, `this weekend`, `next week`, `this week`, `mar 7-14`, `for 5`, `2 adults 2 kids`, `from SAN`, and “storms heading for Utah”. |
| `lib/storms.js` | 72h forecast snowfall tiers (6/12/18″) from the snow snapshot. |
| `lib/weather.js` | On-demand Open-Meteo (40 min cache). List = small batches, no hourly. Opened resort = +48h hourly. |
| `lib/agent/tools.js` | AI SDK `tool()` wrappers: `search_resorts`, `get_snow`, `get_weather`, `find_storms`, `build_trip_links` (Google Flights first), `make_plan_prompt`, `get_watchlist` / `update_watchlist` (watchlist is client-side; tools return UI actions). |
| `lib/agent/runAgent.js` | `runDeterministic` always. `runLlm` only when `llmAvailable()`. Same `{ mode, parsed, actions }` shape either way. |
| `lib/agent/rateLimit.js` | In-memory 30 requests / 10 minutes / IP. Fluid Compute reuses isolates, so this slows casual abuse. Not a global quota. |
| `api/agent.js` | Public POST. Streams NDJSON. Email `/api/*` files are untouched. |
| `src/lib/agentClient.ts` | Fetch + apply stream; fall back to `parseTripSentence`. |
| `evals/cases.json` + `evals/run.mjs` | 18 sentences → expected trip state (includes Utah/Colorado/Japan storms). `npm run eval`. |

## Actions the UI understands

```json
{ "type": "setTrip", "trip": { "start": "2027-03-07", "end": "2027-03-14", "adults": 2, "kids": 3, "home": "SAN", "pass": "ikon" } }
{ "type": "flyTo", "kind": "region", "id": "japan" }
{ "type": "showResorts", "ids": ["niseko-hirafu", "…"], "title": "Japan" }
{ "type": "openResort", "id": "mammoth", "mode": "explore" }
{ "type": "setWatchlist", "add": ["alta"], "remove": [] }
{ "type": "setWatchOnly", "on": true }
{ "type": "setSort", "sort": "snow" }
{ "type": "setStorms", "on": true }
```

## Deterministic vs LLM

| | Deterministic | LLM |
|---|---|---|
| When | Always. Also the only path if Gateway auth is missing. | `AI_GATEWAY_API_KEY` **or** `VERCEL_OIDC_TOKEN` is set. |
| What it does | Regex + gazetteer + date phrases → actions. | Same parse first, then `ToolLoopAgent` may refine with tools (snow, search). If the model fails, keep parser actions. |
| Needs a key in the repo? | No. | No. Do not commit a key. |

On a deployed Vercel project, enable **Project Settings → Security → OIDC Federation**. The platform injects `VERCEL_OIDC_TOKEN` at runtime; the AI SDK talks to the [AI Gateway](https://vercel.com/docs/ai-gateway) with it. No new secret required.

Locally, either:

```
vercel link && vercel env pull
# or
export AI_GATEWAY_API_KEY=…   # from the Vercel AI Gateway dashboard — never commit
```

Optional: `AI_GATEWAY_MODEL` (default `openai/gpt-5.4-mini`).

If neither OIDC nor the key is present, `/api/agent` still works: it returns `mode: "deterministic"` and the bar flies the globe.

## Evals

```
npm run eval                 # parser only (must stay 18/18)
RUN_LLM=1 npm run eval       # also tries 3 LLM cases; does not fail the suite
```

Today is pinned in `evals/cases.json` (`2026-10-24`) so “this weekend” / “next week” stay stable.

## Rate limit

Public endpoint. 30 POSTs / 10 minutes / IP, then HTTP 429 + `Retry-After`. Isolated per serverless instance.
