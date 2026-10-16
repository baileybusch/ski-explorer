# SkiScope — 3D Ikon snow explorer

iPhone-first 3D terrain explorer for the 26/27 Ikon Pass North American resorts (plus Eagle Point, UT), with a play/scrub timeline of the last 30 days of snowfall and the 7-day forecast. Inspired by Dilum Sanjaya's wildfire-spread prototype, rebuilt from scratch on real data.

Static site (no build step): `public/index.html`, `app.js`, `style.css` + precomputed JSON in `public/data/`.

## Data sources
| Layer | Source |
|---|---|
| Terrain / hillshade / contours | AWS Open Data Terrarium DEM tiles (Mapzen), contours generated client-side with `maplibre-contour` |
| Imagery | Esri World Imagery (attribution in map); CARTO Dark as non-satellite fallback |
| Snowfall + snow depth | [Open-Meteo](https://open-meteo.com) forecast API (`past_days=30`, `forecast_days=7`, daily `snowfall_sum`, hourly `snow_depth`), which blends NOAA GFS/HRRR and ECMWF models. 4×4 grid of points around each resort + one mid-mountain point (elevation-downscaled). Snapshot committed to the repo (`scripts/fetch_snow.py`); to refresh daily, add `docs/github-action-snow.yml.example` as `.github/workflows/snow.yml` (needs a token with `workflow` scope). A live serverless fetch was tried but Open-Meteo rate-limits Vercel's shared egress IPs. |
| Runs, lifts, ski-area stats | [OpenSkiMap](https://openskimap.org) GeoJSON (© OpenStreetMap contributors, ODbL), clipped per resort by `scripts/process_osm.py` |
| Cottonwood Fire perimeter | NIFC WFIGS Interagency Perimeters FeatureServer, IRWIN {B1B09572-CD77-4B0A-8E06-71284617A28F} |
| Resort list | ikonpass.com 26/27 destinations (North America; bonus mountains excluded) |

Snow depth is modeled (not resort-reported). NOAA NOHRSC/SNOTEL are not yet integrated.

## Rebuild data
```
curl -O https://tiles.openskimap.org/geojson/{ski_areas,runs,lifts}.geojson  # into raw/
python3 scripts/match.py && python3 scripts/process_osm.py && cp scripts/index_osm.json public/data/resorts-index.json
python3 scripts/fetch_snow.py
```

## v2 additions
- **Past seasons**: `scripts/fetch_seasons.py` pulls Nov 1–Apr 30 daily `snowfall_sum` per resort (mid-mountain point, elevation-downscaled) from the Open-Meteo historical archive (ERA5), paced to stay under the weighted rate limits (≤400/min, ≤4500/hour). Writes `public/data/seasons/<year>.json` (~33 KB each) + `summary.json` (`scripts/season_summary.py`). Already-fetched seasons are skipped, so it is safe to re-run.
- **Email alerts**: `/alerts` page + follow button. Subscribers live in a private Vercel Blob store (`skiscope-alerts`, env `BLOB_READ_WRITE_TOKEN`). Double opt-in (`/api/subscribe` → email → `/api/confirm`), one-click unsubscribe (`/api/unsubscribe`, GET + RFC 8058 POST, `List-Unsubscribe` headers), manage via `/api/subscription?token=`.
- **Daily digest**: Vercel Cron `30 13 * * *` (6:30 AM PDT) → `/api/cron/digest` (auth: `CRON_SECRET`). Sends through Resend when `RESEND_API_KEY` is set (`RESEND_FROM` optional, defaults to `onboarding@resend.dev`; `DIGEST_ALLOWLIST` optional comma list to restrict recipients). Preview: `/api/digest/preview?email=demo` (`&resorts=alta,snowbird`).
