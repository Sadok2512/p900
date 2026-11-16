import { request } from './client';
import type { Envelope, RecordData, Version } from './types';

/**
 * Contrat d'anticipation oiran-api 2.19.0.
 *
 * Le commentaire de design #10 6915024164 nomme les routes, mais ne publie
 * pas encore leurs schémas JSON. Les propriétés non garanties restent donc
 * optionnelles et extensibles jusqu'à la publication du contrat DEVMAT.
 * Aucune valeur de catalogue n'est embarquée dans le client.
 */
export type QueryScalar = string | number | boolean | null;
export type QueryAggregation = 'last' | 'first' | 'all' | 'count';

export type QueryCatalogValue = RecordData & {
  value: QueryScalar;
  observed_count?: number;
};

export type QueryCatalogField = RecordData & {
  path: string;
  name?: string;
  type?: string;
  message_name?: string;
  interface?: string;
  observed_count?: number;
  verified_bytes?: boolean;
  values?: QueryCatalogValue[];
  children?: QueryCatalogField[];
};

export type QueryCatalogMessage = RecordData & {
  name: string;
  interface?: string;
  protocol?: string;
  observed_count?: number;
  fields?: QueryCatalogField[];
  parameters?: QueryCatalogField[];
};

export type QueryCatalog = RecordData & {
  messages: QueryCatalogMessage[];
  fields?: QueryCatalogField[];
  aggregations?: QueryAggregation[];
};

export type SessionColumnSpec = RecordData & {
  id: string;
  parameter_path: string;
  aggregation: QueryAggregation;
  message_name?: string;
  interface?: string;
};

export type SessionColumnsRequest = RecordData & {
  session_ids: string[];
  columns: SessionColumnSpec[];
  cursor?: string;
  limit?: number;
};

export type SessionColumnValue = RecordData & {
  value?: unknown;
  values?: unknown[];
  count?: number;
  event_id?: string;
  capture_id?: string;
  seq?: number;
};

export type SessionColumnsRow = RecordData & {
  session_id: string;
  values: Record<string, SessionColumnValue>;
};

export type SessionColumnsResult = RecordData & {
  rows: SessionColumnsRow[];
  next_cursor?: string | null;
};

const versionString = (value: Version | Envelope<Version> | null | undefined): string => {
  if (!value || typeof value !== 'object') return '';
  const candidate = ('data' in value ? value.data : value) as Version;
  return typeof candidate.backend_api === 'string' ? candidate.backend_api
    : typeof candidate.platform_core === 'string' ? candidate.platform_core
      : '';
};

export function supportsQueryApi(value: Version | Envelope<Version> | null | undefined): boolean {
  const match = versionString(value).trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 2 || major === 2 && minor >= 19;
}

export const fetchQueryCatalog = (signal?: AbortSignal) =>
  request<QueryCatalog>('/query/catalog', { ...(signal ? { signal } : {}) });

export const fetchSessionColumns = (body: SessionColumnsRequest, signal?: AbortSignal) =>
  request<SessionColumnsResult>('/sessions/columns', { method: 'POST', body, ...(signal ? { signal } : {}), keepIdentities: true });
