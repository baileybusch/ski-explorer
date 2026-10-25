# Design concepts A and B

Two boards, same data. Switch with `?design=a` / `?design=b` or the tiny control in Settings. Default is **A**.

Primary job: friends and families glance at a phone and see **who is winning the snow**. Secondary: search a region, set people/dates, Plan trip.

## A — Leaderboard stack

One resort per screen. Vertical snap. The snow number is the card.

- Ranked by the selected window (24h / 72h / 7d observed, or next 7 forecast).
- Full-width block. Lightness encodes snowfall; #1 inverts to paper with the ice accent on the rank.
- Tap flips to a compact back: 7-day bars, storm line, flights/lodging, Plan trip.
- Map is a floating button, not a home.

**Fits** the primary use case. You do not hunt. You flick. The #1 card is the answer.

**Costs** scanning. Comparing #4 vs #7 means scrolling. A 60-resort Ikon list is a long deck.

## B — Block board

A 2-column grid of 8–12 blocks. The leader is double-width. Each block is snow + name + sparkline. Tap expands into the A card (then flip).

**Fits** comparison. You see the field at once.

**Costs** density. On an iPhone SE the blocks get tight. The snow number cannot be as huge. The “one idea per card” Cash App feeling is weaker.

## Tradeoffs

| | A | B |
|---|---|---|
| Glance at the winner | Best | Good |
| Compare 8–12 | Weak | Best |
| Phone-first / SE | Best (one card, no inner scroll) | Tight |
| Plan from a card | Flip, then Plan | Expand → flip → Plan |
| Map | Optional FAB | Same |

## Recommendation

**Ship A as the default.** The product Bailey described is a monitor, not an atlas. A family opening this on the couch wants the top of the pile, in a number they can read from across the kitchen. B is the better *explorer* once someone asks “what else is close?” — keep it as the other concept on the same preview so he can feel both.

Default window is **Next 7**. In October the trailing 24h / 72h / 7d boards are honestly quiet (zeros). The forecast window is where the ranking has meaning right now.

## What this cut

- Weather-app home list, swipe-between-watched, and stacked detail tiles
- Globe as home
- Pass + storms + layers crammed into one hamburger
- My Resorts as the first section (watch still lives on the card back; the agent can still open a watch-only list)
- Redundant Explore chrome

Kept: agent bar, trip people/dates, deep links, weather/storms data, watch, Plan trip, affiliates, paused email.
