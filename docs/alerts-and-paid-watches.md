# Alerts and paid trip watches

Email stays **paused** (`EMAIL_ALERTS_ENABLED=false`). The evaluator, templates, Alert me flow, and a disabled cron are in the repo. Nothing is sent.

## Current state (this PR)

| Piece | Status |
|---|---|
| `evaluateAlerts(rules, snowJson, now)` | Done. Pure. Threshold, window (24/48/72/168h), pass + region + saved, dedupe `{ruleId}\|{resortId}\|{pulseStart}\|{stormTier}`, quiet hours → `queued`, 12h cap. `rule.tier` is `free` or `paid` (hook only). |
| Storm alert + recap emails | Done. HTML + text, slate block cards, manage + one-click unsub. ≤2 outbound via `lib/links.js`. Deep link `/?resort=` or `/?view=incoming`. |
| `npm run email:preview` | Renders both from committed `snow.json` to `tmp/email-preview/`. `/api/email/preview?type=alert\|recap` is render-only. |
| Test send | `--send --to baileybusch@gmail.com` + `RESEND_API_KEY` only. Every other address is refused. Keys are never printed. |
| Alert me UI | Multi-step onboarding. Home has a bottom email signup (the only filled primary on home) that opens the same flow. Resort page has a full-width filled Alert me button under storm status — not a floating bar. |
| Accounts | No passwords. Email + signed link. Double opt-in, consent records, preference center. See [accounts-and-email-prefs.md](accounts-and-email-prefs.md). |
| Sponsor slot | Optional, off by default. Labeled **Sponsored** in alert + recap templates. Preview renders “Example sponsor”. |
| `?alerts=1` | Preview host (or localhost) only. Production ignores it. Preview POSTs write nothing and send nothing. |
| Cron | `vercel.json` → `/api/cron/alerts` daily `0 3 * * *` (Sunday evening PT ≈ recap window). Handler no-ops while the flag is false. Old `/api/cron/digest` still no-ops. |
| Subscribers | Blob `subs/<32-hex>.json` plus `prefs`. Magic-link tokens are signed and short-lived; they are not stored. |
| Payments | **Not built.** `tier` is a field. |

### Before real sends can turn on

1. **Sending domain** — buy one you control. `skiscope.vercel.app` is the app, not mail.
2. **Resend domain verification** — SPF + DKIM + DMARC. Set `RESEND_FROM` to `SkiScope <alerts@yourdomain>`. `RESEND_API_KEY` stays in Vercel env.
3. **Flag** — `EMAIL_ALERTS_ENABLED = true` in `public/config.js`.
4. **Cron** — already wired. On Pro, change the schedule to 6-hourly (`15 */6 * * *`) if you want faster dump alerts. Hobby is one daily tick.
5. **Allowlist first** — keep `DIGEST_ALLOWLIST=baileybusch@gmail.com` for the first live runs.
6. **Postal address** in the footer (CAN-SPAM) once a domain exists.

Do not enable sends without 1–2. Confirm + weekly recap + dump alerts will all go through the same `sendEmail` lock.

---

Bailey’s two references:

- **Mammoth dump alerts** — a free email when it actually snows. We already have the pieces for the snow half: Open-Meteo snapshot, share URLs `/?resort=&from=&to=&people=&mode=explore|plan`, and a paused Resend + Blob subscriber path.
- **Campnab-style paid watch** — the user sets criteria, pays, and an agent keeps checking. That is what would fund running the agent. Flight + lodging legs are the expensive, gated part.

This note is the shape, the limits, and the order of work. Nothing here is live.

---

## 1. Free tier: snowfall + location alerts

Think “Mammoth, 12″+ in the next 48h” — one email when the rule first trips, with buttons that open Explore / Plan already filled.

### Rule schema

One document per subscriber (or per rule if they follow several mountains). Fits next to the existing Blob `subs/<token>.json`.

```json
{
  "id": "rul_…",
  "email": "bailey@…",
  "status": "pending|active",
  "kind": "snow",
  "resorts": ["mammoth"],
  "region": null,
  "pass": "ikon",
  "minSnowIn": 12,
  "windowHours": 48,
  "side": "forecast",
  "units": "in",
  "freq": "on-trigger",
  "quiet": { "start": "21:00", "end": "07:00", "tz": "America/Los_Angeles" },
  "lastFired": null,
  "lastKey": null
}
```

