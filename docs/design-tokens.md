# Design tokens

Scoreboard mono: **one hue (oklch 255)** with chroma near zero, punched for contrast. The card’s **lightness is the data** — more snow, lighter block. A single ice tint (`#8fa6ba` / `--accent`) marks the winning rank only.

Default theme is **dark**. `next-themes` follows the system when the user has not picked.

## Named palette

| Name | Hex | Role |
|---|---|---|
| Ink | `#08090b` | Ground, inverted type |
| Slate | `#16181c` | Quiet card |
| Fog | `#c8ccd3` | Mid snow |
| Paper | `#f2f3f5` | #1 inverted card |
| Ice | `#8fa6ba` | Best-snow accent only |
| Graphite | `#7a808a` | Secondary type |

## Type

- **Barlow Condensed 800** — display snow numbers. The number is the interface.
- **Sora** — UI. Sentence case. No tracked all-caps eyebrows.

Scale is weight-first: one display size (clamp 5.4–8.2rem), ~1.6–2.1rem names, 1rem UI.

## Shape

- Cards: `--radius-card` 1.35rem (blocky, Cash App–adjacent)
- Chips / pills: full pill
- 44px minimum targets

## Data, not decoration

- Snow amount = card lightness + the display number
- Storm = weight on the same hue (badge), not a second color
- Map: OpenFreeMap dark vector, desaturated. Pins and rings stay gray
- No multi-color gradients on the chrome

Tokens live in `src/index.css`. Concepts: [design-concepts.md](design-concepts.md).
