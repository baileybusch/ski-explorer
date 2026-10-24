/**
 * Run: node evals/run.mjs
 *
 * Always scores the deterministic parser.
 * Set RUN_LLM=1 (and AI_GATEWAY_API_KEY) to also hit the LLM path.
 */
import { readFileSync } from 'node:fs';
import { parseTripSentence } from '../lib/agent/parseTrip.js';
import { llmAvailable, runLlm } from '../lib/agent/runAgent.js';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const resorts = JSON.parse(readFileSync(new URL('../public/data/resorts-index.json', import.meta.url), 'utf8'));
const regions = JSON.parse(readFileSync(new URL('../public/data/gazetteer.json', import.meta.url), 'utf8')).regions;
const today = cases.today;
const ctx = { resorts, regions, today };

function check(parsed, expect) {
  const miss = [];
  if (expect.region && parsed.region?.id !== expect.region) miss.push(`region ${parsed.region?.id} != ${expect.region}`);
  if (expect.resort && parsed.resort?.id !== expect.resort) miss.push(`resort ${parsed.resort?.id} != ${expect.resort}`);
  if (expect.from && parsed.from !== expect.from) miss.push(`from ${parsed.from} != ${expect.from}`);
  if (expect.to && parsed.to !== expect.to) miss.push(`to ${parsed.to} != ${expect.to}`);
  if (expect.adults != null && parsed.adults !== expect.adults) miss.push(`adults ${parsed.adults} != ${expect.adults}`);
  if (expect.kids != null && parsed.kids !== expect.kids) miss.push(`kids ${parsed.kids} != ${expect.kids}`);
  if (expect.people != null && parsed.people !== expect.people) miss.push(`people ${parsed.people} != ${expect.people}`);
  if (expect.pass && parsed.pass !== expect.pass) miss.push(`pass ${parsed.pass} != ${expect.pass}`);
  if (expect.home && parsed.home !== expect.home) miss.push(`home ${parsed.home} != ${expect.home}`);
  if (expect.sort && parsed.sort !== expect.sort) miss.push(`sort ${parsed.sort} != ${expect.sort}`);
  if (expect.mode && parsed.mode !== expect.mode) miss.push(`mode ${parsed.mode} != ${expect.mode}`);
  if (expect.nearRegion && parsed.near?.region !== expect.nearRegion) miss.push(`near ${parsed.near?.region} != ${expect.nearRegion}`);
  return miss;
}

let fail = 0;
console.log(`deterministic parser  today=${today}  ${cases.cases.length} cases\n`);
for (const c of cases.cases) {
  const parsed = parseTripSentence(c.text, ctx);
  const miss = check(parsed, c.expect);
  if (miss.length) {
    fail++;
    console.log(`FAIL  ${c.id}`);
    console.log(`  text: ${c.text}`);
    console.log(`  ${miss.join('; ')}`);
    console.log(`  got: ${JSON.stringify({ region: parsed.region, resort: parsed.resort, from: parsed.from, to: parsed.to, adults: parsed.adults, kids: parsed.kids, pass: parsed.pass, home: parsed.home, sort: parsed.sort, mode: parsed.mode, near: parsed.near })}`);
  } else {
    console.log(`ok    ${c.id}`);
  }
}

if (process.env.RUN_LLM === '1' && llmAvailable()) {
  console.log('\nLLM path (best-effort, does not fail the suite)\n');
  for (const c of cases.cases.slice(0, 3)) {
    try {
      const parsed = parseTripSentence(c.text, ctx);
      const out = await runLlm(c.text, { ...ctx, snow: { dates: [today], today: 0, resorts: {} }, typical: { windows: {} } }, parsed);
      console.log(`llm   ${c.id}  actions=${out.actions.length}  mode=${out.mode}`);
    } catch (e) {
      console.log(`llm   ${c.id}  skipped (${e.message})`);
    }
  }
} else {
  console.log('\nLLM path skipped (set RUN_LLM=1 and AI_GATEWAY_API_KEY to try it).');
}

console.log(`\n${cases.cases.length - fail}/${cases.cases.length} deterministic cases passed`);
process.exit(fail ? 1 : 0);
