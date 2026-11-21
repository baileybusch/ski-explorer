// Pure follow-up chip logic for the home chat (no React), so evals can test it.

/** Normalize a question for "is this the same ask?" comparisons. */
export function normQ(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(right now|now|today|please|currently)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a chip would just re-ask (or near-re-ask) the question. */
export function sameQuestion(a, b) {
  const x = normQ(a);
  const y = normQ(b);
  if (!x || !y) return false;
  return x === y || (x.length > 8 && y.startsWith(x)) || (y.length > 8 && x.startsWith(y));
}

/** Open-ended "where should I go" questions: answer with a ranked pick, never a clarifying question. */
export function isOpenEndedWhere(q = '') {
  const s = String(q).toLowerCase().replace(/[’]/g, "'");
  if (!/\bwhere\b|\bwho('s| is| has| got)\b|\bwhich (mountain|resort|place)|\bbest (snow|skiing|place|spot)|most (new )?snow/.test(s)) return false;
  return /dump|snow|ski|ride|powder|pow\b|go\b|good|best|storm|fresh/.test(s);
}

const REGIONS = ['Utah', 'Colorado', 'Tahoe', 'the Alps'];

/**
 * @param {{ asked: string, main: any, hasOwnData: boolean }} ctx
 * @returns {{ label: string, send?: string, toggleData?: boolean }[]}
 */
export function buildFollowups({ asked = '', main = null, hasOwnData = false }) {
  const a = String(asked).toLowerCase();
  const askedWhy = /\bwhy\b|walk me through/.test(a);
  const askedData = /numbers|data/.test(a);
  const data = hasOwnData
    ? { label: 'Show the data', toggleData: true }
    : askedData ? null : { label: 'Show the numbers', send: 'Show me the key numbers.' };
  const why = askedWhy ? null : { label: 'Why?', send: 'Why? Walk me through it.' };
  const out = [];
  let max = 3;
  if (!main) {
    out.push(
      { label: "Where's it dumping?", send: "Where's it dumping right now?" },
      { label: 'Best this weekend?', send: 'Where should I ski this weekend?' },
      { label: "How's Mammoth?", send: "How's Mammoth looking?" },
    );
  } else if (main.kind === 'compare') {
    out.push(why, data, { label: 'Which has better snow?', send: 'Which one has the better snow quality?' });
  } else if (main.kind === 'rank') {
    // Answer first; narrowing by region comes after, as chips.
    max = 4;
    const rows = main.rows || [];
    const narrowed = !!main.where && !/worldwide|everywhere|all regions/i.test(main.where);
    const topWhere = String(rows[0]?.where || rows[0]?.region || '').toLowerCase();
    const region = REGIONS.find(r => !topWhere.includes(r.replace('the ', '').toLowerCase())) || 'Utah';
    out.push(
      askedWhy ? null : { label: 'Why there?', send: 'Why there? Walk me through it.' },
      data,
      narrowed ? null : { label: 'Near me?', send: "What's good near me?" },
      narrowed ? null : { label: `Just ${region}?`, send: `What about just ${region}?` },
      rows[0]?.name ? { label: `How's ${rows[0].name}?`, send: `How's ${rows[0].name} looking?` } : null,
    );
  } else {
    // One mountain: the answer stays short; these chips peel back the layers.
    const name = main.resort?.name || main.name || 'there';
    max = 4;
    const askedSnow = /snow (quality|feel)|tell me more about the snow/.test(a);
    out.push(
      why,
      askedSnow ? null : { label: 'Tell me more about the snow', send: `Tell me more about the snow at ${name}: how it feels and why.` },
      { label: "Where's better?", send: `Where's better than ${name} right now?` },
      data,
    );
  }
  // Never echo the question that was just asked.
  return out
    .filter(Boolean)
    .filter(c => !sameQuestion(c.send || c.label, asked) && !sameQuestion(c.label, asked))
    .slice(0, max);
}
