---
name: regional-snow-climates
description: Use whenever a resort's region matters — any time you read snow quality, pick snow-to-liquid ratios, interpret a forecast, call a powder day, or name forecast sources for a specific resort. Identifies the resort's region and snow-climate type (maritime, intermountain, continental, sea/lake-effect, Alpine) and loads that region's reference file so thresholds, storm setups, snow-killers and sources fit the place.
---

# Regional snow climates (router)

The core skills (`reading-snow-quality`, `reading-forecasts`, `storm-setups-and-patterns`, `powder-day-call`, `presenting-snow-conditions`) are universal. Their Mammoth/Sierra examples are **Sierra-specific**. Before applying any number from them to another resort, load the matching region file below and use its ratios, flow directions, freezing levels and sources instead.

Tags used in region files: **[src]** = stated by the linked source; **[GK]** = general knowledge, approximate, not from a single cited source. Never present a [GK] range as a measured statistic.

## Step 1 — Identify the region
1. Get the resort's country, state/province, lat/lon and base/summit elevation (resort database or official site).
2. Match to a region file (table below). If it sits on a boundary (e.g. Idaho, eastern Oregon, Arizona/New Mexico), load the closest file and say it's a nearest-fit.
3. If no file fits (Scandinavia, Scotland, Eastern Europe, Turkey, Iran, Korea, China, Australia), use the climate-type rules in Step 2 and say the region isn't covered in detail.

| Region | File | Climate type | Examples |
|---|---|---|---|
| Sierra Nevada / California | `regions/sierra-nevada-california.md` | Maritime | Palisades Tahoe, Mammoth, Kirkwood |
| Pacific NW + BC Coast | `regions/pacific-northwest-bc-coast.md` | Maritime | Whistler, Mt. Baker, Crystal |
| Interior BC / Canadian Rockies | `regions/interior-bc-canadian-rockies.md` | Transitional → continental | Revelstoke, Kicking Horse, Banff Sunshine |
| Utah Wasatch | `regions/utah-wasatch.md` | Intermountain (+ lake effect) | Alta, Snowbird, Park City |
| Colorado / Central Rockies | `regions/colorado-central-rockies.md` | Continental | Vail, Steamboat, Wolf Creek |
| Tetons / Northern Rockies | `regions/tetons-northern-rockies.md` | Intermountain | Jackson Hole, Big Sky, Grand Targhee |
| Alaska | `regions/alaska.md` | Coastal maritime vs. interior continental | Alyeska, Valdez heli, Fairbanks area |
| Northeast US / Eastern Canada | `regions/northeast-eastern-canada.md` | Humid continental + lake effect | Stowe, Jay Peak, Tremblant |
| Japan | `regions/japan.md` | Sea-effect (winter monsoon) | Niseko, Hakuba, Nozawa Onsen |
| Alps — north side | `regions/alps-north.md` | Alpine, Atlantic-fed | St. Anton, Engelberg, Chamonix |
| Alps — south / Dolomites | `regions/alps-south-dolomites.md` | Alpine, Mediterranean-fed | Cortina, Val Gardena, Livigno |
| Pyrenees | `regions/pyrenees.md` | Mixed Atlantic/Mediterranean | Baqueira, Grandvalira, Cauterets |
| Southern Hemisphere | `regions/southern-hemisphere.md` | Maritime (NZ) / Mediterranean-Andean | Mt Hutt, Portillo, Las Leñas |

## Step 2 — Climate-type rules (when no file fits, or for a quick prior)
North American snow climates are defined as maritime, intermountain/transitional, and continental [src: Avalanche.org snow climate pages, after Mock & Birkeland].
- **Maritime / coastal:** relatively warm, cloudy, frequent storms, heavy precip that can mix rain and snow; deeper, more uniform snowpack; avalanche activity spikes during storms and settles quickly [src]. Expect denser new snow and freezing-level problems [GK].
- **Intermountain / transitional:** frequent snowfall but less than coastal, cooler and generally lower density; persistent weak layers less common and shorter-lived than continental, but sometimes plague the season [src].
- **Continental:** cold, clear, infrequent low-density snowfall; shallow snowpack with faceted weak layers; human-triggered avalanches common long after storms [src].
- **Sea/lake-effect:** cold air over warmer open water produces narrow, intense bands, usually within ~40 km of the shore and sometimes up to ~150 km [src: Wikipedia, Lake-effect snow]. Snow is often light when the air is very cold [GK].
- **Alpine (Europe):** precipitation is set by flow direction against the Alpine arc — "Stau" on the windward side, foehn on the lee [src: MeteoSwiss]. Ratios vary with source air mass (Atlantic vs. polar vs. Mediterranean) [src: MeteoSwiss Nordstaulage].

## Step 3 — Apply
- Replace default 10:1 ratios with the region's typical range; still adjust storm by storm with `reading-snow-quality`.
- Use the region's favored flow direction in `storm-setups-and-patterns`.
- Use the region's powder-day profile in `powder-day-call` (e.g. Japan's daily light refills vs. Colorado's infrequent dumps).
- Cite the region's official agency and avalanche center in answers; link a local forecaster where listed.
- Always mention avalanche danger for any off-piste/backcountry question and link the regional center.

## Universal water-content classes (useful everywhere)
Low <6.7%, average 6.7–11.1%, high >11.1% water content (≈ ratios >15:1, 9–15:1, <9:1) [src: Steenburgh & Alcott 2008, BAMS, citing Ware et al. 2006; ratio conversion is arithmetic]. Steenburgh & Alcott use **≥25 cm** in 24 h as a subjective "deep-powder day" threshold [src].

## Shared sources
- Snow climates: https://avalanche.org/avalanche-encyclopedia/weather/snow-climate/
- Steenburgh & Alcott (2008), "Secrets of the Greatest Snow on Earth," BAMS: https://journals.ametsoc.org/downloadpdf/view/journals/bams/89/9/2008bams2576_1.pdf
- ENSO and US winter: https://www.climate.gov/news-features/featured-images/how-el-ni%C3%B1o-and-la-ni%C3%B1a-affect-winter-jet-stream-and-us-climate
- MJO (NOAA CPC): https://www.cpc.ncep.noaa.gov/products/precip/CWlink/MJO/mjo.shtml
- OpenSnow regional Daily Snows index: https://opensnow.com/dailysnow
- European avalanche services: https://www.avalanches.org/ (EAWS)
