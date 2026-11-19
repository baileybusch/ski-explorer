/**
 * Graded powder-day call from powder-day-call/SKILL.md.
 * Tiers are a synthesis of Mammoth Snowman labels, not a resort declaration.
 */
export function powderDayCall({
  last24In = 0,
  last72In = 0,
  slr = null,
  windSustainedMph = null,
  windGustMph = null,
  snowLevelFt = null,
  baseFt = null,
} = {}) {
  const snow = Number(last24In) || 0;
  let grade = 'no';
  if (snow >= 12) grade = 'mountain-wide';
  else if (snow >= 6) grade = 'powder-day';
  else if (snow >= 2) grade = 'low-end';

  const windHold = (windSustainedMph != null && windSustainedMph >= 45)
    || (windGustMph != null && windGustMph >= 65);
  const rainAtBase = snowLevelFt != null && baseFt != null && snowLevelFt > baseFt + 500;
  const heavy = slr != null && slr < 8;

  const reasons = [];
  if (windHold) {
    reasons.push('Wind holds likely: sustained ≥45 mph or gusts ≥65 mph (skill: lifts often hold at 45–55 / 65).');
    if (grade === 'powder-day' || grade === 'mountain-wide') grade = 'no';
  }
  if (rainAtBase) {
    reasons.push('Snow level is above the base — rain or mixed at the bottom, snow higher.');
    if (grade === 'powder-day' || grade === 'mountain-wide') grade = 'no';
  }
  if (heavy) reasons.push('Low snow-to-liquid (wet/cement). Depth can still ski, but it is a base-builder, not a blower.');
  if (grade === 'no' && snow < 2 && !windHold && !rainAtBase) reasons.push('Under ~2″ by morning-report time — no powder (maybe wind buff).');

  const labels = {
    no: 'No',
    'low-end': 'Low-end powder',
    'powder-day': 'Powder day',
    'mountain-wide': 'Mountain-wide powder day',
  };

  return {
    grade,
    label: labels[grade],
    flagged: grade === 'powder-day' || grade === 'mountain-wide',
    last24In: snow,
    last72In: Number(last72In) || 0,
    slr,
    windHold,
    rainAtBase,
    windSustainedMph,
    windGustMph,
    snowLevelFt,
    baseFt,
    reasons,
    basis: 'powder-day-call skill: morning-report 24h proxy + quality (SLR) + wind holds + snow level vs base. Not a resort powder-day declaration. Last 24h proxy is SNWD depth-rise or model est., not recorded snowfall.',
  };
}