| Field | Meaning |
|---|---|
| `resorts` / `region` / `pass` | Where. Region expands to the gazetteer list at check time. Cap ~30 ids, same as today’s subscribe. |
| `minSnowIn` | Threshold. Same 6 / 12 / 18 tiers the Storms chip already uses, plus a custom number. |
| `windowHours` | 24 / 48 / 72. Rolling sum of `snowfall_sum` in the Open-Meteo snapshot. |
| `side` | `forecast` (next N hours), `observed` (past N hours), or `either`. Observed is still **modeled** Open-Meteo, not a resort report — say so in the email. |
| `freq` | `on-trigger` (dump alert) vs the existing `daily` / `weekly` digest. |
| `quiet` | Do not send in this local window; queue until it opens. |
| `lastKey` | Dedupe, below. |

Reuse double opt-in, one-click unsubscribe, and `List-Unsubscribe` from `api/_lib.js`. Do not invent a second subscriber store.

### How the check job should run

Reuse the committed `public/data/snow.json` snapshot. Do **not** fan out a live Open-Meteo call per subscriber.

1. A scheduled job (Vercel Cron on Pro, or a Workflow step) loads the snapshot + active rules.
2. For each rule, `windowMetrics` / `stormForResort` already know how to sum the forecast slice. Same functions the Storms layer uses.
3. If the rolling sum ≥ `minSnowIn`, and the dedupe key is new, enqueue one email.

Refresh the snapshot first (`scripts/fetch_snow.py`) on its own cadence — today the worldwide run stays under the free hourly weighted-call budget by using a 2×2 grid + one center. The check job itself should be CPU + Blob only.

**Open-Meteo limits** ([terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing), read 2026-10-24):

