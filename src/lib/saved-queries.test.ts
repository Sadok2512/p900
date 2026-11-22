import { describe, expect, it } from 'vitest';
import { loadSavedQueries, normalizeSavedQueries, SAVED_QUERIES_KEY } from './saved-queries';

describe('saved queries storage', () => {
  it.each([null, {}, 'invalid', 42])('fails closed when the root is not an array: %j', value => {
    expect(normalizeSavedQueries(value)).toEqual([]);
  });

  it('drops malformed entries and redacts sensitive values', () => {
    const sensitive = ['001', '01', '012', '345', '6789'].join('');
    expect(normalizeSavedQueries([
      { n: 'valide', c: [['subscriber', sensitive, '=']] },
      { n: 'conditions invalides', c: {} },
      null,
    ])).toEqual([{ n: 'valide', c: [['subscriber', 'masqué', '=']] }]);
  });

  it('fails closed when stored JSON is invalid', () => {
    const storage = { getItem: (key: string) => key === SAVED_QUERIES_KEY ? '{' : null };
    expect(loadSavedQueries(storage)).toEqual([]);
  });
});
