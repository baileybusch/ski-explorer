const KEY = 'ss_watch';

export function watchlist() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function isWatched(id) {
  return watchlist().includes(id);
}

export function toggleWatch(id) {
  const cur = new Set(watchlist());
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  localStorage.setItem(KEY, JSON.stringify([...cur]));
  return cur.has(id);
}
