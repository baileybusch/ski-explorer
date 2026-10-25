# SkiScope — monitor the snow

iPhone-first globe for the 26/27 Ikon Pass and Epic Pass: where good snow is or will be, which pass mountains you can actually go to, and a trip brief you can hand to ChatGPT / Claude / Grok. Bailey’s shorthand is “ski MTS” — monitor the situation.

Home is an interactive **MapLibre globe**. Search “Japan”, “Dolomites”, “Alps”, “Utah”, “Hokkaido”, “Colorado” (gazetteer + fuzzy resort names — no LLM key) and the globe flies there, pins the matching resorts, and opens the list (bottom sheet on iPhone, side panel on desktop). Zooming in flattens into the existing 3D terrain map. Tapping a pin opens the same detail view as before (timeline, past seasons, Eagle Point fire card).

Front end is **Vite + React + Tailwind + shadcn/ui** (`src/`, build → `dist/`). Vanilla JS could not use shadcn components, so we migrated rather than faking the tokens. Data, photos, `/alerts`, and `public/config.js` stay in `public/` and are copied into `dist/`. Vercel still auto-deploys; `/api/*` (email + agent) stay as serverless functions. Email remains **paused**.

## Data sources
| Layer | Source |
|---|---|
| Terrain / hillshade / contours | AWS Open Data Terrarium DEM tiles (Mapzen), contours generated client-side with `maplibre-contour` |
| Imagery | Esri World Imagery (attribution in map); CARTO Dark as non-satellite fallback |
| Snowfall + snow depth | [Open-Meteo](https://open-meteo.com) forecast API (`past_days=30`, `forecast_days=7`, daily `snowfall_sum` / temps / weathercode, hourly `snow_depth` on the mid-mountain point only). **2×2 heatmap grid + one center** per resort so a full worldwide run stays under the free hourly weighted-call budget (the old 4×4 + hourly-everywhere path needed ~4360 weighted calls and stalled on a 4000/hour self-throttle). Snapshot committed to the repo (`scripts/fetch_snow.py`); daily refresh is still paused — `docs/github-action-snow.yml.example` is an example only. |
| Runs, lifts, ski-area stats | [OpenSkiMap](https://openskimap.org) GeoJSON (© OpenStreetMap contributors, ODbL), clipped per resort by `scripts/process_osm.py` |
| Cottonwood Fire perimeter | NIFC WFIGS Interagency Perimeters FeatureServer, IRWIN {B1B09572-CD77-4B0A-8E06-71284617A28F} |
| Resort list | Official 26/27 Ikon + Epic destination lists, including Ikon international (Japan, Dolomiti Superski, Alps, Chile, NZ, Australia, China, Korea) and Epic Europe / Japan / Australia plus previously skipped partners (Telluride, RCR). Bonus mountains and heli ops omitted. Sources and gaps: [docs/DESTINATIONS.md](docs/DESTINATIONS.md). |

Snow depth is modeled (not resort-reported). NOAA NOHRSC/SNOTEL are not yet integrated.

## Rebuild data
```
curl -O https://tiles.openskimap.org/geojson/{ski_areas,runs,lifts}.geojson  # into raw/
python3 scripts/match.py && python3 scripts/process_osm.py && cp scripts/index_osm.json public/data/resorts-index.json
python3 scripts/build_index.py           # merge international destinations + airports/regions onto the index
python3 scripts/fetch_snow.py            # full refresh (2×2 + center); add --missing for new ids only
python3 scripts/typical.py               # day-of-year averages from stored seasons (typical, not forecast)
python3 scripts/fetch_seasons.py         # NH Nov–Apr; HEMI=S for Chile/NZ/AU (Jun–Sep → *sh.json)
```
`scripts/resorts.json` rows are `[id, name, OSM name token, state, lat, lon, ikonAccess|null, epicAccess|null]`; a resort on both passes has both fields set and gets both tags. The index also carries `region`, `country`, `town`, `iata` (nearest commercial airport), `aliases`, `hemisphere`, plus OSM stats when matched. New worldwide destinations live in `scripts/destinations.json`.

## v2 additions
- **Past seasons**: `scripts/fetch_seasons.py` pulls Nov 1–Apr 30 daily `snowfall_sum` per resort (mid-mountain point, elevation-downscaled) from the Open-Meteo historical archive (ERA5), paced to stay under the weighted rate limits (≤400/min, ≤4500/hour). Writes `public/data/seasons/<year>.json` (~33 KB each) + `summary.json` (`scripts/season_summary.py`). Already-fetched seasons are skipped, so it is safe to re-run.
- **Email alerts**: `/alerts` page + follow button. Subscribers live in a private Vercel Blob store (`skiscope-alerts`, env `BLOB_READ_WRITE_TOKEN`). Double opt-in (`/api/subscribe` → email → `/api/confirm`), one-click unsubscribe (`/api/unsubscribe`, GET + RFC 8058 POST, `List-Unsubscribe` headers), manage via `/api/subscription?token=`.
- **Daily digest**: Vercel Cron `30 13 * * *` (6:30 AM PDT) → `/api/cron/digest` (auth: `CRON_SECRET`). Sends through Resend when `RESEND_API_KEY` is set (`RESEND_FROM` optional, defaults to `onboarding@resend.dev`; `DIGEST_ALLOWLIST` optional comma list to restrict recipients). Preview: `/api/digest/preview?email=demo` (`&resorts=alta,snowbird`).

## v3: weekly digests + "See You Up There" photos
- **Frequency**: each subscriber has `freq` = `weekly` (default) or `daily`, chosen on the Follow form and `/alerts`. One cron (`30 13 * * *`, ~6:30 AM PT) sends daily subscribers every run and weekly subscribers only on Saturdays (Pacific). Weekly issues say "This week" in the subject and header and show 7-day totals plus next-7-day forecast. Preview: `/api/digest/preview?email=demo&freq=weekly`.
- **Photo sign-off**: every digest ends with "See You Up There", one photo picked deterministically per issue (by day for daily, by week for weekly) from `public/photos/photos.json`.

### Adding photos
Only use images you are allowed to reuse, and credit them exactly:
1. **Wikimedia Commons**: CC BY, CC BY-SA, CC0 or Public domain only. Record the author, file page URL, license short name and license URL. The credit renders as `Name, CC BY-SA 4.0, via Wikimedia Commons`, with links to the file page and the license.
2. **Unsplash**: set `"source": "Unsplash"` and `sourceUrl` to the photo page. The credit renders as `Photo: Name / Unsplash`.
3. Resize to about 1200px wide as a compressed JPG (quality around 78), save it as `public/photos/NN.jpg`, and add an entry to `photos.json`: `file`, `caption`, `location`, `photographer`, `source`, `sourceUrl`, `license`, `licenseUrl`. `scripts/fetch_photos.py` pulls candidates from Commons ski categories with license filtering.
4. Do **not** hotlink or scrape X/Twitter, Instagram, Huckberry or Red Bull images. Brand imagery (Red Bull Content Pool, resort media kits, athlete or photographer portfolios) needs written permission or an explicitly granted license before use.

## v4: Epic Pass resorts + pass filter
- Added the 37 Epic Pass 26/27 unlimited-access North American resorts (Vail, Beaver Creek, Breckenridge, Keystone, Crested Butte, Park City, Heavenly, Northstar, Kirkwood, Stevens Pass, Whistler Blackcomb, Stowe, Okemo, Mount Snow, Mount Sunapee, Attitash, Wildcat, Crotched, Hunter, Liberty, Roundtop, Whitetail, Jack Frost, Big Boulder, Seven Springs, Laurel Mountain, Hidden Valley PA, Afton Alps, Mt Brighton, Wilmot, Alpine Valley OH, Boston Mills, Brandywine, Mad River, Hidden Valley MO, Snow Creek, Paoli Peaks). No North American resort is on both passes' full lists for 26/27.
- **All / Ikon / Epic** chips float on the map (under the search bar) and sit at the top of the resort list; they stay in sync, filter list, map dots and the timeline / season averages, persist in `localStorage`, and deep-link via `?pass=ikon|epic`. Map dots: Ikon gold, Epic blue (both-pass resorts would be mint).
- `fetch_snow.py` and `fetch_seasons.py` now pace weighted Open-Meteo calls and can fill in only missing resorts.

## v5: globe home, Ikon worldwide, trip handoff

- **Globe home**: MapLibre `globe` projection at zoom ~1.5; search/chat bar; fly-to on region match; terrain turns on as you zoom into a mountain.
- **Pass filter**: Both / Ikon / Epic, still in `localStorage` (`ss_pass`) and `?pass=`. New visitors default to **Ikon**.
- **Date-aware snow**: When control (next 7 / next 3 / custom dates). Inside the forecast snapshot = modeled forecast; after the horizon = **typical** past-season average, labeled as typical not forecast.
- **Watchlist**: stars, `localStorage` only (`ss_watch`) — no accounts, no email.
- **Shared trip state** (every list row + detail): location, snowfall for the chosen window, dates, **adults + kids** (default 2 + 2, editable, `localStorage`), flights, lodging. People flow into Google Flights (primary), Kayak/Skyscanner, and Booking/Airbnb/VRBO/Expedia (`group_adults` / `children` / `no_rooms` where those sites support them) and into the Plan brief.
- **Explore resort** vs **Plan trip**: Explore is the detail view (facts, snow, map, lodging layer). Plan opens the AI brief (ChatGPT / Grok deep links + copy; Claude is copy-only).
- **Outbound links** all go through `lib/links.js`. Affiliate wrap is config-driven via `AFFILIATES` in `public/config.js` (empty now). When any id/template is set, links get `rel="sponsored noopener"` and the footer shows “we may earn a commission.”
- **Share / inbound URLs**: `/?resort=mammoth&from=2026-12-20&to=2026-12-27&people=4&mode=explore|plan` (`adults`/`kids`/`home`/`pass` also work; `r=` still works). `people` alone keeps the family split (2 adults + the rest kids, so `people=4` → 2+2). Share-link button copies the full URL. Future snow-threshold emails can use the same URLs; email stays **off**.
- **Lodging layer**: optional OSM hotels/chalets via Overpass, labeled as OSM, no prices. Fails soft if Overpass is down.
- Search does not need an LLM. A future parser can sit behind a user-supplied key; nothing in the repo requires a new secret.

## Affiliate programs

No affiliate ids are in the repo. To add one later, set a key on `AFFILIATES` in `public/config.js`:

- A query suffix (`aid=12345`) is appended to that provider’s URL.
- A template containing `{url}` wraps the destination (Travelpayouts-style).

Where to apply (public programs; approval required):

- [Booking.com Affiliate](https://www.booking.com/affiliate-program/v2/index.html)
- [Expedia Group Partner Solutions](https://developer.expediapartnersolutions.com/) / Expedia Affiliate Network
- [Skyscanner Affiliate](https://www.skyscanner.net/affiliate-program) (often via Travelpayouts)
- [Travelpayouts](https://www.travelpayouts.com/) (Kayak, Skyscanner, and others behind one wrap)

Do not commit secrets. Public affiliate ids are fine. The commission line only appears when at least one `AFFILIATES` value is non-empty.

## v6: one search bar + agent harness

- **Clean home** (later replaced by the Weather-style list in the same PR): one chat/search bar, rotating ghosts, agent harness. See below.
- **Rotating ghost text** on the bar (pauses on focus): Japan spring break, Ikon near Denver, Dolomites, Utah dumping, Mammoth family.
- **Natural-language bar**: a sentence like `Japan trip for 5 spring break mar 7-14` is parsed into trip state, flies the globe, fills the list, and writes the menu values.
- **Agent**: `POST /api/agent` streams NDJSON. Always runs the deterministic gazetteer/date parser. Uses the Vercel AI SDK through the AI Gateway only when OIDC or `AI_GATEWAY_API_KEY` is present — **no key in the repo**. See [docs/agent-harness.md](docs/agent-harness.md).
- **Evals**: `npm run eval` (15 sentences, pinned date). Optional `RUN_LLM=1`.

### Bailey setup for the LLM path

On the Vercel project: **Settings → Security → OIDC Federation** (AI Gateway uses the injected `VERCEL_OIDC_TOKEN`). That is enough on a deployed preview/prod — no new secret.

Locally: `vercel link && vercel env pull`, **or** set `AI_GATEWAY_API_KEY` from the AI Gateway dashboard (do not commit it). Optional `AI_GATEWAY_MODEL` (default `openai/gpt-5.4-mini`).

Without either, the bar still works in **deterministic-only** mode (regex + gazetteer, including spring break / this weekend / next week / `this week` / `mar 7-14`). “What storms are heading for Utah this week?” turns on the Storms chip and flies to Utah.

## v7: Weather-style list → detail → map

Replaced in this PR by the scoreboard concepts below. The Weather chrome was too busy for a glance-at-the-snow monitor.

## v8: two scoreboard concepts

Home is a **snowfall leaderboard**, not a weather-app list and not the globe.

- **A** (`?design=a`, default): full-screen snap cards, one resort, huge snow number, tap to flip.
- **B** (`?design=b`): 2-column blocks, top card double-width, tap expands into the A card.

Time window (24h / 72h / 7d / Next 7), pass, and the agent bar sit at the top. People and dates are a Trip pill. Map is one floating button. Notes: [docs/design-concepts.md](docs/design-concepts.md), [docs/design-tokens.md](docs/design-tokens.md).

## Weather and storms

Snow is still the center. Storms is a list/search filter (still `data-testid="storms-chip"`), plus a tile on the resort card when a pulse is on.

- **List / resort detail**: glyph + temp from the snow snapshot (no extra call). Opening a resort fetches live Open-Meteo current + 7-day + 48h hourly (wind, freezing level), cached 40 minutes. Visible list rows batch current+daily in groups of 8, never a catalog firehose.
- **Map layers** (popover in map mode): RainViewer radar and IR satellite (free, no key, attribution on the map). Storm rings from the forecast snapshot. NWS winter watches/warnings (**US only**, public domain). No free no-key global **wind tiles**; no named tropical tracks (NHC is seasonal/basin-specific — skipped).
- **Storm badges**: 72h forecast snowfall ≥ 6 / 12 / 18 inches (configurable). International = forecast badges only. Labeled as Open-Meteo forecast, not typical, not observed.

Credits: Open-Meteo (CC BY 4.0), RainViewer tiles, NWS alerts.

## Email alerts paused
- `EMAIL_ALERTS_ENABLED = false` in `public/config.js` (shared by the browser and `/api`). Follow button, footer link and `/alerts` signup are hidden (`/alerts` shows a paused note); `/api/subscribe` returns 503; `/api/cron/digest` is a no-op; the cron entry is removed from `vercel.json`.
- Subscriber data in Blob and the Resend env vars are untouched. To resume: flip the flag to `true` and re-add `"crons": [{ "path": "/api/cron/digest", "schedule": "30 13 * * *" }]` to `vercel.json`.
- If email comes back, keep it as **snowfall + location threshold** alerts (example: “Mammoth got 12in+ / forecast 18in+ in 3 days”) whose buttons are the share URLs above (`mode=explore` / `mode=plan`). Do not rebuild signup in this revision.
- Practical write-up for later (still paused, no code): [docs/alerts-and-paid-watches.md](docs/alerts-and-paid-watches.md) — free dump-alert rules, a Campnab-style paid trip watch, cost model, and prerequisites (domain, Resend, Stripe).
