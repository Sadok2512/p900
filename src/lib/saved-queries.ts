import { redact } from './polaris-api/client';

export const SAVED_QUERIES_KEY = 'polaris-saved-queries';

export type SavedQuery = Record<string, unknown> & {
  n: string;
  c: unknown[][];
};

function isSavedQuery(value: unknown): value is SavedQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const query = value as Record<string, unknown>;
  return typeof query['n'] === 'string'
    && query['n'].trim().length > 0
    && Array.isArray(query['c'])
    && query['c'].every(condition => Array.isArray(condition) && condition.length >= 2);
}

export function normalizeSavedQueries(value: unknown): SavedQuery[] {
  if (!Array.isArray(value)) return [];
  return redact(value.filter(isSavedQuery));
}

export function loadSavedQueries(storage: Pick<Storage, 'getItem'> = localStorage): SavedQuery[] {
  try {
    return normalizeSavedQueries(JSON.parse(storage.getItem(SAVED_QUERIES_KEY) ?? '[]'));
  } catch {
    return [];
  }
}
