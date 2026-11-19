---
name: reading-snow-quality
description: Use when judging what new or forecast snow will actually ski like — converting water (SWE / liquid / QPF) to depth, reading snow-to-liquid ratios, deciding powder vs. dense "Sierra cement" vs. wind-packed, or explaining why a snow total looks low or high for the water that fell.
---

# Reading snow quality: water, ratio, density

Source: method distilled from the Mammoth Snowman site (mammothsnowman.com) — Ted Schlaepfer, CCM ("Mammoth WeatherGuy", Powder Forecast posts) and Steve Taylor ("The Mammoth Snowman", daily discussions and Weather FAQ). Paraphrased; numbers are theirs unless tagged **[general knowledge]**.

> **Regional adjustment:** Before applying any ratio or density here to a specific resort, load `regional-snow-climates` and use that region's typical ratios (e.g. Alta's mean new-snow water content is 8.4%, ≈12:1; Hokkaido runs lighter; Cascades and Honshu run denser). All Mammoth/Sierra numbers and examples below are **Sierra-specific** (maritime climate), not global defaults.

## When to use
- A user asks "will it be good snow?", "is it powder or cement?", "why only 8 inches from all that rain?"
- You have liquid / SWE / QPF numbers and need inches of snow, or vice versa.
- You need to describe the texture of a storm's snow, layer by layer.

## Core principles
1. **Water is the real forecast; inches are derived.** The Snowman forecasters always pair depth with water, e.g. "24–28" (H2O = 2.50"–3.00")". Start from liquid, then apply a ratio.
2. **The snow-to-liquid ratio (SLR) sets quality.** Their range: about **6:1 in warm storms vs. 20:1 in cold ones**. Low ratio = dense, heavy; high ratio = light, fluffy.
3. **Their working ratios by storm type** (all quoted from posts):
   - Warm front-end / near the snow level: **~8:1** ("wet and heavy").
   - Typical mid-storm: **10:1 to 12:1** ("and lighter at the end").
   - Colder storm: **11:1 to 14:1** ("lighter, colder snow").
   - Cold northern trough: **12:1 to 16:1** ("fluffy snow").
4. **Sierra cement = high water content.** Heavy, wet snow common in atmospheric-river storms; great for base building and why the base lasts into early summer. Early season, cement is *welcome*: "beyond low tide right now so bring on the cement."
5. **Wind makes snow denser and shallower than the water suggests.** Strong winds shatter flakes (the site calls it the "fracking effect"), producing dense, heavy powder and *reducing* measured totals. Wind also packs new snow as it falls, wind-loads pockets, and strips ridges.
6. **Timing inside a storm matters.** If more precip falls during the warmer first half, the snow "will run a little denser" than an overnight storm. Snow that ends "on calmer air" leaves a lighter top layer.
7. **Elevation changes both depth and quality.** Lower stations near the snow level start wetter (lower ratio); the summit can get **double** the snow of the lower runs, but up high wind can pack it.

## Step-by-step analysis
1. Get liquid (SWE/QPF) per elevation band if available (base, mid, summit).
2. Get or estimate snow level vs. each band (see `reading-forecasts`). Within ~1,000 ft above the snow level, expect low ratios (~8:1) **[general knowledge: the band just above the snow level is the wettest]**.
3. Pick a ratio from the storm type table above; use a *changing* ratio if the storm starts warm and turns cold (e.g. 8:1 climbing to 11:1).
4. Depth ≈ liquid × ratio. Then **shave** for strong wind (gusts 50+ mph) and settling.
5. Describe the column: dense base layer, lighter top? That "right-side-up" stack skis best **[general knowledge]**; light-under-heavy ("upside-down") skis worse and can be an avalanche concern **[general knowledge]**.
6. Check aftermath: clearing + light wind + cold = snow stays good ("temperatures seasonably cold... snow conditions should stay excellent"). Sun/warmth = surface gets wet/sticky.

## Rules of thumb (with numbers)
- **~1" of water ≈ 10–12" of snow** in an average storm. Their conversions: 1.00–1.25" → 10–12"; 1.35–1.65" → 14–16"; 1.50–2.00" → 15–20"; ~1.25" → "about a foot"; ~2" → "almost two feet" / "almost 20"".
- Big wet storm: 2.50–3.00" water → 24–28" (≈9–10:1). 5" of liquid → "four feet".
- Warm storm 6:1 → 1" water = 6"; cold storm 20:1 → 1" water = 20" (FAQ range).
- Ratios usually climb through a storm as cold air arrives (8:1 → 11:1; 9:1 → 12:1).
- Up top in strong wind: ratios "10:1 to 13:1" on paper, but expect "dense, wind-packed snow" and wind-loaded pockets (~20" where the average is 14–18").
- **[general knowledge]** Density % ≈ 100 ÷ ratio: 8:1 ≈ 12% (heavy), 10:1 = 10% (average), 15:1 ≈ 7% (light), 20:1 = 5% (very light / "champagne").
- **[general knowledge]** New snow settles roughly 10–30% in the first day or two; don't compare a fresh storm-total with a settled base reading.

## Worked examples
**A. Warm-start storm (Mammoth, Nov 2026, Snowman):** 1.00–1.25" water at Main, ratios 8:1 rising to 11:1 → 9–13". Snow level 7,500–8,000 ft at onset, so the first inches at 8,900 ft are "wet and heavy." Verdict: base-building cement, then a lighter top. Good for coverage, not a classic blower day.

**B. Big slow storm (Ted, Nov 17 2026):** ECMWF ~3.75" SWE, GFS and NBM ~4.5". Path is favorable, storm "isn't a fast mover," snow levels 4,500–6,500 ft ("base-type snowfall"). He expects "at least three feet at Main and hopefully closer to four," "4–5 feet up top." ≈10:1 — dense enough to build base, deep enough to ski.

**C. Cold trough (Snowman):** 1–2" water at 12:1–16:1 → "roughly 9–18 inches at Main Lodge and 1–2 feet" at mid-mountain. Verdict: lighter, fluffier, higher-quality powder.

**D. Generalized to any resort (hypothetical):** Rockies/Utah report 1.0" SWE with 15:1 → ~15" light powder. Pacific NW 1.0" SWE at 8:1 → ~8" heavy. Same water, very different day.

## Pitfalls
- Quoting inches without water — two 12" days can ski completely differently.
- Using one fixed 10:1 ratio for a storm that starts warm and ends cold.
- Forgetting wind: windy storms "measure a little shallower than the water would suggest."
- Calling cement "bad" early season — dense snow is what covers rocks and builds base.
- Applying base-area numbers to the summit (or vice versa); quality and depth vary with elevation and aspect.
- Presenting general-science density numbers as the source's numbers.
