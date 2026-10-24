/**
 * Live price quotes only. Deep links live in lib/links.js so every outbound
 * booking URL can take affiliate params from config.js later.
 */
export { flightLinks, lodgingLinks } from './links.js';

const providers = { flights: null, lodging: null };

export function registerPriceProvider(kind, fn) {
  if (kind === 'flights' || kind === 'lodging') providers[kind] = fn;
}

export async function flightQuote(query) {
  if (typeof providers.flights !== 'function') return null;
  try { return await providers.flights(query); } catch { return null; }
}

export async function lodgingQuote(query) {
  if (typeof providers.lodging !== 'function') return null;
  try { return await providers.lodging(query); } catch { return null; }
}

if (typeof window !== 'undefined' && window.SKISCOPE_PRICES) {
  if (window.SKISCOPE_PRICES.flights) registerPriceProvider('flights', window.SKISCOPE_PRICES.flights);
  if (window.SKISCOPE_PRICES.lodging) registerPriceProvider('lodging', window.SKISCOPE_PRICES.lodging);
}
