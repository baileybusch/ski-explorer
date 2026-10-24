# SkiScope — monitor the snow

iPhone-first globe for the 26/27 Ikon Pass and Epic Pass: where good snow is or will be, which pass mountains you can actually go to, and a trip brief you can hand to ChatGPT / Claude / Grok. Bailey’s shorthand is “ski MTS” — monitor the situation.

Home is an interactive **MapLibre globe**. Search “Japan”, “Dolomites”, “Alps”, “Utah”, “Hokkaido”, “Colorado” (gazetteer + fuzzy resort names — no LLM key) and the globe flies there, pins the matching resorts, and opens the list (bottom sheet on iPhone, side panel on desktop). Zooming in flattens into the existing 3D terrain map. Tapping a pin opens the same detail view as before (timeline, past seasons, Eagle Point fire card).

Static site (no build step): `public/index.html`, `app.js`, `style.css`, `public/lib/*` + precomputed JSON in `public/data/`.

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
- **Outbound links** all go through `public/lib/links.js`. Affiliate wrap is config-driven via `AFFILIATES` in `public/config.js` (empty now). When any id/template is set, links get `rel="sponsored noopener"` and the footer shows “we may earn a commission.”
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

## Email alerts paused
- `EMAIL_ALERTS_ENABLED = false` in `public/config.js` (shared by the browser and `/api`). Follow button, footer link and `/alerts` signup are hidden (`/alerts` shows a paused note); `/api/subscribe` returns 503; `/api/cron/digest` is a no-op; the cron entry is removed from `vercel.json`.
- Subscriber data in Blob and the Resend env vars are untouched. To resume: flip the flag to `true` and re-add `"crons": [{ "path": "/api/cron/digest", "schedule": "30 13 * * *" }]` to `vercel.json`.
- If email comes back, keep it as **snowfall + location threshold** alerts (example: “Mammoth got 12in+ / forecast 18in+ in 3 days”) whose buttons are the share URLs above (`mode=explore` / `mode=plan`). Do not rebuild signup in this revision.
