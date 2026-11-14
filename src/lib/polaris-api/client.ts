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
const privateField = /imsi|supi|suci|guti|tmsi|imei|imeisv|pei|msisdn|gpsi|password|token|secret|^(k|opc)$/i;
const privateKey = (key: string) => privateField.test(key) && !/pseudonym/i.test(key);
export function redact<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\b\d{14,16}\b/g, 'masqué') as T;
  if (Array.isArray(value)) return value.map(redact) as T;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const sensitiveDescriptor = ['field', 'name', 'key'].some(k => typeof object[k] === 'string' && privateKey(object[k] as string));
    return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, privateKey(k) || sensitiveDescriptor && ['value', 'raw', 'decoded'].includes(k) ? 'masqué' : redact(v)])) as T;
  }
  return value;
}
export type RequestPriority = 'detail' | 'normal' | 'background';
export type RequestOptions = { params?: QueryParams; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal; clearIdentityResponse?: boolean; timeoutMs?: number; priority?: RequestPriority };
const MAX_CONCURRENT_REQUESTS = 4;
let activeRequests = 0;
let queuedSequence = 0;
const queuedRequests: Array<{ priority: number; sequence: number; signal?: AbortSignal; run: () => void; reject: (reason: unknown) => void }> = [];
const priorityValue = (priority: RequestPriority = 'normal') => priority === 'detail' ? 0 : priority === 'normal' ? 1 : 2;
const abortError = () => new DOMException('Navigation annulée', 'AbortError');
function drainRequests() {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && queuedRequests.length) {
    queuedRequests.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    const item = queuedRequests.shift()!;
    if (item.signal?.aborted) { item.reject(abortError()); continue; }
    activeRequests += 1;
    item.run();
  }
}
function scheduled<T>(task: () => Promise<T>, priority: RequestPriority, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item: (typeof queuedRequests)[number] = {
      priority: priorityValue(priority), sequence: queuedSequence++, reject,
      run: () => { signal?.removeEventListener('abort', onAbort); void task().then(resolve, reject).finally(() => { activeRequests -= 1; drainRequests(); }); },
    };
    if (signal) item.signal = signal;
    if (signal?.aborted) { reject(abortError()); return; }
    const onAbort = () => {
      const index = queuedRequests.indexOf(item);
      if (index >= 0) { queuedRequests.splice(index, 1); reject(abortError()); }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    queuedRequests.push(item);
    drainRequests();
  });
}
export async function requestFrom<T>(base: string, path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const url = apiPath(path, options.params, base);
  const timeoutMs = options.timeoutMs ?? 60_000;
  const method = options.method ?? 'GET';
  const { response, payload } = await scheduled(async () => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const signal = options.signal ? AbortSignal.any([timeout.signal, options.signal]) : timeout.signal;
    try {
      const response = await fetch(url, { method, credentials: 'same-origin', signal, headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      return { response, payload };
    } catch (error) {
      if (options.signal?.aborted) throw abortError();
      if (timeout.signal.aborted) throw new PolarisApiError('TIMEOUT', `Délai dépassé (${Math.round(timeoutMs / 1000)} s) pour ${method} ${path}`, 0);
      throw new PolarisApiError('NETWORK_ERROR', `Erreur réseau pour ${method} ${path}`, 0);
    } finally { clearTimeout(timer); }
  }, options.priority ?? 'normal', options.signal);
  if (response.headers?.get?.('x-polaris-unreachable') === '1') throw new PolarisApiError('BACKEND_UNREACHABLE', `Relais indisponible pour ${method} ${path} (HTTP 502)`, 502);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const detail = error['error'] && typeof error['error'] === 'object' ? error['error'] as Record<string, unknown> : error;
    const serverMessage = typeof detail['message'] === 'string' ? ` · ${redact(detail['message'])}` : '';
    throw new PolarisApiError(typeof detail['code'] === 'string' ? detail['code'] : 'HTTP_ERROR', response.status === 403 ? 'Action refusée par le serveur (HTTP 403)' : `${method} ${path} · HTTP ${response.status}${serverMessage}`, response.status);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new PolarisApiError('INVALID_RESPONSE', `Réponse invalide pour ${method} ${path} (HTTP ${response.status})`, response.status);
  const envelope = payload as { data: T; meta?: unknown };
  return { data: options.clearIdentityResponse ? envelope.data : redact(envelope.data), meta: envelope.meta && typeof envelope.meta === 'object' ? redact(envelope.meta) as Envelope<T>['meta'] : {} };
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  return requestFrom<T>(relativeBase(), path, options);
}
