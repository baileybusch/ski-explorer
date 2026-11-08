# Data sources

Audit of every map / tile / weather / DEM / radar dependency. **Do not swap providers** except the CARTO → OpenFreeMap basemap change in this pass (CARTO `dark_nolabels` now watermarks “API KEY REQUIRED” and is not free for commercial use).

Esri satellite imagery is **dropped**. Terms exclude commercial use.

## Attribution decision (Open-Meteo)

Open-Meteo data is [CC BY 4.0](https://open-meteo.com/en/license). The license requires a credit **next to any place the data is displayed**, with a link, e.g. `Weather data by Open-Meteo.com`.

**What we did:** keep a one-line credit on the resort **7-day forecast** tile (the only live weather surface). Repeat the same linked line on About / Privacy “Data sources”. Do **not** put it in the footer. Do **not** say “open snow data” anywhere.

Footer is wordmark + Privacy, Terms, Contact. Affiliate disclosure stays conditional (`affiliateConfigured()`). Map credits live in MapLibre’s collapsed **i** control.

## License table

| Source | Needs a key? | Commercial use | Attribution | Rate / usage limits | Production without a key |
|---|---|---|---|---|---|
| **OpenFreeMap dark vector style** (`tiles.openfreemap.org/styles/dark` + `planet` tiles) | No. No registration. | Yes (public instance is free, including commercial). | Required: OpenStreetMap contributors; OpenFreeMap / OpenMapTiles (MapLibre compact control). | No view/request cap on the public instance; offline extracts capped (3,000 tiles / 50 MB). Donate/support if heavy. | Style JSON fetch failure → inline OpenFreeMap subset. Tile failure → hide basemap layers, keep dark background + our overlays. Map is never blank. |
| **Mapterhorn DEM / hillshade** (`tiles.mapterhorn.com` terrarium WebP) | No. | Check [mapterhorn.com](https://mapterhorn.com) before a paid launch; currently used keyless for terrain. | Terrain © Mapterhorn (map i). | Public tile CDN; treat as best-effort. | Terrain disable on error. Hillshade/3D off. Basemap + pins stay. |
| **Our piste GeoJSON** (`/data/resorts/<id>.json` from OpenSkiMap / OSM, ODbL) | No. | Yes, with ODbL share-alike on the extracted data. | OpenSkiMap + OpenStreetMap contributors (map i). | Local static files. | Missing file → no runs/lifts for that resort. |
| **Open-Meteo forecast** (`api.open-meteo.com`) | No on the free tier. | **Free tier is non-commercial** ([terms](https://open-meteo.com/en/terms)). Paid plan + `customer-api.open-meteo.com` before sponsors / ads / subscriptions go live. | CC BY 4.0 — credit adjacent to displayed weather. | Free: 10k calls/day, 5k/hour, 600/min, weighted by locations × `ceil(days/14)` × variables. | Live 7-day falls back to the committed `snow.json` snapshot. Board still ranks. |
| **MET Norway Locationforecast 2.0** | No. Requires a contact `User-Agent`. | **Yes**, with attribution ([terms](https://api.met.no/doc/TermsOfService)). Commercial-safe $0 path. | Must credit MET Norway / CC BY 4.0. | Fair use; identify the app. | Flip `WEATHER_PROVIDER=metnorway`. Snow is **estimated** (precip × SLR), not a reported depth. |
| **Open-Meteo archive / history** (`archive-api.open-meteo.com`, ERA5-class reanalysis) | Same as forecast. | Same non-commercial free tier. History precompute is from this source — note it in the tile (“modeled”). | Same CC BY 4.0. Credit already on the forecast tile + About. | Same weighted-call budget. `scripts/fetch_history.py` batches and throttles. | Resorts not in `history.json` show 24h/72h/storm + season-to-date from `snow.json` only. No past-season bars. |
| **RainViewer radar + IR** | No. | **API is personal / educational only.** Leave radar working for now; **licensing to-do** before a commercial radar product or sponsor-funded app. | Radar © RainViewer (map i). | Public tilecache; no SLA. | Overlay stays hidden if tiles fail. |
| **Geocoding** | We do **not** call a geocoder. Search is the local gazetteer + fuzzy resort names (`lib/agent/parseTrip.js`). | n/a | n/a | n/a | Search still works offline against committed JSON. |
| **Overpass (lodging pins)** | No. | OSM ODbL. | OSM (map i) when the layer is on. | Public Overpass; easy to 429. | Empty lodging layer. |
| **NWS winter alerts** (US) | No. | Public domain. | “Alerts: NWS (US only)” on the map source. | Public endpoint. | Layer off. |
| **NRCS SNOTEL / AWDB** | No. | Public domain (US Government work). | “Last 72h from SNOTEL” on the resort storm tile when mapped. | Public REST; hourly SNWD + WTEQ for mapped stations only (~80). | US resorts without a station ≤45 km fall back to model-est. |
| **NIFC WFIGS fire perimeter** | No. | Public. | NIFC WFIGS. | Static committed GeoJSON. | No fire outline. |
| **Esri World Imagery** | n/a | **Excluded.** Terms do not allow commercial use. Layer removed. | — | — | Not used. |
| **CARTO dark_nolabels** | Would need a key now. | Not free for commercial use. | — | Watermarks “API KEY REQUIRED”. | Replaced by OpenFreeMap. |

## Snow history caveat

`public/data/history.json` is **coarse reanalysis** (Open-Meteo historical archive / ERA5-class), not resort-reported snow. Season start is Oct 1 (N) / Jul 1 (S). Same-date bars compare season-to-date totals through the same calendar date. Units follow the in/cm toggle. Label the tile “modeled”.

## Weather providers ($0)

`lib/weather/providers/*` + one-line flip:

```
WEATHER_PROVIDER=openmeteo   # default — keep while there is no revenue
WEATHER_PROVIDER=metnorway   # commercial-ok; UA + attribution required
```

`python3 scripts/fetch_snow.py --provider openmeteo|metnorway` prints the choice. The Python snapshot job **stays on Open-Meteo** until we pay; MET Norway is wired in JS (`lib/weather`) for live / compare. Do **not** buy a weather plan.

### MET Norway snow estimate

Locationforecast has precipitation + temperature, not snowfall_sum. SLR:

| Tmax | Treatment |
|---|---|
| ≤ 0°C | 10:1 (1 mm liquid ≈ 1 cm snow) |
| 0–2°C | 8:1 |
| > 2°C | rain (0 snow) |

### Other sources researched (not wired, $0)

| Source | Why not yet |
|---|---|
| **NWS / NOAA grid** | US only. Good for alerts (already a map layer). Not a worldwide snow depth. |
| **NOAA GFS / ICON** | Already inside Open-Meteo’s blend. Hitting them raw needs a stack we would pay to run. |
| **ERA5-Land** | Best **history** migration off Open-Meteo archive. Same non-commercial issue on the free Open-Meteo path; Copernicus CDS is the commercial-ok archive. Next history rewrite should target CDS / ERA5-Land, not a paid Open-Meteo plan. |

### MET vs Open-Meteo (method)

Open-Meteo `snowfall_sum` is a model snowfall field. MET Norway snow here is precip × SLR. For the same mountain, MET will usually be **lower and later** in mixed storms (T>2°C → 0) and **similar** when it is cold. A live 8-resort check is `node scripts/compare_weather.mjs` (network; skipped in CI). Until revenue, keep the committed Open-Meteo snapshot.

## Observed snow vs forecast (pass 4)

The big number on the board is **last 72h observed**. The chip is **+X coming** from the model. They are never mixed into one fallen-snow total.

| Region | Observed source | `source` field | License |
|---|---|---|---|
| **US (western, SNOTEL coverage)** | NRCS AWDB REST, networks `SNTL` / `SNTLT`. Each resort maps to the nearest station by distance + elevation (≤45 km, ≤900 m elev gap). New snow = peak snow-depth rise in the window; integer-inch flicker is dropped unless SWE also rose. | `snotel:<triplet>` e.g. `snotel:1308:UT:SNTL` | US Government work / public domain. No key. [AWDB REST](https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html) |
| **Canada** | ECCC GeoMet climate-daily `TOTAL_SNOW` / `SNOW_ON_GROUND` was evaluated (Whistler Roundhouse, Blackcomb 1540). Alpine auto stations currently return **null** snow fields; not reliable for a live board. BC ASWS is HTML, not a stable JSON feed. | `model-est` until ECCC snow fields populate | ECCC open government / GeoMet — legal to use, just not useful yet |
| **Japan, Alps, NZ, AU, rest** | Open-Meteo `snowfall_sum` for the last 3 snapshot days | `model-est` | CC BY 4.0, **non-commercial** free tier. UI labels **est.** |
| **Eastern US without SNOTEL** | Same model fallback | `model-est` | SNOTEL is western; no fake distant station |

Schema (`public/data/observed.json` and each tool row): `snow72h_observed`, `snow24h_observed`, `source`, `observed_at`, plus `forecast7d` from the model snapshot.

### Refresh cadence (free, no paid cron)

| Path | Cadence | Notes |
|---|---|---|
| **GitHub Actions** `.github/workflows/refresh-observed.yml` | **Hourly** (`17 * * * *`) | Best free near-real-time persist. Commits `observed.json` + slim `snow.json`. Scheduled workflows run on **main** after merge; until then preview uses the on-demand API. |
| **`GET /api/observed`** (same Hobby function as MCP/search/data) | On demand, **45 min** in-memory + **30 min** CDN (`s-maxage=1800`) | Live AWDB pull when the committed file is stale. No new serverless function. |
| **Vercel Hobby cron** | Once/day | Already used by `/api/cron/alerts`. Not used for snow. |
| **`snow.json` forecast job** | Same hourly Action | **1 center/resort**, `past_days=7`, `forecast_days=7`, no hourly, no 2×2 grid. ≈158 weighted calls vs the old 4360 that hit Open-Meteo’s 4000/hour cap. |

Board shows **Updated X min ago** from `observed.fetched`.

### NOHRSC

NOAA NOHRSC 24h snowfall analyses are public domain and would fill eastern US gaps. Optional, not wired — rasters, not point stations, extra fetch/parse. SNOTEL is the western source of truth.

### Resort-reported snow reports

Evaluated, **not ingested**:

| Feed | Finding |
|---|---|
| Alta `/weather` | HTML snow report. No public JSON. Terms are a marketing site, not an open API. |
| Alta `/api/v1/weather` | 404 |
| Vail / Epic `snow.com` | Proprietary. ToS do not allow republishing storm totals. |
| OnTheSnow / Skiinfo | Commercial product; scraping/republishing prohibited. |
| Typical resort “snow report” widgets | Often the same third-party feeds above, or stale daily HTML. |

SkiScope does **not** scrape resort pages. Official storm totals remain the mountain’s number; ours is SNOTEL (US) or modeled (est.).

## How to extend history

```
python3 scripts/fetch_history.py            # top ~40 (see TOP in the script)
python3 scripts/fetch_history.py --all      # every index row; respect the hourly throttle
python3 scripts/fetch_history.py --ids alta,vail
```

One archive call covers ~6 seasons of daily `snowfall_sum` per batch. Report printed at the end: locations, HTTP requests, estimated weighted calls. Stay under Open-Meteo’s free 5k/hour and 10k/day unless you are on a paid plan.

## Map i-button credits

Collapsed MapLibre `AttributionControl` (bottom-left) should list: OpenStreetMap contributors, OpenFreeMap / OpenMapTiles, Mapterhorn, RainViewer (when radar tiles are in the style). OpenSkiMap when piste data is loaded.
