# Design tokens

SkiScope uses one hue family: **cool slate (oklch hue 255)** with chroma near zero. There is no second color. Accent, snow, and warnings are lighter or heavier tints of the same hue.

Default theme is **dark**. `next-themes` follows the system when the user has not picked.

## Semantics

| Token | Role |
|---|---|
| `--background` / `--foreground` | App chrome |
| `--card` | Location cards and Weather-style tiles |
| `--primary` | Primary actions (Plan trip) — near-white on dark |
| `--accent` | Snow / “bright” data (storm badge, snow bars) |
| `--muted-foreground` | Secondary type |
| `--destructive` | Same hue, higher contrast — not red |

Radius is `1rem` so stacked tiles read like Apple Weather cards without copying their assets.

## Data, not decoration

- Snow amount = `--accent` (lightest tint).
- Storm tiers = weight and size, same hue.
- Map: CARTO dark, desaturated. Pins, heatmap, NWS, and rings are white/gray. Run difficulty is lightness, not green/blue/black.
- No multi-color gradients on the chrome.

Tokens live in `src/index.css` (`:root` light, `.dark` dark). Use semantic classes (`bg-card`, `text-muted-foreground`) — do not add `bg-blue-*`.
