import type { UIMessage } from 'ai';

/** Shapes returned by lib/skiscope-tools/askTools.js. Both the model and the fallback emit these. */
type SourceMeta = {
  asOf: string | null;
  forecastEnd: string | null;
  horizonDays: number;
  generatedAt: string | null;
  source: string;
  attribution: string;
};

export type SnowRow = {
  id: string;
  name: string;
  where: string | null;
  actual72Cm: number;
  actual24Cm: number;
  next7Cm: number;
  actual72In: number;
  actual24In: number;
  next7In: number;
  estimated: boolean;
  source: string;
};

export type Facts = {
  summitM: number | null;
  baseM: number | null;
  verticalM: number | null;
  runs: number | null;
  lifts: number | null;
  airport: string | null;
  town: string | null;
  passes: string[];
  web: string | null;
};

export type AskSort = 'actual72h' | 'actual24h' | 'forecast7d';
type Leader = { id: string; name: string; cm: number; in: number } | null;

export type RankOutput = SourceMeta & {
  kind: 'rank';
  sort: AskSort;
  sortLabel: string;
  where: string;
  regionId: string | null;
  pass: 'ikon' | 'epic' | 'all';
  observedOnly: boolean;
  total: number;
  rows: SnowRow[];
  actualLeader: Leader;
  forecastLeader: Leader;
};

export type ResortOutput = SourceMeta & {
  kind: 'resort';
  found: boolean;
  query?: string;
  resort?: SnowRow & Facts;
  storm?: { kind: string; text: string };
  forecastDays?: { date: string; snowCm: number }[];
  climate?: { hemisphere: 'N' | 'S'; seasons: number; avgCm: (number | null)[] } | null;
};

export type CompareOutput = SourceMeta & { kind: 'compare'; rows: (SnowRow & Facts)[] };

type ClimateBase = SourceMeta & {
  label: string;
  where: string;
  regionId: string | null;
  pass: 'ikon' | 'epic' | 'all';
  seasons: string | null;
  source: string;
  note: string;
  archiveMonths: { N: number[]; S: number[] };
};

export type ClimateMonthRow = {
  id: string;
  name: string;
  where: string | null;
  avgCm: number;
  avgIn: number;
  loCm: number | null;
  hiCm: number | null;
  seasons: number;
};

export type ClimateOutput =
  | (ClimateBase & { kind: 'month'; month: number; monthName: string; total: number; outOfArchive: boolean; rows: ClimateMonthRow[] })
  | (ClimateBase & {
    kind: 'profile';
    resorts: number;
    months: { month: number; monthName: string; avgCm: number; avgIn: number; resorts: number }[];
    best: { month: number; monthName: string; avgCm: number; avgIn: number } | null;
  });

type Scope = { region?: string; country?: string; state?: string; pass?: 'ikon' | 'epic' | 'all' };

export type AskTools = {
  rankResorts: { input: Scope & { sort?: AskSort; observedOnly?: boolean; limit?: number }; output: RankOutput };
  getResort: { input: { resort: string }; output: ResortOutput };
  compareResorts: { input: { ids: string[] }; output: CompareOutput };
  monthClimatology: { input: Scope & { month?: number; limit?: number }; output: ClimateOutput };
};

/** The home board's scope; Ask tools default to it (lib/boardRank.js). */
export type BoardScope = { pass: 'ikon' | 'epic' | 'all'; regionId: string | null; observedOnly: boolean };

export type AskMetadata = { mode?: 'llm' | 'fallback'; model?: string | null };

export type AskUIMessage = UIMessage<AskMetadata, Record<string, never>, AskTools>;
