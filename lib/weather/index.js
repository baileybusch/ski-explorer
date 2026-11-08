import { WEATHER_PROVIDER } from './config.js';
import * as openmeteo from './providers/openmeteo.js';
import * as metnorway from './providers/metnorway.js';

const PROVIDERS = { openmeteo, metnorway };

export function providerName() {
  return PROVIDERS[WEATHER_PROVIDER] ? WEATHER_PROVIDER : 'openmeteo';
}

export function getProvider(name = providerName()) {
  return PROVIDERS[name] || openmeteo;
}

export async function fetchForecast(coords, name) {
  return getProvider(name).fetchForecast(coords);
}

export { estimateSnowCm } from './providers/metnorway.js';
export { WEATHER_PROVIDER } from './config.js';
