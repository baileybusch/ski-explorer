import { estimateSnowCm, providerName } from '../lib/weather/index.js';

export function runWeatherEvals() {
  let fail = 0;
  const lines = [];

  if (estimateSnowCm(10, -2) !== 10) { fail++; lines.push(`FAIL  slr-cold  ${estimateSnowCm(10, -2)}`); }
  else lines.push('ok    slr-cold');

  if (estimateSnowCm(10, 1) !== 8) { fail++; lines.push(`FAIL  slr-mix  ${estimateSnowCm(10, 1)}`); }
  else lines.push('ok    slr-mix');

  if (estimateSnowCm(10, 5) !== 0) { fail++; lines.push('FAIL  slr-rain'); }
  else lines.push('ok    slr-rain');

  if (providerName() !== 'openmeteo' && !process.env.WEATHER_PROVIDER) {
    fail++;
    lines.push(`FAIL  default-provider  ${providerName()}`);
  } else lines.push('ok    default-provider');

  return { fail, total: 4, lines };
}
