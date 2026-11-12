import { SESS, NODES } from './catalogue';
import { redact } from '../client';
import { demoSubscriber } from './subscribers';
import type { Envelope } from '../types';

// Démo : fiche d'une sonde et ses interfaces, pour que le formulaire d'édition
// soit explorable hors connexion. Valeurs de test uniquement, jamais des mesures.
const segment = (path: string, index: number) => decodeURIComponent(path.split('/')[index] ?? '');

const demoProbe = (id: string) => {
  const node = NODES.find(n => n['n'] === id);
  const index = Math.max(0, NODES.findIndex(n => n['n'] === id));
  return {
    id, probe_id: id, name: id, host: `${id}.lab.local`, mgmt_ip: `10.77.0.${index + 1}`,
    site: 'Lab A · démo', probe_type: 'virtual', role: node?.['role'] ?? 'Capture', status: 'healthy', version: node?.['ver'] ?? '—',
  };
};
const demoProbeInterfaces = (id: string) => [
  { interface: 'N2', role: 'N2', bpf_filter: 'sctp port 38412', protocol: 'NGAP', device: 'br-n2' },
  { interface: 'SBI', role: 'SBI', bpf_filter: 'tcp port 7777', protocol: 'HTTP/2', device: 'br-sbi' },
  { interface: 'S6a', role: 'S6a', bpf_filter: 'tcp port 36412', protocol: 'DIAMETER', device: 'br-s6a' },
];

export function demoResponse<T>(path: string, params: Record<string, unknown> = {}): Envelope<T> | undefined {
  const sub = demoSubscriber(path, params);
  if (sub !== undefined) return { data: sub as T, meta: { demo: true } }; // invented pseudonyms only, nothing to redact
  let data: unknown;
  if (path === '/sessions' || path === '/sessions/filter' || /^\/datasets\/[^/]+\/sessions$/.test(path) || /^\/ues\/[^/]+\/sessions$/.test(path)) data = SESS;
  else if (path === '/probes') data = NODES;
  else if (/^\/probes\/[^/]+$/.test(path)) data = demoProbe(segment(path, 2));
  else if (/^\/probes\/[^/]+\/interfaces$/.test(path)) data = demoProbeInterfaces(segment(path, 2));
  else if (path === '/health') data = { status: 'demo', capture_state: 'demo' };
  else if (path === '/metrics') data = { capture_state: 'demo', dumpcap_active: 12, dumpcap_expected: 12, pending_segments: 12, segments_ingested: 436, ingestion_failures: 0, open_segments: 2, zero_event_segments: 0, import_lag_seconds: 4 };
  else if (path === '/storage/safety') data = { free_percent: 24 };
  else if (path === '/datasets') data = [{ id: '482', name: 'Run 5G #482' }, { id: '219', name: 'Run 4G #219' }];
  else if (path === '/sessions/available_causes') data = ['5GSM #27', '5GMM #7', 'S6a 5001', 'S1AP radio #20'];
  else if (/^\/sessions\/[^/]+$/.test(path)) data = SESS.find(s => String(s['id']) === path.split('/')[2]) ?? null;
  else if (path === '/interfaces') data = ['N2','N3','N4','SBI','S1-MME','S6a','S11'].map(name => ({ name }));
  // Démo : disponibilité seule, sans débit inventé (les colonnes de débit restent à « — »).
  else if (path === '/interfaces/runtime') data = ['N2','N3','N4','SBI','S1-MME','S6a','S11'].map(name => ({ interface: name, active: true }));
  else if (path === '/captures' || path === '/modules') data = [];
  else return undefined;
  return { data: redact(data) as T, meta: { demo: true, ...(Array.isArray(data) ? { total: data.length } : {}) } };
}
// Preview fallback is opt-in, never implicit: disconnected + demo off must stay empty.
export const shouldUseDemo = (demo: boolean) => demo;
