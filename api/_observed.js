/**
 * Live observed snapshot. Routed through /api/headless?surface=observed.
 * Serves committed public/data/observed.json, and when that file is older
 * than ~45 minutes, refreshes US rows from NRCS AWDB (SNOTEL) in-process.
 * CDN + in-memory cache keep us inside Hobby time and Open-Meteo is not used here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildObservedSnapshot } from '../lib/snotel.js';

const rootCandidates = [process.cwd(), join(dirname(fileURLToPath(import.meta.url)), '..')];
const FRESH_MS = 45 * 60 * 1000;
let mem = null;

function readJSON(rel, fallback) {
  for (const root of rootCandidates) {
    try {
      return JSON.parse(readFileSync(join(root, rel), 'utf8'));
    } catch { /* next */ }
  }
  return fallback;
}

function fileObserved() {
  return readJSON('public/data/observed.json', { fetched: null, resorts: {}, source: 'missing' });
}

function ageMs(iso) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}

async function liveRefresh() {
  const resorts = readJSON('public/data/resorts-index.json', []);
  const snow = readJSON('public/data/snow.json', { dates: [], today: 0, resorts: {} });
  const map = readJSON('public/data/snotel-map.json', { resorts: {} }).resorts || {};
  return buildObservedSnapshot({ resorts, snow, map });
}

export async function getObserved({ force = false } = {}) {
  if (!force && mem && Date.now() - mem.t < FRESH_MS) return mem.data;
  const file = fileObserved();
  if (!force && ageMs(file.fetched) < FRESH_MS) {
    mem = { t: Date.now(), data: file };
    return file;
  }
  try {
    const live = await liveRefresh();
    mem = { t: Date.now(), data: live };
    return live;
  } catch (err) {
    console.warn('[observed] live SNOTEL refresh failed, serving snapshot', err?.message || err);
    mem = { t: Date.now(), data: file };
    return file;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const force = String(req.query?.refresh || '') === '1';
  const data = await getObserved({ force });
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json(data);
}
