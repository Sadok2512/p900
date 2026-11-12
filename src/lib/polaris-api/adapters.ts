import type { RecordData, Session, Event, Correlation, Probe, Metrics, Safety } from './types';
export const available = (value: unknown): string | number => value == null || value === '' ? '—' : typeof value === 'string' || typeof value === 'number' ? value : '—';
export const records = <T extends RecordData>(value: unknown, key?: string): T[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : key && value && typeof value === 'object' ? records((value as RecordData)[key]) : [];
const str = (v: unknown) => String(available(v));
export function toLegacySession(s: Session, firstEvent?: Event) {
  return { ...s, id: s.session_id, session_id: s.session_id, missingSessionId: !s.session_id, cap: available(s.anchor_capture_id ?? firstEvent?.capture_id), seq: available(s.first_packet_number ?? firstEvent?.packet_references?.[0]?.packet_number), ue: /^unknown$/i.test(String(s.ue_pseudonym ?? '')) ? '—' : str(s.ue_pseudonym), rat: str(s.technology), proc: str(s.procedure), res: str(s.state), cause: str(s['cause']), cell: str(s['cell']), ex: available(s.correlation_status), comp: available(s.decode_completeness), dur: '—', interfaces: Array.isArray(s.interfaces) ? s.interfaces : [], d: { nodes: [], procs: [], msgs: [], links: [], evidence: [], summary: 'Non disponible' } };
}
export function toLegacyCallflow(value: unknown, procedures: unknown, correlations: unknown) {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
  const events = records<Event>(Array.isArray(value) ? value : body['events'] ?? body['messages']);
  const nodes = Array.isArray(body['nodes']) ? body['nodes'].map(n => typeof n === 'string' ? n : str((n as RecordData)['name'])) : [...new Set(events.flatMap(e => [str(e.source_participant), str(e.destination_participant)]).filter(n => n !== '—'))];
  const edgeBody = correlations && typeof correlations === 'object' && !Array.isArray(correlations) ? correlations as RecordData : {};
  const edges = Array.isArray(correlations) ? records<Correlation>(correlations) : records<Correlation>(edgeBody['edges'] ?? edgeBody['correlations']);
  const links = edges.map(c => {
    const confidence = correlationConfidence(c);
    const identifiers = Array.isArray(c.matching_identifiers) ? c.matching_identifiers.map(str).join(', ') : '—';
    const rule = str(c.rule_id);
    const matched = Array.isArray(c.matched_rules) ? c.matched_rules.map(str) : [];
    return [(() => { const n = events.findIndex(e => e.event_id === c.source_event_id); return n < 0 ? null : n; })(), (() => { const n = events.findIndex(e => e.event_id === c.target_event_id); return n < 0 ? null : n; })(), str(c.source_interface), str(c.target_interface), `${rule} · ${identifiers} · matched_rules: ${matched.length ? matched.join(', ') : '—'}`, confidence, matched, c];
  }).filter(link => link[5] === 'EXACT' || link[5] === 'OUVERT');
  const evidence = events.map(e => ({ ...e, packet_number: e.packet_number ?? e.packet_references?.[0]?.packet_number }));
  const suppliedProcedures = records(procedures, 'procedures').map(p => {
    const start = events.findIndex(e => e.event_id === p['start_event_id']);
    return [str(p['name'] ?? p['procedure']), start, events.findIndex(e => e.event_id === p['end_event_id']), start < 0 ? undefined : events[start]?.event_id];
  });
  const procs = suppliedProcedures.length ? suppliedProcedures : procedureGroups(events);
  return { nodes, msgs: events.map(e => [str(e.interface), str(e.message_name), `${str(e.source_participant)} → ${str(e.destination_participant)}`, null, e.semantic_status ? 'semantic_status' : null, e.semantic_status ? str(e.semantic_status) : null]), evidence, procs, links, summary: str(body['summary']) };
}

function correlationConfidence(c: Correlation): 'EXACT' | 'OUVERT' | null {
  const confidence = String(c.confidence ?? '').toUpperCase();
  const evidence = String(c.evidence_type ?? '').toUpperCase();
  if (confidence === 'EXACT') return 'EXACT';
  if (confidence === 'OPEN' || confidence === 'OUVERT') return 'OUVERT';
  if (evidence.startsWith('EXACT')) return 'EXACT';
  if (evidence.startsWith('OPEN')) return 'OUVERT';
  return null;
}

function procedureGroups(events: Event[]) {
  const groups: Array<[string, number, number, string | number | undefined]> = [];
  events.forEach((event, index) => {
    const name = str(event.procedure_group);
    const last = groups.at(-1);
    if (last && last[0] === name) last[2] = index;
    else groups.push([name, index, index, event.event_id]);
  });
  return groups.filter(([name]) => name !== '—');
}

export function versionComponents(version: import('./types').Version | null | undefined, uiVersion: string) {
  if (version?.product || version?.version || version?.api_commit || version?.ui_commit) return [
    ['Produit', str(version?.product)],
    ['POLARIS', str(version?.version)],
    ['API commit', str(version?.api_commit)],
    ['UI commit', str(version?.ui_commit)],
    ['UI package.json', str(uiVersion)],
  ];
  const base: Array<[string, string | number]> = [
    ['POLARIS', str(version?.platform_core)],
    ['API', str(version?.backend_api)],
    ['Web frontend', str(version?.web_frontend)],
    ['UI package.json', str(uiVersion)],
    ['Session engine', str(version?.session_engine)],
    ['Correlation engine', str(version?.correlation_engine)],
    ['Event schema', str(version?.event_schema)],
    ['Callflow schema', str(version?.callflow_schema)],
  ];
  const decoders = version?.decoders;
  if (Array.isArray(decoders)) decoders.forEach((decoder, index) => {
    if (decoder && typeof decoder === 'object') {
      const item = decoder as RecordData;
      base.push([str(item['name'] ?? `Decoder ${index + 1}`), str(item['version'])]);
    } else base.push([`Decoder ${index + 1}`, str(decoder)]);
  });
  else if (decoders && typeof decoders === 'object') Object.entries(decoders as RecordData).forEach(([name, value]) => base.push([name, str(value)]));
  else base.push(['Decoders', str(decoders)]);
  return base;
}

export function decoderVersions(decoders: unknown): string {
  if (Array.isArray(decoders)) return decoders.length ? decoders.map((decoder, index) => {
    if (decoder && typeof decoder === 'object') {
      const item = decoder as RecordData;
      return `${str(item['name'] ?? `Decoder ${index + 1}`)} ${str(item['version'])}`;
    }
    return str(decoder);
  }).join(' · ') : '—';
  if (decoders && typeof decoders === 'object') {
    const entries = Object.entries(decoders as RecordData);
    return entries.length ? entries.map(([name, value]) => `${name} ${str(value)}`).join(' · ') : '—';
  }
  return str(decoders);
}
export function toLegacyProbe(p: Probe, index = 0, metrics?: Metrics | null, safety?: Safety | null, servedVersion?: string) {
  const health = String(p.health ?? p.status ?? p['probe_state'] ?? '').toLowerCase();
  const online = p.online === true || ['ok', 'healthy', 'online', 'operational'].includes(health);
  const degraded = online && ['degraded', 'warning', 'warn'].includes(health);
  const filesystem = safety?.filesystem as RecordData | undefined;
  const metricDisk = metrics?.disk as RecordData | undefined;
  const metricCpu = metrics?.cpu as RecordData | undefined;
  const seen = p.last_seen ?? (p.last_heartbeat_epoch_s == null ? null : new Date(p.last_heartbeat_epoch_s * 1000).toISOString());
  return {
    n: str(p.name ?? p.probe_id ?? p.id ?? `probe-${index}`), id: p.probe_id ?? p.id,
    role: str(p.role ?? p.probe_type), st: degraded ? 'warn' : online ? 'ok' : 'error',
    ver: str(p.version ?? servedVersion), exp: servedVersion ?? '',
    cpu: p.cpu_usage_percent ?? p.cpu_percent ?? (typeof metricCpu?.['usage_percent'] === 'number' ? metricCpu['usage_percent'] : null),
    memoryBytes: p.memory_usage_bytes ?? null, memoryAnonBytes: p.memory_anon_bytes ?? null, memoryFileBytes: p.memory_file_bytes ?? null,
    disk: p.disk_usage_percent ?? p.disk_percent ?? (typeof filesystem?.['usage_percent'] === 'number' ? filesystem['usage_percent'] : typeof metricDisk?.['usage_percent'] === 'number' ? metricDisk['usage_percent'] : null),
    diskFreeBytes: typeof filesystem?.['available_bytes'] === 'number' ? filesystem['available_bytes'] : typeof metricDisk?.['available_bytes'] === 'number' ? metricDisk['available_bytes'] : null,
    seen: str(seen), info: str(p['host'] ?? p['site'] ?? p['description']), interfaces: p.connected_interfaces ?? [],
  };
}
export function healthKpi(id: string, m?: Metrics | null, s?: Safety | null): number | null {
  if (id === 'kpi.probe.dumpcap') return m?.dumpcap_active == null || m.dumpcap_expected == null || m.dumpcap_expected <= 0 ? null : m.dumpcap_active / m.dumpcap_expected * 100;
  if (id === 'kpi.probe.segments') return typeof m?.['segments_dropped'] === 'number' ? m['segments_dropped'] : null;
  if (id === 'kpi.probe.lag') return m?.import_lag_seconds ?? null;
  if (id === 'kpi.probe.disk') {
    const filesystem=s?.filesystem as RecordData | undefined;
    if (typeof filesystem?.['usage_percent']==='number') return Math.max(0,100-filesystem['usage_percent']);
    return s?.free_percent ?? (s?.free_bytes == null || s.total_bytes == null || s.total_bytes <= 0 ? null : s.free_bytes / s.total_bytes * 100);
  }
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
