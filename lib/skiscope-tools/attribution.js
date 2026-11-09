/** Pure (browser-safe) attribution block shared by every tool result. */
export function attribution(snow) {
  const asOf = snow?.observedFetched || snow?.dates?.[snow.today] || snow?.fetched || null;
  return {
    generatedAt: asOf,
    source: snow?.observedSource || snow?.source || 'observed + Open-Meteo forecast',
    attribution: 'US last 72h is NRCS SNOTEL snow-depth peak-rise (not recorded snowfall) where mapped. Elsewhere Open-Meteo snowfall_sum (est.). Forecast: Open-Meteo. Not resort-reported totals.',
  };
}
