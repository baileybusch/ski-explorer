# SkiScope — 3D Ikon & Epic snow explorer

iPhone-first 3D terrain explorer for the 26/27 Ikon Pass and Epic Pass North American resorts (plus Eagle Point, UT), with a play/scrub timeline of the last 30 days of snowfall and the 7-day forecast. Inspired by Dilum Sanjaya's wildfire-spread prototype, rebuilt from scratch on real data.

Static site (no build step): `public/index.html`, `app.js`, `style.css` + precomputed JSON in `public/data/`.

## Data sources
| Layer | Source |
|---|---|
| Terrain / hillshade / contours | AWS Open Data Terrarium DEM tiles (Mapzen), contours generated client-side with `maplibre-contour` |
| Imagery | Esri World Imagery (attribution in map); CARTO Dark as non-satellite fallback |
| Snowfall + snow depth | [Open-Meteo](https://open-meteo.com) forecast API (`past_days=30`, `forecast_days=7`, daily `snowfall_sum`, hourly `snow_depth`), which blends NOAA GFS/HRRR and ECMWF models. 4×4 grid of points around each resort + one mid-mountain point (elevation-downscaled). Snapshot committed to the repo (`scripts/fetch_snow.py`); to refresh daily, add `docs/github-action-snow.yml.example` as `.github/workflows/snow.yml` (needs a token with `workflow` scope). A live serverless fetch was tried but Open-Meteo rate-limits Vercel's shared egress IPs. |
| Runs, lifts, ski-area stats | [OpenSkiMap](https://openskimap.org) GeoJSON (© OpenStreetMap contributors, ODbL), clipped per resort by `scripts/process_osm.py` |
| Cottonwood Fire perimeter | NIFC WFIGS Interagency Perimeters FeatureServer, IRWIN {B1B09572-CD77-4B0A-8E06-71284617A28F} |
| Resort list | ikonpass.com 26/27 destinations (North America; bonus mountains excluded) + epicpass.com 26/27 Epic Pass "Unlimited access" resorts in North America (37 Vail Resorts-owned; 7-day partner access at Telluride and Resorts of the Canadian Rockies excluded) |

Snow depth is modeled (not resort-reported). NOAA NOHRSC/SNOTEL are not yet integrated.

## Rebuild data
```
curl -O https://tiles.openskimap.org/geojson/{ski_areas,runs,lifts}.geojson  # into raw/
python3 scripts/match.py && python3 scripts/process_osm.py && cp scripts/index_osm.json public/data/resorts-index.json
python3 scripts/fetch_snow.py            # full refresh; add --missing to fetch only resorts not yet in snow.json
python3 scripts/fetch_seasons.py         # fetches only seasons/resorts missing from public/data/seasons/
```
`scripts/resorts.json` rows are `[id, name, OSM name token, state, lat, lon, ikonAccess|null, epicAccess|null]`; a resort on both passes has both fields set and gets both tags. The index carries `ikon`, `epic` and `passes` (`["ikon"]`, `["epic"]`, `["ikon","epic"]`, or `[]` for Eagle Point).

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

## Email alerts paused
- `EMAIL_ALERTS_ENABLED = false` in `public/config.js` (shared by the browser and `/api`). Follow button, footer link and `/alerts` signup are hidden (`/alerts` shows a paused note); `/api/subscribe` returns 503; `/api/cron/digest` is a no-op; the cron entry is removed from `vercel.json`.
- Subscriber data in Blob and the Resend env vars are untouched. To resume: flip the flag to `true` and re-add `"crons": [{ "path": "/api/cron/digest", "schedule": "30 13 * * *" }]` to `vercel.json`.
