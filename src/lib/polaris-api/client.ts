import type { ApiFailure, Envelope, QueryParams } from './types';

export class PolarisApiError extends Error implements ApiFailure {
  public retryAfterSeconds?: number;
  constructor(public code: string, message: string, public status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'PolarisApiError';
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
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
/**
 * 2.4.4 — règle Sadok (2026-11-14) : IMSI/SUPI en clair dans l'UI
 * authentifiée. La liste des sessions garde la redaction générale, mais
 * le sous-objet `identities` (servi par oiran-api pour l'opérateur, comme
 * /sessions/:id/identities) passe tel quel.
 */
export function redactKeepingIdentities<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactKeepingIdentities) as T;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (!('identities' in object)) return redact(value);
    const { identities, ...rest } = object;
    return { ...(redact(rest) as Record<string, unknown>), identities } as T;
  }
  return redact(value);
}
export type RequestPriority = 'detail' | 'normal' | 'background';
export type RequestOptions = { params?: QueryParams; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal; clearIdentityResponse?: boolean; keepIdentities?: boolean; timeoutMs?: number; priority?: RequestPriority; retryHeavyWork?: boolean; onHeavyWorkRetry?: (seconds: number | null) => void };
const MAX_CONCURRENT_REQUESTS = 4;
// Opening one Analyzer session used to start five expensive endpoints at once.
// Keep capacity for health/navigation and protect the single-CPU analyzer.
const MAX_CONCURRENT_DETAIL_REQUESTS = 2;
let activeRequests = 0;
let activeDetailRequests = 0;
let queuedSequence = 0;
const queuedRequests: Array<{ priority: number; sequence: number; detail: boolean; signal?: AbortSignal | undefined; run: () => void; reject: (reason: unknown) => void }> = [];
const priorityValue = (priority: RequestPriority = 'normal') => priority === 'detail' ? 0 : priority === 'normal' ? 1 : 2;
const abortError = () => new DOMException('Navigation annulée', 'AbortError');
function drainRequests() {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && queuedRequests.length) {
    queuedRequests.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    const index = queuedRequests.findIndex(item => !item.detail || activeDetailRequests < MAX_CONCURRENT_DETAIL_REQUESTS);
    if (index < 0) break;
    const [item] = queuedRequests.splice(index, 1);
    if (!item) break;
    if (item.signal?.aborted) { item.reject(abortError()); continue; }
    activeRequests += 1;
    if (item.detail) activeDetailRequests += 1;
    item.run();
  }
}
function scheduled<T>(task: () => Promise<T>, priority: RequestPriority, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item: (typeof queuedRequests)[number] = {
      priority: priorityValue(priority), sequence: queuedSequence++, detail: priority === 'detail', reject,
      run: () => { signal?.removeEventListener('abort', onAbort); void task().then(resolve, reject).finally(() => { activeRequests -= 1; if (item.detail) activeDetailRequests -= 1; drainRequests(); }); },
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
function retryAfterSeconds(response: Response): number {
  const raw = response.headers?.get?.('retry-after')?.trim();
  if (!raw) return 60;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.min(3_600, Math.ceil(numeric));
  const epoch = Date.parse(raw);
  if (Number.isFinite(epoch)) return Math.min(3_600, Math.max(0, Math.ceil((epoch - Date.now()) / 1_000)));
  return 60;
}
function waitForRetry(seconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (seconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, seconds * 1_000);
    function done() { signal?.removeEventListener('abort', aborted); resolve(); }
    function aborted() { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(abortError()); }
    signal?.addEventListener('abort', aborted, { once: true });
  });
}
export async function requestFrom<T>(base: string, path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const url = apiPath(path, options.params, base);
  const timeoutMs = options.timeoutMs ?? 60_000;
  const method = options.method ?? 'GET';
  let response: Response;
  let payload: unknown;
  let announcedRetry = false;
  try {
    for (;;) {
      ({ response, payload } = await scheduled(async () => {
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), timeoutMs);
        const signal = options.signal ? AbortSignal.any([timeout.signal, options.signal]) : timeout.signal;
        try {
          const result = await fetch(url, { method, credentials: 'same-origin', signal, headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
          let body: unknown;
          try { body = await result.json(); } catch { body = null; }
          return { response: result, payload: body };
        } catch (error) {
          if (options.signal?.aborted) throw abortError();
          if (timeout.signal.aborted) throw new PolarisApiError('TIMEOUT', `Délai dépassé (${Math.round(timeoutMs / 1000)} s) pour ${method} ${path}`, 0);
          throw new PolarisApiError('NETWORK_ERROR', `Erreur réseau pour ${method} ${path}`, 0);
        } finally { clearTimeout(timer); }
      }, options.priority ?? 'normal', options.signal));
      const errorBody = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      const detail = errorBody['error'] && typeof errorBody['error'] === 'object' ? errorBody['error'] as Record<string, unknown> : errorBody;
      const heavyWork = response.status === 503 && detail['code'] === 'HEAVY_WORK_IN_PROGRESS';
      if (!heavyWork || !options.retryHeavyWork) break;
      const seconds = retryAfterSeconds(response);
      announcedRetry = true;
      options.onHeavyWorkRetry?.(seconds);
      await waitForRetry(seconds, options.signal);
    }
  } finally {
    if (announcedRetry) options.onHeavyWorkRetry?.(null);
  }
  if (response.headers?.get?.('x-polaris-unreachable') === '1') throw new PolarisApiError('BACKEND_UNREACHABLE', `Relais indisponible pour ${method} ${path} (HTTP 502)`, 502);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const detail = error['error'] && typeof error['error'] === 'object' ? error['error'] as Record<string, unknown> : error;
    const serverMessage = typeof detail['message'] === 'string' ? ` · ${redact(detail['message'])}` : '';
    const code = typeof detail['code'] === 'string' ? detail['code'] : 'HTTP_ERROR';
    const retrySeconds = response.status === 503 && code === 'HEAVY_WORK_IN_PROGRESS' ? retryAfterSeconds(response) : undefined;
    const message = retrySeconds === undefined ? (response.status === 403 ? 'Action refusée par le serveur (HTTP 403)' : `${method} ${path} · HTTP ${response.status}${serverMessage}`) : `Publication en cours, nouvel essai dans ${retrySeconds} s`;
    throw new PolarisApiError(code, message, response.status, retrySeconds);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new PolarisApiError('INVALID_RESPONSE', `Réponse invalide pour ${method} ${path} (HTTP ${response.status})`, response.status);
  const envelope = payload as { data: T; meta?: unknown };
  return { data: options.clearIdentityResponse ? envelope.data : options.keepIdentities ? redactKeepingIdentities(envelope.data) : redact(envelope.data), meta: envelope.meta && typeof envelope.meta === 'object' ? redact(envelope.meta) as Envelope<T>['meta'] : {} };
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  return requestFrom<T>(relativeBase(), path, options);
}
