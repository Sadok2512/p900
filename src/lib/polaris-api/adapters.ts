import type { RecordData, Session, Event, Correlation, Probe, Metrics, Safety } from './types';
export const available = (value: unknown): string | number => value == null || value === '' ? '—' : typeof value === 'string' || typeof value === 'number' ? value : '—';
export const records = <T extends RecordData>(value: unknown, key?: string): T[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : key && value && typeof value === 'object' ? records((value as RecordData)[key]) : [];
const str = (v: unknown) => String(available(v));
export function toLegacySession(s: Session, index = 0) {
  return { ...s, id: s.id ?? s.event_id ?? `row-${index}`, cap: available(s.capture_id), seq: available(s.seq ?? s.packet_number), ue: str(s.pseudonym ?? s.ue_id), rat: str(s.technology), proc: str(s.procedure), res: str(s.status), cause: str(s.cause), cell: str(s.cell), ex: available(s['exact_links']), comp: available(s['completeness']), dur: s.duration_ms == null ? '—' : `${s.duration_ms} ms`, d: { nodes: [], procs: [], msgs: [], links: [], evidence: [], summary: 'Non disponible' } };
}
export function toLegacyCallflow(value: unknown, procedures: unknown, correlations: unknown) {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
  const events = records<Event>(Array.isArray(value) ? value : body['events'] ?? body['messages']);
  const nodes = Array.isArray(body['nodes']) ? body['nodes'].map(n => typeof n === 'string' ? n : str((n as RecordData)['name'])) : [...new Set(events.flatMap(e => [str(e.source), str(e.destination)]))];
  const links = records<Correlation>(correlations, 'correlations').filter(c => c.status === 'EXACT' || c.status === 'OUVERT').map(c => [Math.max(0, events.findIndex(e => (e.id ?? e.event_id) === c.source_event_id)), (() => { const n = events.findIndex(e => (e.id ?? e.event_id) === c.target_event_id); return n < 0 ? null : n; })(), str(c['source_interface']), str(c['target_interface']), str(c['key']), c.status, c.matched_rules ?? [], c]);
  return { nodes, msgs: events.map(e => [str(e.interface), str(e.message ?? e['name']), `${str(e.source)} → ${str(e.destination)}`, null, e['cause'] ? 'cause' : null, e['cause'] ? str(e['cause']) : null]), evidence: events, procs: records(procedures, 'procedures').map(p => [str(p['name'] ?? p['procedure']), events.findIndex(e => e.event_id === p['start_event_id']), events.findIndex(e => e.event_id === p['end_event_id'])]), links, summary: str(body['summary']) };
}
export function toLegacyProbe(p: Probe, index = 0) {
  return { n: str(p.name ?? p.id ?? `probe-${index}`), id: p.id, role: str(p.role), st: p.status === 'ok' || p.status === 'healthy' ? 'ok' : 'unknown', ver: str(p.version), exp: '', cpu: p.cpu_percent ?? null, mem: p.memory_used_gb == null || p.memory_total_gb == null ? null : [p.memory_used_gb, p.memory_total_gb], disk: p.disk_percent ?? null, seen: str(p.last_seen), info: str(p['description']) };
}
export function healthKpi(id: string, m?: Metrics | null, s?: Safety | null): number | null {
  if (id === 'kpi.probe.dumpcap') return m?.dumpcap_active == null || m.dumpcap_expected == null || m.dumpcap_expected <= 0 ? null : m.dumpcap_active / m.dumpcap_expected * 100;
  if (id === 'kpi.probe.segments') return typeof m?.['segments_dropped'] === 'number' ? m['segments_dropped'] : null;
  if (id === 'kpi.probe.lag') return m?.import_lag_seconds ?? null;
  if (id === 'kpi.probe.disk') return s?.free_percent ?? (s?.free_bytes == null || s.total_bytes == null || s.total_bytes <= 0 ? null : s.free_bytes / s.total_bytes * 100);
  return null;
}
export type Draft = { tpl?: string; group?: string; scope?: string; join?: string; conds: string[][] };
export function querySupport(d: Draft, demo: boolean): string | null {
  if (demo) return null;
  if (d.join === 'OU' || d.conds.some(c => c[2] === '≠')) return 'Non disponible : backend à venir (OU / ≠)';
  if (d.group && d.group !== 'Aucun') return 'Non disponible : backend à venir (Regrouper par)';
  if (d.tpl && d.tpl !== 'Parcourir') return 'Non disponible : backend à venir (Gabarit)';
  if (d.conds.some(c => !['Message', 'Cause', 'Interface', 'UE'].includes(c[0] ?? ''))) return 'Non disponible : backend à venir (condition)';
  const fields = d.conds.map(c => c[0]);
  if (new Set(fields).size !== fields.length) return 'Non disponible : backend à venir (conditions multiples)';
  return null;
}
export function filterBody(d: Draft) {
  const map: Record<string, string> = { Message: 'message', Cause: 'cause', Interface: 'interface', UE: 'pseudonym' };
  const body: Record<string, string> = {};
  for (const c of d.conds) { const field = map[c[0] ?? '']; if (field && c[1]) body[field] = c[1]; }
  if (d.scope) body['dataset_id'] = d.scope;
  return body;
}
export const canCapture = (role: unknown, open: unknown) => role === 'operator' && open === true;
