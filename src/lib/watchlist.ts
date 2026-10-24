const KEY = 'ss_watch';

export function watchlist(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function isWatched(id: string) {
  return watchlist().includes(id);
}

export function toggleWatch(id: string) {
  const cur = new Set(watchlist());
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  localStorage.setItem(KEY, JSON.stringify([...cur]));
  return cur.has(id);
}