- Free / open-access: **non-commercial only**. 600/min, 5,000/hour, 10,000/day, ~300k/month. One concurrent request per IP; more than five queued → HTTP 429. Shared egress (Vercel) can trip this earlier than a home IP.
- Charging for watches is **commercial use**. The free endpoint is then off-limits. Need the customer API (`customer-api.open-meteo.com` + key) before Stripe goes live.
- Paid plans are a monthly call budget, not per-call overages. Standard = 1M calls/mo commercial; Professional = 5M and unlocks historical/ensemble. Dollar/euro amounts sit in a Stripe embed, not the HTML table. Third-party transcriptions (e.g. [ki-syndikat, rechecked Aug 2026](https://www.ki-syndikat.de/tools/open-meteo/)) list **€29/mo Standard** and **€99/mo Professional**. Treat those figures as **likely, verify at checkout**.
- Attribution is required either way (CC BY 4.0).

A daily snapshot of ~158 resorts × a few points is fine on free while the product is unpaid. A 6-hourly refresh is also fine if it stays one batched job, not per-user live calls. Do not add an hourly firehose.

**Scheduler:**

- [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby = once per day, timing ±59 min, and Hobby is personal/non-commercial. Pro ($20/mo) = minute-level, which you want for 6-hourly. Each tick is a Function invocation (duration + CPU billed as usual).
- [Vercel Workflow](https://vercel.com/docs/workflow) is the better home if the job fans out, retries a failed Resend send, or waits on a snapshot refresh. Cron can still be the wake-up.

Digest cron `30 13 * * *` stays a no-op. The live wire is `/api/cron/alerts` daily at `0 3 * * *` (Sunday evening PT for recaps). Still a no-op while the flag is false.

### Dedupe so a storm emails once

Key, not a timer:

```
{ruleId}|{resortId}|{windowStart}|{tier}
```

`windowStart` is the first forecast day of the 72h (or 48h) pulse that crossed the threshold. Same storm, same email. A new pulse (gap of ≥1 day under 1″, then another 12″ window) may fire again. Digest `freq=daily|weekly` is a separate product and does not use this key.

Quiet hours: write `pendingSend` on the rule; the next tick after quiet ends sends it. Cap one send per rule per 12 hours as a belt.

### Email shape

Same dark shell as `digestEmail` in `api/_lib.js`. One storm card, not a top-10 digest.

- Subject: `❄ Mammoth — 14″ forecast in 48h`
- Body: resort, modeled amount, window start / peak / total (the storm timeline we already show in the sheet), “Open-Meteo forecast — not typical, not resort-reported.”
- Two buttons, already wired in `lib/links.js`:
  - Explore → `https://skiscope.vercel.app/?resort=mammoth&from=2026-12-20&to=2026-12-22&people=4&mode=explore`
  - Plan trip → same with `mode=plan`
- Footer: manage + one-click unsubscribe. Physical mailing address once a sending domain exists (CAN-SPAM).

Confirmation mail stays as-is (double opt-in, ignore if they did not ask).

### Unsubscribe

Keep GET + RFC 8058 POST on `/api/unsubscribe`. One click from the footer and from the mail client’s Unsubscribe button. Do not require a login. `List-Unsubscribe` / `List-Unsubscribe-Post` headers are already sent when `unsubscribeUrl` is set.

---

## 2. Paid “trip watch”

User pays. An agent (or a boring job plus a short LLM summary) keeps checking until the window closes.

### Criteria

```json
{
  "kind": "trip",
  "resort": "mammoth",
  "from": "2026-12-20",
  "to": "2026-12-27",
  "adults": 2,
  "kids": 2,
  "home": "SAN",
  "minSnowIn": 12,
  "windowHours": 48,
  "flightCeilingUsd": 450,
  "lodging": "any",
  "pass": "ikon"
}
```

Snow half = free-tier rule. The paid extras are a **price ceiling** on the outbound+return, a **lodging availability** hint, and an optional **go / wait** sentence.

### What is actually possible

| Need | Free / key-less | Paid / gated | Honest limit |
|---|---|---|---|
| Snow + weather | Open-Meteo snapshot we already ship | Customer API once you charge | Modeled, 7-day forecast horizon. After that we only have **typical** past-season averages — never sell those as a forecast. |
| Storm badges | `lib/storms.js` on the snapshot | same | 72h rolling sum, 6/12/18″. International = this only. |
| US watches/warnings | `api.weather.gov` (public domain) | — | US only; some alerts have no geometry. |
| Flights, deep link | Google Flights / Kayak / Skyscanner URLs in `lib/links.js` | — | No price. This is what Explore/Plan already do. |
| Flights, a number | **Not possible key-less.** | See below | Do not scrape Google Flights. |
| Lodging, pins | OSM Overpass (names, no prices, no rooms) | — | Already in the lodging layer. |
| Lodging, availability | **Not possible key-less.** | Booking Affiliate / Expedia EPS after approval | Airbnb has no public availability API we can use. |

**Flight price APIs (2026, verify before signing):**

- **Amadeus Self-Service** — shut down. Portal and keys disabled **17 July 2026** ([PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)). Enterprise contract only. Do not design around the old free quota.
- **Duffel** ([duffel.com/pricing](https://duffel.com/pricing), read 2026-10-24) — $3 / confirmed **order**, 1% managed content, $2 / paid ancillary, 1,500 searches per order then **$0.005** / extra search. Built for people who **sell tickets**. A watch that only *prices* and never books pays excess-search on every poll. KYC for live mode. Coverage is Duffel’s airline set, not a full GDS.
- **Travelpayouts / Aviasales Data API** — affiliate, cached (not live) calendar prices. Full Search API is gated (Travelpayouts support: projects below **50,000 MAU** are not considered). Fine later as a cached hint; not a booking source; not key-less.
- **Skyscanner Travel API** — application + traffic bar (their public copy asks for a product and rejects low-traffic / student projects). Not a walk-up key.
- **Google Flights** — deep links only. No public price API.

So: v1 paid watch should sell **snow + dates + party + a Google Flights button**. A “under $450” promise needs a flight API, a cache, and a lawyer-looking terms line (“indicative, not a fare guarantee”). Do not ship the ceiling until that exists.

**Lodging:** Booking.com Affiliate and Expedia Group Partner Solutions can return availability after approval. Both are commercial, contract, and usually need existing traffic. OSM will never tell you a room is open. VRBO/Expedia links we already emit are search URLs, not holds.

**Go / wait summary:** only after snow (+ optional price) is a real number. One short LLM call via the existing `/api/agent` harness (`make_plan_prompt` + `get_snow` / `get_weather` / `find_storms`). Deterministic fallback: “14″ modeled in 48h, flights not priced — open Plan.” Never invent a fare.

---

## 3. Pricing options and a rough cost model

Two honest products, not one fuzzy “pro”:

| | Free dump alert | Paid trip watch |
|---|---|---|
| What they pay | $0 | Either **$29–49 / season** (flat, Nov–Apr NH) or **$6–9 / watch** (one resort + date window, expires at `to`) |
| What they get | Threshold email, Explore/Plan deep link | Same + stored criteria + check until the window ends + optional go/wait line |
| What they do **not** get (v1) | Flight/hotel prices | A booked trip, a guaranteed fare, tropical tracks |

Per-season is simpler (one Stripe Checkout, fewer dunning mails). Per-watch matches Campnab and is easier to cost (“this Mammoth week”). A hybrid works: season pass includes N watches, extra watches à la carte.

### What it actually costs us (order-of-magnitude, 2026-10-24)

Assumptions for a **100 paying watchers**, each one resort, 6-hourly snow check, ~1 trigger email / watcher / month, no flight API yet.

| Line | Source | Math | Notes |
|---|---|---|---|
| Sending domain | Registrar (skimts.com **not bought**) | ~$10–15 / year typical retail; **unverified until you price the TLD** | Needed before Resend will authenticate. |
| Resend | [resend.com/pricing](https://resend.com/pricing) | Free = 3,000/mo and **100/day**. Pro **$20/mo** = 50k, no daily cap. | Confirm + alert + unsub extras. 100/day is tight the morning a Sierra bomb hits. Plan on Pro before a storm weekend. |
| Open-Meteo | [pricing](https://open-meteo.com/en/pricing) + terms | $0 while unpaid and non-commercial. **€29/mo Standard** once you charge (third-party figure; verify). | Snapshot job, not per-user. 1M calls is far above a 6-hourly 158-resort batch. |
| Vercel | [vercel.com/pricing](https://vercel.com/pricing), [cron docs](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Hobby $0 (daily cron only, non-commercial). **Pro $20/mo** + function usage. | 6-hourly needs Pro. Blob for subs is already in the project. |
| Stripe | [stripe.com/pricing](https://stripe.com/pricing) | **2.9% + $0.30** / successful domestic card. No monthly fee. | $39 season → ~$1.43 to Stripe. |
| LLM go/wait | AI Gateway list: `openai/gpt-5.4-mini` **$0.75 / 1M in, $4.50 / 1M out** ([models](https://vercel.com/ai-gateway/models)) | ~$0.002–0.01 per short summary if you keep the prompt tiny | Only on trigger, not every cron tick. Deterministic path is $0. |
| Flight quotes | Duffel $0.005/search if you never book; Travelpayouts gated | 100 watchers × 4 polls/day × 30 days = 12,000 searches → **~$60/mo** on Duffel with zero orders | This is why v1 should not poll fares. |

**Ballpark cash cost at 100 paid users, snow-only watches:** ~$20 Vercel + $20 Resend + ~€29 Open-Meteo + Stripe take + domain ≈ **$70–90/mo** all-in, plus your time. Revenue at $39/season × 100 = $3,900 over ~5 months → ~$780/mo average, **if** they all buy. At 20 users the same infra barely breaks even. These are envelope numbers, not a forecast.

Flight polling at Duffel rates without bookings can exceed the snow stack. Do not include it in the sticker price until the unit math works or you have affiliate coverage that is actually cached.

---

## 4. Prerequisites, in order

Do these before flipping `EMAIL_ALERTS_ENABLED`. None of this is done.

1. **Sending domain.** Bailey mentioned `skimts.com`. It is **not bought**. Pick a domain you control, buy it, put DNS on it. `skiscope.vercel.app` is fine for the app; mail from `onboarding@resend.dev` will look like spam once volume rises.
2. **Resend domain verification.** SPF + DKIM + DMARC on that domain. Set `RESEND_FROM` to `SkiScope <alerts@yourdomain>`. Keep `RESEND_API_KEY` in Vercel env — it is already the intended slot; do not commit it.
3. **Subscriber storage + consent.** Blob `skiscope-alerts` + `BLOB_READ_WRITE_TOKEN` already exist. Keep double opt-in. Add a real postal address to the footer (CAN-SPAM / CASL). Record `confirmed` timestamp and the exact rule they consented to. Honor unsubscribe in the same request; do not “confirm unsub.”
4. **Stripe.** Checkout Session for season or watch. Webhook → mark the rule `paid`. No charges in the repo today. Standard US fee 2.9% + 30¢.
5. **Anti-abuse.** Existing `/api/agent` limit is 30/10 min/IP — same idea on `/api/subscribe` (it is currently open). Honeypot + (after domain) a CAPTCHA. Cap rules per email. Bounce/complaint webhook from Resend → disable. Snapshot job stays one batched Open-Meteo call, never a user-triggered scrape. Paid commercial use → Open-Meteo customer key **before** the first charge.

Also: Vercel Hobby is the wrong plan the moment this is a product. Move the project to Pro so cron can be 6-hourly and the ToS matches “people pay us.”

---

## 5. Phased build (effort, not a calendar)

Email stays paused until phase 0 is done and someone flips the flag on purpose.

| Phase | What | Effort | Depends on |
|---|---|---|---|
| **0. Mail identity** | Buy domain, Resend verify, postal address, `RESEND_FROM`. | Small (ops, not code). | Human + DNS. |
| **1. Re-enable sending** | Flip `EMAIL_ALERTS_ENABLED`. Confirm, dump alert, and recap templates already written. Cron already wired. | Small. Flag + allowlisted send test to baileybusch@gmail.com. | Phase 0. |
| **2. Threshold dump alerts** | **Shipped (paused).** `evaluateAlerts`, Alert me, templates, preview. Turn on with the flag. | Done except ops. | Phase 1. |
| **3. Paid snow watch** | Stripe Checkout, `kind=trip` without a fare ceiling, cron until `to`, one go/wait sentence from the existing agent (deterministic if Gateway is off). | Medium. New webhook + a “watches” list. Open-Meteo Standard key. | Phase 2 + Stripe + commercial OM. |
| **4. Fare / room ceiling** | Only after a real API: Travelpayouts cached calendar *or* a Duffel contract you can afford to poll. Lodging = Booking/Expedia after approval. | Large, and maybe never. Contracts, caching, “indicative price” copy, much higher COGS. | Phase 3 + vendor access. **Not possible key-less.** |
| **5. Agent as the product** | “Keep looking and tell me when to go.” Workflow loop, `/api/agent` tools already include `get_weather` and `find_storms`. Rate-limit and a spend cap per watch. | Medium on top of 3; Large if it also prices. | Phase 3. Skip 4 if the deep link is enough. |

Phase 2 is the Mammoth-style product. Phase 3 is the Campnab-style product without lying about flights. Phase 4 is where most travel startups stall; do not promise it on the marketing page.

---

## Monetization (design only — no ad network)

Plan, not a live program:

1. **Free alerts** — grow the list. The product is the dump email.
2. **Sponsor slots in alerts and recaps** — one slot, labeled **Sponsored** (CAN-SPAM). Off unless the subscriber leaves “sponsor / partner content” on. Frequency cap: at most one sponsor per email, and not every send if the list is small. Preview renders `Example sponsor`.
3. **Do not sell raw email addresses.** Selling or renting the list creates CCPA/GDPR exposure. Prefer placing a labeled sponsor in the email we already send. Share **aggregated** stats with a partner (open rate, list size band) if anything.

TODO (doc only, not on the Privacy page): how/whether any subscriber data is shared with partners is **to be decided before launch**, after legal review. Do not claim data is sold. Do not claim data is never sold until Bailey decides.

Affiliate flight/lodging links stay separate (`lib/links.js`, disclosure page).

---

## Sources and unverified items

Verified against the live page on 2026-10-24 unless noted:

- Open-Meteo [terms](https://open-meteo.com/en/terms) and [pricing](https://open-meteo.com/en/pricing) — limits and commercial rule. **Euro/dollar sticker prices are not in the HTML table**; €29 / €99 from [ki-syndikat Aug 2026](https://www.ki-syndikat.de/tools/open-meteo/) (Stripe embed). **Verify at checkout.**
- Resend [pricing](https://resend.com/pricing) and [quota docs](https://resend.com/docs/knowledge-base/resend-email-quota) — 3,000/mo, 100/day free; Pro $20 / 50k.
- Duffel [pricing](https://duffel.com/pricing) — $3/order, $0.005 excess search, 1500:1.
- Amadeus self-service shutdown — [PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) (17 Jul 2026).
- Stripe [pricing](https://stripe.com/pricing) — 2.9% + 30¢ US cards.
- Vercel [cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [plans](https://vercel.com/pricing) — Hobby daily-only; Pro $20/mo.
- AI Gateway model list — `openai/gpt-5.4-mini` $0.75 / $4.50 per 1M (list rate; Gateway bills provider rates).
- Travelpayouts 50k MAU Search API gate — their support article, not re-fetched as HTML this run (Cloudflare). **Re-check** if you apply.
- Domain retail for `skimts.com`, Booking/Expedia API pricing, Duffel KYC approval odds, Vercel function $ at 6-hourly — **unverified**.
- Named tropical tracks and global wind tiles remain skipped (no clean free no-key source); they are not part of an alert v1.

When a number here disagrees with the vendor’s page, believe the vendor.
