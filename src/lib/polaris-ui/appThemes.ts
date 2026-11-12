/*
 * App accent colours, offered in Settings → Appearance.
 *
 * One accent tints buttons, tabs, selection and the settings banner across the
 * whole interface, so every entry must stay dark enough to carry white text
 * (checked by test at the same 4.5:1 bar the interface colours follow).
 *
 * Colours here identify a user choice, never an operational state: they are
 * independent of the interface-family colours in interfaceColors.ts and of the
 * success / warning / danger status tones.
 */

export type AppTheme = { id: string; label: string; hex: string };

export const APP_THEMES: readonly AppTheme[] = [
  { id: 'blue', label: 'Bleu', hex: '#0062A1' },
  { id: 'grey', label: 'Gris', hex: '#4B5563' },
  { id: 'green', label: 'Vert', hex: '#0F5B56' },
  { id: 'pink', label: 'Rose', hex: '#BE185D' },
  { id: 'violet', label: 'Violet', hex: '#6D28D9' },
  { id: 'amber', label: 'Ambre', hex: '#B45309' },
  { id: 'cyan', label: 'Turquoise', hex: '#0E7490' },
];

export const DEFAULT_THEME = 'blue';
export const DEFAULT_HEX = '#0062A1';

/* Relative luminance of a 6-digit hex, then its contrast ratio against white. */
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function contrastWithWhite(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return (1 + 0.05) / (L + 0.05);
}

/* A saved choice must never fall back to the default: the picker used to offer
 * a black accent, and that choice now means the grey that replaced it. */
export function normalizeTheme(id: unknown): string {
  if (id === 'black') return 'grey';
  return APP_THEMES.some(t => t.id === id) ? String(id) : DEFAULT_THEME;
}

/* The accent actually applied; unknown or missing values give the default. */
export function accentOf(id: unknown): string {
  return APP_THEMES.find(t => t.id === normalizeTheme(id))?.hex ?? DEFAULT_HEX;
}
