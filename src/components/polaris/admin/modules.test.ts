import { describe, it, expect } from 'vitest';
import { sanitizeHidden, toggleHidden, isVisible } from './modules';
describe('module visibility', () => {
  it('hides and shows a module', () => { const h = toggleHidden([], 'kpi'); expect(isVisible(h, 'kpi')).toBe(false); expect(isVisible(toggleHidden(h, 'kpi'), 'kpi')).toBe(true); });
  it('never hides Administration or Home (lockout)', () => { expect(toggleHidden([], 'nodes')).toEqual([]); expect(isVisible(['nodes','home'], 'nodes')).toBe(true); expect(sanitizeHidden(['nodes','home','live'])).toEqual(['live']); });
  it('drops unknown modules', () => { expect(sanitizeHidden(['reporting','kpi',3])).toEqual(['kpi']); });
});
