import { validateReadout, deterministicReadout, gatherFacts } from '../lib/readout.js';

const facts = {
  resort: { name: 'Mammoth', past72: 4, next7: 6, past72Label: '4″', next7Label: '6″' },
  storm: { kind: 'Building' },
  history: { verdict: 'Running 10% above the 5-season average for Oct 24.' },
};

export function runReadoutEvals() {
  let fail = 0;
  const lines = [];

  const ok = validateReadout('Mammoth just got 4″ in the last 72h. Another 6″ is on the board.', facts);
  if (!ok.ok) { fail++; lines.push(`FAIL  grounded  ${ok.invented}`); }
  else lines.push('ok    grounded');

  const bad = validateReadout('Mammoth just got 99 inches and 12 lifts are closed.', facts);
  if (bad.ok || !bad.invented.includes(99)) { fail++; lines.push('FAIL  invented'); }
  else lines.push('ok    invented');

  const text = deterministicReadout({ type: 'resort', event: 'fresh_snow', resortName: 'Mammoth' }, facts);
  const check = validateReadout(text, facts);
  if (!text.includes('Mammoth') || !check.ok) {
    fail++;
    lines.push(`FAIL  template-grounded  ${text}`);
  } else lines.push('ok    template-grounded');

  const region = deterministicReadout({ type: 'region' }, { where: 'Japan', rows: [{ name: 'Niseko', past72Label: '3″', next7Label: '5″' }] });
  if (!region.includes('Japan') || !region.includes('Niseko')) {
    fail++;
    lines.push('FAIL  region-template');
  } else lines.push('ok    region-template');

  if (typeof gatherFacts !== 'function') { fail++; lines.push('FAIL  gather-export'); }
  else lines.push('ok    gather-export');

  return { fail, total: 5, lines };
}
