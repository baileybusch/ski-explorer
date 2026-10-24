# Destination audit — Ikon & Epic 26/27

SkiScope’s home globe is meant to show **where an Ikon or Epic pass actually goes**, not only North America. This file is the source list we checked against and what we added.

Email alerts stay paused (`EMAIL_ALERTS_ENABLED=false`). This audit does not change cron or subscriber code.

## Official lists (retrieved 2026-10-24)

| Pass | Page | What we used |
|---|---|---|
| Ikon Pass 26/27 | [ikonpass.com/en/shop-passes/ikon-pass](https://www.ikonpass.com/en/shop-passes/ikon-pass) | Destination groups on the shop page (Rockies, West, Midwest/East, Canada, Europe, Oceania, Asia, South America) |
| Ikon FAQ / openings | [ikonpass.com/en/faq](https://www.ikonpass.com/en/faq), [opening-closing-dates](https://www.ikonpass.com/en/opening-closing-dates) | Named sub-areas (Niseko United’s four mountains; Dolomiti’s 12; Valle d’Aosta areas) |
| Ikon Asia expansion | [Alterra news, 2026-09-10](https://www.alterramtn.co/en/news/ikon-pass-expands-further-into-japan-and-china-for-winter-2627) | Madarao, Beidahu, Lake Songhua joining 26/27 |
| Epic Europe | [epicpass.com/regions/europe.aspx](https://www.epicpass.com/regions/europe.aspx) | Andermatt & Crans-Montana unlimited; Verbier, Skirama, 3 Vallées, Arlberg, Zillertal, Sölden, Silvretta Montafon, Saalbach / Zell am See |
| Epic partners | [epicpass.com/regions/partner-resorts.aspx](https://www.epicpass.com/regions/partner-resorts.aspx) | Hakuba Valley, Rusutsu, Telluride, Resorts of the Canadian Rockies |
| Epic Australia access | [epicaustraliapass.com.au/pass-access](https://www.epicaustraliapass.com.au/pass-access/) | Perisher, Hotham, Falls Creek (Falls Creek is unlimited on Epic Australia; confirm Epic Pass on epicpass.com) |

Coordinates for new pins come from OpenStreetMap / widely published resort locations (see `scripts/destinations.json`). We do **not** invent vertical, acres, or lift/run counts for new areas until OpenSkiMap is matched; those fields stay empty and the UI says so.

## Already in the NA set (unchanged membership)

Ikon NA + Eagle Point and Epic’s 37 Vail-owned NA mountains were already in `scripts/resorts.json` from v4. No NA Ikon resort was missing from that file relative to the 26/27 shop page.

**Not added (on purpose)**

- Ikon **Bonus Mountains** (2-day: Cranmore, Butternut, Jiminy, Buck Hill, Caberfae, Devil’s Head, Wild Mountain, Giants Ridge, Snowy Range, Tamarack, Grouse).
- Ikon **heli** ops (CMH, Mike Wiegele).
- **Norway** — not on the current Ikon 26/27 list (Hafjell / Kvitfjell are not listed). Do not add from memory.

## Added this revision

### Ikon international

- **France:** Chamonix Mont-Blanc, Megève
- **Italy:** Dolomiti Superski (Cortina, Kronplatz, Alta Badia, Val Gardena, Arabba/Marmolada, Val di Fassa) — 6 of the 12 named areas, enough to search “Dolomites”; remaining six can be added the same way. Valle d’Aosta: Cervinia, Courmayeur, Monterosa
- **Andorra:** Grandvalira
- **Austria:** Ischgl, Kitzbühel
- **Switzerland:** Zermatt, St. Moritz
- **New Zealand:** Coronet Peak, The Remarkables, Mt Hutt
- **Australia:** Mt Buller, Thredbo
- **Japan:** APPI, Arai, Furano, Madarao, Mt.T, Myoko Suginohara, NEKOMA, Niseko United (Hirafu, Hanazono, Village, Annupuri), Shiga Kogen, Zao Onsen
- **China:** Beidahu, Lake Songhua, Yunding
- **Korea:** Mona Yongpyong
- **Chile:** Valle Nevado

### Epic international + partners previously excluded

v4 skipped Telluride and Resorts of the Canadian Rockies (limited partner access). They are on the official partner list, so they are in the globe with access labeled **partner**.

- **Switzerland:** Andermatt-Sedrun-Disentis (unlimited), Crans-Montana (unlimited), Verbier 4 Vallées (5 consecutive days)
- **Italy:** Madonna di Campiglio standing in for Skirama Dolomiti (7 consecutive days)
- **France:** Les 3 Vallées (7 consecutive days)
- **Austria:** Ski Arlberg / St. Anton (3 consecutive days, lodging partner), Mayrhofen / Zillertal, Sölden, Silvretta Montafon, Saalbach / Zell am See-Kaprun
- **Japan:** Hakuba Happo-one (Hakuba Valley, 5 consecutive days), Rusutsu (5 consecutive days)
- **Australia:** Perisher, Hotham; Falls Creek (Epic Australia; confirm Epic Pass)
- **US partner:** Telluride (7 days)
- **RCR partners:** Fernie, Kicking Horse, Kimberley, Nakiska, Mont-Sainte-Anne, Stoneham

Hakuba Valley is 10 resorts on Epic’s partner page. We pin **Happo-one** as the search/fly target rather than 10 overlapping pins.

## Airports

`iata` on each index row is the usual commercial gateway for a ski week (for example Cottonwoods → SLC, Niseko → CTS, Zermatt → GVA), not always the closest dirt strip. Home airport defaults to **SAN**.

## Snow fetch

`scripts/fetch_snow.py` now samples a **2×2 grid + one mid-mountain point** (5 locations / resort). Grid points request daily snowfall only; the center also requests tmax/tmin/weathercode and hourly snow depth. That keeps a full worldwide run under Open-Meteo’s ~5,000 weighted calls / hour. The daily GitHub Action remains an example only — do not turn it on from this change.

Typical (not forecast) snowfall for dates past the 7-day horizon is the day-of-year average of `public/data/seasons/*.json` (Nov–Apr, ERA5). Southern-hemisphere typical seasons are not in that archive yet (`HEMI=S python3 scripts/fetch_seasons.py`).
