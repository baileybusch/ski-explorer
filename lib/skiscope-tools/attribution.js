/** Pure (browser-safe) attribution block shared by every tool result. */
export function attribution(snow) {
  const asOf = snow?.observedFetched || snow?.dates?.[snow.today] || snow?.fetched || null;
  return {
    generatedAt: asOf,
    source: snow?.observedSource || snow?.source || 'observed + Open-Meteo forecast',
    attribution: 'US last 72h is NRCS SNOTEL or California CDEC snow-depth peak-rise (not recorded snowfall) where mapped. Elsewhere Open-Meteo snowfall_sum (est.). Forecast: Open-Meteo; US forecast days from NWS snowfall, then Open-Meteo NBM. Not resort-reported totals.',
  };
}
