/**
 * Normalize agent reply text before markdown rendering.
 *
 * Models often emit no-break / narrow spaces (U+00A0, U+202F, U+2007, U+2009) and
 * non-breaking hyphens (U+2011). Markdown then misses "- " list markers and the
 * system font draws those spaces almost zero-width, so "- Last‑72 h: ≈35 ″" renders
 * as "-Last-72h:≈35″". Map them to plain spaces / hyphens, turn "•" bullets into
 * markdown bullets, and tidy unit spacing ("35 ″" → "35″", "72 h" → "72h").
 */
const ODD_SPACES = /[\u00A0\u2007\u2009\u200A\u202F\u205F\u3000]/g;
const ODD_HYPHENS = /[\u2010\u2011]/g;
const ZERO_WIDTH = /[\u200B\u2060\uFEFF]/g;

export function normalizeChatText(text = '') {
  return String(text)
    .replace(ZERO_WIDTH, '')
    .replace(ODD_SPACES, ' ')
    .replace(ODD_HYPHENS, '-')
    // "•" / "·" / "–" bullets at line start → markdown "- "
    .replace(/^([ \t]*)[•·▪‣–—][ \t]*/gm, '$1- ')
    // "-Last 72h" (marker glued to text) → "- Last 72h", but not "-5°" or "--"
    .replace(/^([ \t]*)[-*](?=[A-Za-z])/gm, '$1- ')
    // A list straight after a paragraph line needs no blank line in GFM, but a "1." style
    // marker does; leave numbers alone. Tidy unit spacing.
    .replace(/(\d) +(″|"|”|in\b|cm\b)/g, (m, d, u) => (u === 'in' || u === 'cm' ? `${d} ${u}` : `${d}${u}`))
    .replace(/(\d) h\b/g, '$1h')
    .replace(/\b(Last|Next)-(\d+)(h|d)\b/g, '$1 $2$3')
    // "≈35" stays; make sure there's a space after a colon before a number/≈
    .replace(/:(?=[≈~\d])/g, (m, off, s) => (/\d$/.test(s.slice(0, off)) ? m : ': '));
}
