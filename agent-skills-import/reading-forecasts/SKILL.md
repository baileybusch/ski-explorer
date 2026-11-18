---
name: reading-forecasts
description: Use when interpreting weather-model output for a ski resort — comparing ECMWF, GFS, NBM and ensembles, picking a snowfall number from disagreeing models, judging confidence by lead time, timing a storm, or reading snow levels against a resort's base and summit elevations.
---

# Reading forecasts: models, confidence, timing, snow levels

Source: method distilled from mammothsnowman.com — Ted Schlaepfer, CCM (twice-weekly Powder Forecast) and Steve Taylor ("The Mammoth Snowman", daily discussion and 50-question Weather FAQ). Paraphrased; numbers are theirs unless tagged **[general knowledge]**.

> **Regional adjustment:** Load `regional-snow-climates` for the resort's region to get its official agency, avalanche center, local forecasters, typical freezing levels and model quirks (e.g. JMA for Japan, MeteoSwiss/SLF for Switzerland). The Mammoth examples and the ECMWF-first preference below come from Sierra forecasters; keep the reasoning but check the regional file for local sources.

## When to use
- Models disagree on how much snow a storm brings and you must give one range.
- A user asks "how sure are you?" or "will it actually snow next weekend?"
- You need to know whether a storm is snow or rain at the base vs. summit.

## Core principles
1. **The European is the anchor.** Their stated hierarchy: ECMWF and the GEFS ensembles, "priority given to the ECM," plus the National Blend of Models (NBM) and high-res short-range guidance. The GFS "can flip wildly or over-amplify systems" — don't follow it run to run.
2. **Ensembles beat single runs.** Ensembles measure uncertainty ("wisdom of the crowd"). When a deterministic run shows a monster storm the ensemble doesn't, Ted calls it "not believable just yet" and follows the ensemble (ECM EPS).
3. **Trust the trends, not one run.** Small shifts in wind direction or temperature swing mountain totals; watch whether successive runs trend wetter or drier.
4. **Confidence decays with lead time:**
   - **0–72 hours:** storm totals are "pretty solid."
   - **Inside ~5 days:** "moderate confidence" on snowfall numbers.
   - **Beyond 72 h:** "watch trends, not totals."
   - **Beyond 10 days:** "low confidence"; days ~11–15+ are the "fantasy range."
5. **Blend, then lean with a reason.** He reports each model's liquid, then states which he follows and *why* — e.g., leans wetter when "the storm looks to have a favorable path, isn't a fast mover"; follows the ECM EPS when the GFS is the lone wet outlier.
6. **Snow level vs. elevation decides snow vs. rain and quality.** Snow levels well below the base = "base-type snowfall" (snow top to bottom). Snow levels near or above the base = wet start or rain low; "will have to be monitored."
7. **Express uncertainty explicitly.** Ranges (never single numbers), a **1–5 confidence score** (very low to very high), and plain hedges.

## Step-by-step analysis
1. **Collect liquid (QPF) per model** for the storm window: ECMWF, ECM ensemble (EPS), GFS, GEFS, NBM; others (Canadian, AI models) as tie-breakers.
2. **Note the spread.** Small spread (e.g., 0.75" vs 1.0" vs 1.5") → confidence 4. Big spread (5" GFS vs 0.75" ECMWF) → follow the ensemble, confidence ≤3.
3. **Choose a lean and state the reason:** storm path, speed (slow = more), jet strength, flow direction (see `storm-setups-and-patterns`).
4. **Convert to snow** with `reading-snow-quality` ratios, per elevation band.
5. **Check snow levels** against base, mid and summit elevations through the storm (they often fall as cold air arrives).
6. **Time it to the snow-report window.** Ted's forecasts are valid for the prior 24 h as reported in the 6–7 AM report at a named site (Main Lodge's Sesame snow course). Say which morning gets the snow.
7. **Assign confidence 1–5** and say when it will firm up ("the Friday update should have it dialed in").

## Thresholds and rules of thumb
- Confidence windows: 0–72 h solid; ≤5 days moderate; >10 days low.
- Pattern change signals (MJO, stratospheric warming) take time: MJO influence reaches California in **7 to 14 days**; a sudden stratospheric warming usually shows in our weather **3–4 weeks** later, if at all.
- **Ridging = no snow.** If a ridge is over the area, expect none.
- Dry spells typically run **2–4 weeks** (2–3 week cycles), then "more often than not, the door opens."
- When snow levels are around 8,500–9,000 ft (Mammoth, April cutoff low), expect rain or wet snow below that until the cold air arrives.
- Normal late-April precip at Mammoth ≈ **0.50" a week** — use a resort's climatology as a baseline for "above/below normal."

## Worked examples
**A. Agreement → high confidence (Ted, Nov 17 2026):** ECMWF ~3.75" SWE, GFS ~4.5", NBM ~4.5". Favorable path, slow mover → leans wet: Thu 24–28" (H2O 2.50–3.00") **4/5**, Fri 15–20" **4/5**. Snow levels 6,000–6,500 → 4,500–5,000 ft = base-type.

**B. Lone wet outlier (Ted, Nov 13 2026):** GFS ~5" liquid ("four feet"), ECMWF ~0.75", ECM EPS ~1". "Forecast follows the ECM EPS, with hope that the GFS model is onto something; we will know on the Tuesday update."

**C. Week-out uncertainty:** ECM 2" liquid vs ECM EPS 1.25"; snow levels "could rise to 7000 feet." He leans to the EPS ("another foot of base type snowfall looking likely") and flags snow level as the watch item.

**D. Any resort (hypothetical):** Jackson Hole, 4 days out: ECMWF 1.2", GFS 2.4", NBM 1.4", EPS mean 1.3" → follow EPS/NBM, ~13–18" at 12:1, confidence 3, "GFS is the high outlier; we'll know more in 48 hours."

## Pitfalls
- Reporting the single wettest model as "the forecast" (classic GFS bust).
- Giving inches 10+ days out as if they were real — talk pattern, not totals.
- Ignoring storm speed: slow movers pile up totals; fast movers under-deliver.
- Using valley/town snow levels for a summit forecast, or vice versa.
- Forgetting the report window — snow that falls after the 6–7 AM report counts toward the *next* morning.
- Hiding uncertainty. A forecast can still "bust"; the Snowman says so openly.
