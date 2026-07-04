const HISTORY_KEY = "canvasClone:searchHistory";
const MAX = 8;

export function loadSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSearchQuery(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  const history = loadSearchHistory().filter((h) => h.toLowerCase() !== q.toLowerCase());
  history.unshift(q);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX)));
  } catch {}
}
