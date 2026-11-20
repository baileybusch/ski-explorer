// WCAG contrast check for the dark-theme design tokens in src/index.css.
// Usage: node scripts/check-contrast.mjs   (exits 1 if any pair is below its target)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const dark = css.slice(css.indexOf('.dark {'), css.indexOf('}', css.indexOf('.dark {')));
const tok = {};
for (const m of dark.matchAll(/--([\w-]+):\s*oklch\(([^)]+)\)/g)) {
  const [l, c, h, , a] = m[2].replace('/', ' / ').split(/\s+/);
  tok[m[1]] = { l: +l, c: +c, h: +h, a: a ? parseFloat(a) / (a.endsWith('%') ? 100 : 1) : 1 };
}

function oklchToLinear({ l, c, h }) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map(v => Math.min(1, Math.max(0, v)));
}
const lum = rgb => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const ratio = (fg, bg) => {
  const [a, b] = [lum(oklchToLinear(tok[fg])), lum(oklchToLinear(tok[bg]))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const PAIRS = [
  ['foreground', 'background', 4.5], ['muted-foreground', 'background', 4.5],
  ['foreground', 'card', 4.5], ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'surface-raised', 4.5],
  ['foreground', 'chat-panel', 4.5], ['muted-foreground', 'chat-panel', 4.5],
  ['muted-foreground', 'chat-input', 4.5],
  ['bubble-user-fg', 'bubble-user', 4.5], ['bubble-agent-fg', 'bubble-agent', 4.5],
  ['primary-foreground', 'primary', 4.5], ['accent-foreground', 'ice', 4.5],
  ['ice', 'background', 3], ['ice', 'card', 3], ['ice', 'chat-panel', 3],
];
let bad = 0;
for (const [fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${fg} on ${bg}: ${r.toFixed(2)}:1 (min ${min})`);
}
process.exit(bad ? 1 : 0);
