# Design: block board + mountain profile

Bailey compared two scoreboard concepts on the same preview. **B won.** A (full-screen leaderboard stack with flip cards) is gone. `?design=a|b` is ignored so old links still open; we no longer write it.

Primary job: friends and families glance at a phone and see **who is winning the snow**, then tap into a mountain. Secondary: search a region, set people/dates, Plan trip.

## Home — block board

A packing grid that **always fills the viewport**. No leftover empty cells.

- Ranked by the selected window (24h / 72h / 7d observed, or Next 7 forecast).
- Leader is double-width / double-tall when the count is 3 or 5+. Four resorts on a phone are an even 2×2. One or two results scale up to fill.
- Remaining blocks share rows; the last row stretches so it is never half-empty.
- If a filter yields few resorts, blocks grow. If there are many, the first screen still tiles edge-to-edge and the rest is continuous scroll (same row size, same no-gap rule at the end).
- Lightness encodes snowfall; #1 inverts to paper with the ice accent.
- Tap a block → **profile**, not a flip.

## Header

One top row: time windows (24h / 72h / 7d / Next 7) and the **hamburger**. Directly below, a featured agent/search bar with rotating ghost text. The Trip pill (people/dates) sits under search.

The hamburger holds: people/dates/home airport/units, pass (Ikon / Epic / All), region/scope, map layers, My Resorts / watchlist, about/credits.

## Profile

Full-screen. The existing MapLibre map is the **hero background** (pitched 3D terrain, centered on the resort, runs/lifts when we have OSM). Interaction is off so the page scrolls; a slow parallax follows the tile stack. Overlay: name, pass, huge snow number for the selected window, key conditions.

Below the hero, rounded tiles that scroll vertically and swipe horizontally where a group has two faces (hourly ↔ 7-day, facts ↔ mountain stats):

- Snow bars (24h / 72h / 7d / Next 7)
- Weather (hourly + 7-day carousel)
- Storm timeline
- Trip (people/dates, Google Flights first, lodging, affiliate wrap)
- Facts
- Lodging-map toggle
- Persistent **Plan trip**

Swipe left/right pages to the next/previous resort in the current board order. Back is a chevron or a swipe-down on the hero; the board restores its scroll position.

## Terrain

AWS Terrarium (`elevation-tiles-prod`) painted “API KEY REQUIRED” on the 3D mesh at higher zooms. The DEM is now **Mapterhorn** (`https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`, terrarium, tileSize 512, maxzoom 12, no key). If that source errors, terrain drops and the hero keeps Esri imagery + hillshade without 3D.

## What this cut

- Concept A (snap leaderboard + flip card)
- A/B toggle and `?design=` write
- Weather-app home list
- Globe as home
- Top-12-only board with empty last-row cells

Kept: agent bar, trip people/dates, deep links (`/?resort=&from=&to=&people=&mode=`), weather/storms, watchlist, Plan trip, affiliates, paused email.

Default window is still **Next 7**. In October the trailing 24h / 72h / 7d boards are honestly quiet.
