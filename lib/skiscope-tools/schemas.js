import { z } from 'zod';

export const Units = z.enum(['in', 'cm']).optional();
export const Pass = z.enum(['ikon', 'epic', 'all', 'both']).optional();
export const Metric = z.enum(['past72', 'next7', 'dump', 'std', 'vsavg']).optional();
export const AskSort = z.enum(['actual72h', 'actual24h', 'forecast7d']).optional();

export const schemas = {
  search_resorts: z.object({
    query: z.string().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    state: z.string().optional(),
    pass: Pass,
    limit: z.number().int().min(1).max(40).optional(),
    units: Units,
  }),
  list_regions: z.object({}),
  get_leaderboard: z.object({
    region: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    pass: Pass,
    metric: Metric,
    limit: z.number().int().min(1).max(40).optional(),
    units: Units,
  }),
  get_resort_snow: z.object({
    resort: z.string(),
    units: Units,
  }),
  get_resort_forecast: z.object({
    resort: z.string(),
    days: z.number().int().min(1).max(10).optional(),
    units: Units,
  }),
  get_storm_status: z.object({
    resort: z.string(),
    units: Units,
  }),
  get_snow_history: z.object({
    resort: z.string(),
    units: Units,
  }),
  compare_resorts: z.object({
    ids: z.array(z.string()).min(1).max(8),
    units: Units,
  }),
  plan_trip_snapshot: z.object({
    resort: z.string(),
    start: z.string().optional(),
    end: z.string().optional(),
    units: Units,
  }),
  rank_resorts: z.object({
    sort: AskSort,
    region: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    pass: Pass,
    observedOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  get_resort: z.object({
    resort: z.string(),
  }),
  month_climatology: z.object({
    month: z.number().int().min(1).max(12).optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    pass: Pass,
    limit: z.number().int().min(1).max(12).optional(),
  }),
};

export const TOOL_NAMES = Object.keys(schemas);
