// Subscriber journey rules (frontend only). Links are EXACT or OUVERT, never inferred from time, cell or UE IP.
type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null || v === '' ? null : String(v));
export const shortPseudo = (p: unknown) => { const v = s(p); return v ? (v.length > 14 ? `${v.slice(0, 10)}…${v.slice(-4)}` : v) : '—'; };
export const subscriberOf = (r: Rec) => s(r['subscriber_pseudonym']);

export type ProcKind = 'attach' | 'pdu' | 'release' | 'service' | 'tau' | 'handover' | 'detach' | 'other';
export function procKind(name: unknown): ProcKind {
  const n = String(name ?? '').toLowerCase();
  if (/detach|deregistration/.test(n)) return 'detach';
  if (/attach|registration/.test(n) && !/tracking|mobility/.test(n)) return 'attach';
  if (/pdu|pdn|bearer|e-rab|pfcp/.test(n)) return 'pdu';
  if (/release|idle|inactive/.test(n)) return 'release';
  if (/service request/.test(n)) return 'service';
  if (/tau|tracking area|mobility/.test(n)) return 'tau';
  if (/handover|path switch/.test(n)) return 'handover';
  return 'other';
}

export type Ref = { session_id: string | null; capture_id: string | null; seq: number | null; message: string | null };
const ref = (x: unknown): Ref => { const r = (x && typeof x === 'object' ? x : {}) as Rec; return { session_id: s(r['session_id']), capture_id: s(r['capture_id']), seq: typeof r['seq'] === 'number' ? r['seq'] : null, message: s(r['message'] ?? r['message_name']) }; };
export const refLabel = (r: Ref) => `(${r.capture_id ? shortPseudo(r.capture_id) : '—'}, ${r.seq ?? '—'})`;

export type JourneySession = { session_id: string; capture_id: string | null; seq: number | null; procedures: { name: string; kind: ProcKind }[] };
export type JourneyLink = { from: string | null; to: string; status: 'EXACT' | 'OUVERT'; rule: string | null; proof: string | null; reason: string | null };
const cmp = (a: { capture_id: string | null; seq: number | null }, b: { capture_id: string | null; seq: number | null }) =>
  String(a.capture_id ?? '').localeCompare(String(b.capture_id ?? '')) || (a.seq ?? Infinity) - (b.seq ?? Infinity);

export function toJourney(data: unknown): { sessions: JourneySession[]; links: JourneyLink[] } {
  const body = (data && typeof data === 'object' ? data : {}) as Rec;
  const sessions = (Array.isArray(body['sessions']) ? body['sessions'] : []).filter(x => x && typeof x === 'object').map(x => {
    const r = x as Rec; const procs = Array.isArray(r['procedures']) ? r['procedures'] : [];
    return { session_id: String(r['session_id'] ?? '—'), capture_id: s(r['capture_id'] ?? r['anchor_capture_id']), seq: typeof r['seq'] === 'number' ? r['seq'] : typeof r['first_packet_number'] === 'number' ? r['first_packet_number'] : typeof r['first_seq'] === 'number' ? r['first_seq'] : null,
      procedures: procs.map(p => { const name = typeof p === 'string' ? p : String((p as Rec)?.['name'] ?? '—'); return { name, kind: procKind(name) }; }) };
  }).sort(cmp);
  const links = (Array.isArray(body['links']) ? body['links'] : []).filter(x => x && typeof x === 'object').flatMap(x => {
    const r = x as Rec; const raw = String(r['status'] ?? r['confidence'] ?? '').toUpperCase();
    const status = raw === 'EXACT' ? 'EXACT' : raw === 'OPEN' || raw === 'OUVERT' ? 'OUVERT' : null; // anything else (e.g. "probable") is dropped
    const to = s(r['to'] ?? r['target_session_id']);
    if (!status || !to) return [];
    return [{ from: s(r['from'] ?? r['source_session_id']), to, status, rule: s(r['rule']), proof: s(r['proof'] ?? r['evidence']), reason: status === 'OUVERT' ? (s(r['reason']) ?? 'attribution non capturée') : null } as JourneyLink];
  });
  return { sessions, links };
}

export type TmsiStatus = 'actif' | 'remplacé' | 'attribution non capturée';
export type Tmsi = { label: string; assigned: Ref | null; presented: Ref[]; status: TmsiStatus };
export function toTmsiList(data: unknown, clear: boolean): Tmsi[] {
  const list = Array.isArray(data) ? data : Array.isArray((data as Rec)?.['tmsi']) ? (data as Rec)['tmsi'] as unknown[] : [];
  return list.filter(x => x && typeof x === 'object').map(x => {
    const r = x as Rec; const assigned = r['assigned'] ? ref(r['assigned']) : null;
    const st = String(r['status'] ?? '').toLowerCase();
    const status: TmsiStatus = !assigned || /never|jamais|not_observed|non/.test(st) ? 'attribution non capturée' : /replaced|remplac/.test(st) ? 'remplacé' : 'actif';
    return { label: clear && s(r['tmsi']) ? String(r['tmsi']) : shortPseudo(r['tmsi_pseudonym']), assigned, presented: (Array.isArray(r['presented']) ? r['presented'] : []).map(ref), status };
  });
}

// Grouping rows by subscriber: unknown subscriber rows stay ungrouped, order inside a group is (capture_id, seq).
export function groupBySubscriber<T extends Rec>(rows: T[]): { key: string | null; rows: T[] }[] {
  const groups = new Map<string | null, T[]>();
  rows.forEach(r => { const k = subscriberOf(r); groups.set(k, [...(groups.get(k) ?? []), r]); });
  return [...groups].map(([key, rs]) => ({ key, rows: [...rs].sort((a, b) => cmp({ capture_id: s(a['cap']), seq: Number(a['seq']) }, { capture_id: s(b['cap']), seq: Number(b['seq']) })) }))
    .sort((a, b) => (a.key == null ? 1 : b.key == null ? -1 : a.key.localeCompare(b.key)));
}
