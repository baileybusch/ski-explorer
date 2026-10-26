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
| **NRCS SNOTEL** | Point stations, western US, excellent observed SWE. Sparse, not resort-aligned. |
| **NOAA GFS / ICON** | Already inside Open-Meteo’s blend. Hitting them raw needs a stack we would pay to run. |
| **ERA5-Land** | Best **history** migration off Open-Meteo archive. Same non-commercial issue on the free Open-Meteo path; Copernicus CDS is the commercial-ok archive. Next history rewrite should target CDS / ERA5-Land, not a paid Open-Meteo plan. |

### MET vs Open-Meteo (method)

Open-Meteo `snowfall_sum` is a model snowfall field. MET Norway snow here is precip × SLR. For the same mountain, MET will usually be **lower and later** in mixed storms (T>2°C → 0) and **similar** when it is cold. A live 8-resort check is `node scripts/compare_weather.mjs` (network; skipped in CI). Until revenue, keep the committed Open-Meteo snapshot.

## How to extend history

```
python3 scripts/fetch_history.py            # top ~40 (see TOP in the script)
python3 scripts/fetch_history.py --all      # every index row; respect the hourly throttle
python3 scripts/fetch_history.py --ids alta,vail
```

One archive call covers ~6 seasons of daily `snowfall_sum` per batch. Report printed at the end: locations, HTTP requests, estimated weighted calls. Stay under Open-Meteo’s free 5k/hour and 10k/day unless you are on a paid plan.

## Map i-button credits

Collapsed MapLibre `AttributionControl` (bottom-left) should list: OpenStreetMap contributors, OpenFreeMap / OpenMapTiles, Mapterhorn, RainViewer (when radar tiles are in the style). OpenSkiMap when piste data is loaded.
