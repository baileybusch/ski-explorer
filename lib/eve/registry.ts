/**
 * Tool / skill / model registry — the filesystem under agent/ is the source of
 * truth (eve's Agent Admin equivalent). This file is the human-readable index.
 */
export const PERSONA = 'agent/instructions.md';
export const MODEL = 'lib/eve/models.ts';

export const SKILLS = [
  { id: 'present-snow', path: 'agent/skills/present-snow/SKILL.md' },
] as const;

export const TOOLS = [
  { name: 'searchResorts', file: 'agent/tools/searchResorts.ts', data: 'lib/skiscope-tools search_resorts' },
  { name: 'getResortConditions', file: 'agent/tools/getResortConditions.ts', data: 'get_resort + SNOTEL SNWD depth' },
  { name: 'getSnowForecast', file: 'agent/tools/getSnowForecast.ts', data: 'get_resort_forecast Open-Meteo' },
  { name: 'compareResorts', file: 'agent/tools/compareResorts.ts', data: 'compareResortsDetail' },
  { name: 'getTrending', file: 'agent/tools/getTrending.ts', data: 'rank_resorts / boardRank' },
  { name: 'lookupUnknownResort', file: 'agent/tools/lookupUnknownResort.ts', data: 'Open-Meteo geocoding fallback (labeled)' },
  { name: 'startReportSubscription', file: 'agent/tools/startReportSubscription.ts', data: 'Blob + Resend double opt-in' },
] as const;

export const SCHEDULES = [
  { name: 'snow-reports', file: 'agent/schedules/snow-reports.ts', cron: '30 13 * * *' },
] as const;
