import { SESS, NODES } from './catalogue';
import { redact } from '../client';
import type { Envelope } from '../types';
export function demoResponse<T>(path: string): Envelope<T> | undefined {
  let data: unknown;
  if (path === '/sessions' || path === '/sessions/filter' || /^\/datasets\/[^/]+\/sessions$/.test(path) || /^\/ues\/[^/]+\/sessions$/.test(path)) data = SESS;
  else if (path === '/probes') data = NODES;
  else if (path === '/health') data = { status: 'demo', capture_state: 'demo' };
  else if (path === '/metrics') data = { capture_state: 'demo', dumpcap_active: 12, dumpcap_expected: 12, pending_segments: 12, segments_ingested: 436, ingestion_failures: 0, open_segments: 2, zero_event_segments: 0, import_lag_seconds: 4 };
  else if (path === '/storage/safety') data = { free_percent: 24 };
  else if (path === '/datasets') data = [{ id: '482', name: 'Run 5G #482' }, { id: '219', name: 'Run 4G #219' }];
  else if (path === '/sessions/available_causes') data = ['5GSM #27', '5GMM #7', 'S6a 5001', 'S1AP radio #20'];
  else if (/^\/sessions\/[^/]+$/.test(path)) data = SESS.find(s => String(s['id']) === path.split('/')[2]) ?? null;
  else if (path === '/interfaces') data = ['N2','N3','N4','SBI','S1-MME','S6a','S11'].map(name => ({ name }));
  else if (path === '/captures' || path === '/modules') data = [];
  else return undefined;
  return { data: redact(data) as T, meta: { demo: true, ...(Array.isArray(data) ? { total: data.length } : {}) } };
}
// Preview fallback is opt-in, never implicit: disconnected + demo off must stay empty.
export const shouldUseDemo = (demo: boolean) => demo;
