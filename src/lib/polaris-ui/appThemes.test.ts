import { describe, expect, it } from 'vitest';
import { APP_THEMES, DEFAULT_THEME, accentOf, contrastWithWhite, normalizeTheme } from './appThemes';

/* The accent picker in Settings → Appearance: what it offers and what it can
 * actually paint the interface with. */

describe('app accent choices', () => {
  it('offers pink and grey among the accents, and no black', () => {
    expect(APP_THEMES.map(t => t.id)).toEqual(['blue', 'grey', 'green', 'pink', 'violet', 'amber', 'cyan']);
    expect(APP_THEMES.map(t => t.label)).toContain('Rose');
    expect(APP_THEMES.map(t => t.label)).toContain('Gris');
    expect(APP_THEMES.some(t => t.id === 'black' || t.hex === '#171717')).toBe(false);
  });

  it('keeps every accent dark enough to carry white text', () => {
    for (const t of APP_THEMES) {
      expect(t.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastWithWhite(t.hex)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads a legacy black choice as the grey that replaced it', () => {
    expect(normalizeTheme('black')).toBe('grey');
    expect(accentOf('black')).toBe('#4B5563');
  });

  it('falls back to the default accent for an unknown or missing choice', () => {
    expect(normalizeTheme('nope')).toBe(DEFAULT_THEME);
    expect(normalizeTheme(null)).toBe(DEFAULT_THEME);
    expect(accentOf('nope')).toBe('#0062A1');
    expect(accentOf(undefined)).toBe('#0062A1');
  });

  it('gives each accent its own colour', () => {
    const hexes = APP_THEMES.map(t => t.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(accentOf('pink')).toBe('#BE185D');
    expect(accentOf('grey')).toBe('#4B5563');
  });
});
