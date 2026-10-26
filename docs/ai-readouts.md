# AI readouts

One friend-style paragraph **per event**, not per subscriber. Cached by `{ type, resort|region, pulse, snapshot hash }`.

## Writer

`lib/readout.js`

1. `gatherFacts(event)` calls the shared tools:
   - resort: `get_resort_snow`, `get_storm_status`, `get_snow_history`, `get_resort_forecast`
   - region: `get_leaderboard`
   - trip: `plan_trip_snapshot`
2. If Gateway auth exists, `ToolLoopAgent` (≤3 steps, `openai/gpt-5.4-mini`) may call those tools again and write 1–3 sentences.
3. `validateReadout(text, facts)` — **every number in the text must appear in the facts JSON**. Invented numbers → reject.
4. On reject, Gateway error, or no auth: `deterministicReadout` template. `console.info('[skiscope-readout] gateway unavailable, deterministic template')`.

Subjects look like `Situation detected: Mammoth just got 4"`.

## Preview

```
npm run email:preview
```

Writes `tmp/email-preview/storm-alert.html` (current writer) and `storm-alert-template.html` (forced template). `/api/email/preview?type=alert|template|region|recap` is render-only.

## Consolidation

Many subscriptions per email → `consolidateAlerts` → **one** send per window. Combined template lists each event’s readout.

Email stays paused (`EMAIL_ALERTS_ENABLED=false`).
