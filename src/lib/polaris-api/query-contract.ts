import { request } from './client';
import type { Envelope, QueryParams, RecordData, Session, Version } from './types';

/** Contrat publié par oiran-api 2.19.1 (commit c406540). */
export type QueryScalar = string | number | boolean | null;
export type QueryAggregation = 'last' | 'first' | 'all' | 'count';
export type QueryOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
export type ObservedValue = { value: string; count: number };
export type ProtocolParam = RecordData & { param_path: string; type: string; occurrences: number; observed_values: ObservedValue[]; decoded_from_octets: boolean; min?: number; max?: number; truncated?: boolean; distinct_values_seen?: number };
export type ProtocolMessage = { message: string; detail: { occurrences: number; params: ProtocolParam[] } };
export type ProtocolNode = { protocol: string; messages: ProtocolMessage[] };
export type ProtocolInterface = { interface: string; protocols: ProtocolNode[] };
export type NetworkElement = { role: string; address: string; occurrences: number };
export type CatalogColumn = { name: string; type: string; applies_to: string[]; always_present: boolean; description: string };
export type QueryCatalog = RecordData & { columns: CatalogColumn[]; filters: RecordData; always_present_columns: string[]; session_count: number; protocol_tree: ProtocolInterface[]; network_elements: NetworkElement[]; scope: RecordData };
export type CatalogSearchResult = { interface: string; protocol: string; message: string; param_path: string | null; type: string; occurrences: number };
export type CatalogSearchResponse = { results: CatalogSearchResult[]; total: number; query: RecordData };
export type CatalogParamExample = { session_id: string; event_id: string; capture_id: string; seq: number };
export type CatalogParamDetail = ProtocolParam & { interface: string; protocol: string; message: string; example_sessions: CatalogParamExample[] };
export type ProtocolCriterion = { interface?: string; protocol?: string; message: string; param_path?: string; op: QueryOperator; value?: QueryScalar; values?: QueryScalar[] };
export type MatchedCriterion = { criterion_index: number; event_id: string; capture_id: string; seq: number };
export type ProtocolField = { interface: string; protocol: string; message?: string; param_path: string; mode: QueryAggregation };
export type ProtocolProof = { event_id: string; capture_id: string; seq: number };
export type ProtocolFieldValue = ProtocolField & { value: unknown; proof: ProtocolProof[] };
export type SessionWithProtocolFields = Session & { fields?: ProtocolFieldValue[]; matched_criteria?: MatchedCriterion[] };
export type SessionColumnsRequest = { session_ids: string[]; columns: string[]; fields: ProtocolField[] };

const versionString = (value: Version | Envelope<Version> | null | undefined): string => {
  if (!value || typeof value !== 'object') return '';
  const candidate = ('data' in value ? value.data : value) as Version;
  return typeof candidate.backend_api === 'string' ? candidate.backend_api : typeof candidate.platform_core === 'string' ? candidate.platform_core : '';
};
export function supportsQueryApi(value: Version | Envelope<Version> | null | undefined): boolean {
  const match = versionString(value).trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return false;
  const major = Number(match[1]), minor = Number(match[2]);
  return major > 2 || major === 2 && minor >= 19;
}
export const fetchQueryCatalog = (params: QueryParams = {}, signal?: AbortSignal) => request<QueryCatalog>('/sessions/catalog', { params, ...(signal ? { signal } : {}) });
export const searchQueryCatalog = (q: string, interfaces: string[] = [], signal?: AbortSignal) => request<CatalogSearchResponse>('/sessions/catalog/search', { params: { q, ...(interfaces.length ? { interfaces: interfaces.join(',') } : {}), limit: 50 }, ...(signal ? { signal } : {}) });
export const fetchCatalogParam = (params: { interface: string; protocol: string; message: string; param_path: string }, signal?: AbortSignal) => request<CatalogParamDetail>('/sessions/catalog/param', { params, ...(signal ? { signal } : {}) });
export const fetchSessionColumns = (body: SessionColumnsRequest, signal?: AbortSignal) => request<SessionWithProtocolFields[]>('/sessions/columns', { method: 'POST', body, ...(signal ? { signal } : {}), keepIdentities: true });
