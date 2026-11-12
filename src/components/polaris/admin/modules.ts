// Module visibility: hides entries from the navigation only; it never grants or removes access.
export type NavModule = { key: string; label: string; locked?: boolean };
export const NAV_MODULES: NavModule[] = [
  { key: 'home', label: 'Accueil', locked: true },
  { key: 'sessions', label: 'Analyzer' },
  { key: 'kpi', label: 'KPI' },
  { key: 'live', label: 'Live' },
  { key: 'trafic', label: 'Traffic' },
  { key: 'nodes', label: 'Administration', locked: true },
];
export const VIS_KEY = 'polaris-module-visibility';
const LOCKED = new Set(NAV_MODULES.filter(m => m.locked).map(m => m.key));
export function sanitizeHidden(hidden: unknown): string[] {
  if (!Array.isArray(hidden)) return [];
  const known = new Set(NAV_MODULES.map(m => m.key));
  return [...new Set(hidden.filter((k): k is string => typeof k === 'string' && known.has(k) && !LOCKED.has(k)))];
}
export function toggleHidden(hidden: string[], key: string): string[] {
  if (LOCKED.has(key)) return hidden;
  return hidden.includes(key) ? hidden.filter(k => k !== key) : sanitizeHidden([...hidden, key]);
}
export const isVisible = (hidden: string[], key: string) => LOCKED.has(key) || !hidden.includes(key);
export function loadHidden(): string[] { try { return sanitizeHidden(JSON.parse(localStorage.getItem(VIS_KEY) || '[]')); } catch { return []; } }
export function saveHidden(h: string[]) { try { localStorage.setItem(VIS_KEY, JSON.stringify(sanitizeHidden(h))); } catch { /* storage unavailable */ } }
