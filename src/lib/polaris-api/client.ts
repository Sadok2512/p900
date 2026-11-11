import type { ApiFailure, Envelope, QueryParams } from './types';

export class PolarisApiError extends Error implements ApiFailure {
  constructor(public code: string, message: string, public status: number) { super(message); this.name = 'PolarisApiError'; }
}
export function relativeBase(base = import.meta.env['VITE_POLARIS_API_BASE'] ?? '/api/v1'): string {
  if (!/^\/(?!\/)/.test(base) || /[\\?#]/.test(base) || base.split('/').includes('..')) throw new PolarisApiError('INVALID_BASE', 'Chemin POLARIS invalide', 0);
  return base.replace(/\/$/, '');
}
export function apiPath(path: string, params: QueryParams = {}, base = relativeBase()): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\#]/.test(path) || path.split('/').includes('..')) throw new PolarisApiError('INVALID_PATH', 'Chemin POLARIS invalide', 0);
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return relativeBase(base) + path + (query.size ? '?' + query.toString() : '');
}
// Remove identity-bearing fields before anything can reach a component or Query cache.
const privateField = /imsi|supi|suci|guti|tmsi|imei|msisdn|password|token|secret|^(k|opc)$/i;
export function redact<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\b\d{14,16}\b/g, 'masqué') as T;
  if (Array.isArray(value)) return value.map(redact) as T;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const sensitiveDescriptor = ['field', 'name', 'key'].some(k => typeof object[k] === 'string' && privateField.test(object[k] as string));
    return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, privateField.test(k) || sensitiveDescriptor && ['value', 'raw', 'decoded'].includes(k) ? 'masqué' : redact(v)])) as T;
  }
  return value;
}
export async function requestFrom<T>(base: string, path: string, options: { params?: QueryParams; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {}): Promise<Envelope<T>> {
  const url = apiPath(path, options.params, base);
  let response: Response;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 8000);
  const signal = options.signal ? AbortSignal.any([timeout.signal, options.signal]) : timeout.signal;
  try {
    response = await fetch(url, { method: options.method ?? 'GET', credentials: 'same-origin', signal, headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  } catch { throw new PolarisApiError('NETWORK_ERROR', 'POLARIS non connecté', 0); }
  finally { clearTimeout(timer); }
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const detail = error['error'] && typeof error['error'] === 'object' ? error['error'] as Record<string, unknown> : error;
    throw new PolarisApiError(typeof detail['code'] === 'string' ? detail['code'] : 'HTTP_ERROR', response.status === 403 ? 'Accès refusé (rôle)' : payload == null || response.status === 404 || response.status === 406 || response.status === 502 || response.status === 503 ? 'POLARIS non connecté' : typeof detail['message'] === 'string' ? redact(detail['message']) : 'Source POLARIS indisponible', response.status);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new PolarisApiError('INVALID_RESPONSE', 'POLARIS non connecté', response.status);
  const envelope = payload as { data: T; meta?: unknown };
  return { data: redact(envelope.data), meta: envelope.meta && typeof envelope.meta === 'object' ? redact(envelope.meta) as Envelope<T>['meta'] : {} };
}
export async function request<T>(path: string, options: { params?: QueryParams; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {}): Promise<Envelope<T>> {
  return requestFrom<T>(relativeBase(), path, options);
}
