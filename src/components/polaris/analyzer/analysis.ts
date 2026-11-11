// Pure session-analysis rules. Every conclusion comes from observed messages; nothing is invented.
type Rec = Record<string, unknown>;
export type Verdict = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'UNKNOWN';
export type Msg = [string, string, string, string | null, string | null, string | null];
export type Flow = { msgs: Msg[]; evidence?: Rec[]; procs: [string, number, number, unknown?][] };

export function verdict(value: unknown): Verdict {
  const v = String(value ?? '').toLowerCase();
  if (!v || v === '—') return 'UNKNOWN';
  if (/échec|echec|fail|reject|error|abort|refus/.test(v)) return 'FAILED';
  if (/partial|partiel|incomplet|incomplete|open|ouvert|pending|timeout/.test(v)) return 'PARTIAL';
  if (/succès|succes|success|complete|accept|ok/.test(v)) return 'SUCCESS';
  return 'UNKNOWN';
}
export const isCauseMsg = (m?: Msg) => !!(m && m[4] && /^cause|code|result/i.test(m[4]));
const FAIL_MSG = /reject|failure|fail|abort|error/i;
const DONE_MSG = /complete|accept|response|ack|success|setup response/i;

export function timeOf(e?: Rec): number | null {
  if (!e) return null;
  const raw = e['observed_epoch_ms'] ?? e['timestamp_ms'] ?? e['timestamp'] ?? e['observed_timestamp'] ?? e['packet_timestamp'] ?? e['observed_at'] ?? e['time'];
  return toMs(raw);
}
// Accepts ISO strings, epoch milliseconds, or epoch seconds (number or numeric string).
export function toMs(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(\.\d+)?Z?$/i.test(raw.trim()) ? Number(raw.trim().replace(/z$/i, '')) : null;
  if (n != null) return Number.isFinite(n) ? (n < 1e11 ? n * 1000 : n) : null;
  if (typeof raw === 'string') { const t = Date.parse(raw); return Number.isNaN(t) ? null : t; }
  return null;
}
export function isFailedMessage(m: Msg, e?: Rec): boolean {
  if (isCauseMsg(m)) return true;
  if (FAIL_MSG.test(m[1] ?? '')) return true;
  if (e && Array.isArray(e['errors']) && e['errors'].length > 0) return true;
  return verdict(e?.['semantic_status']) === 'FAILED';
}
export type Step = { name: string; start: number; end: number; t0: number | null; t1: number | null; durationMs: number | null; result: Verdict; cause: string | null; failIndex: number | null };
export function steps(flow: Flow): Step[] {
  return flow.procs.map(([name, a0, b0]) => {
    let a = a0, b = b0;
    if (!(a >= 0 && b >= a)) { const idx = (flow.evidence ?? []).map((e, k) => e?.['procedure_group'] === name ? k : -1).filter(k => k >= 0); if (idx.length) { a = idx[0]!; b = idx[idx.length - 1]!; } }
    const valid = a >= 0 && b >= a && b < flow.msgs.length;
    if (!valid) return { name, start: a, end: b, t0: null, t1: null, durationMs: null, result: 'PARTIAL' as Verdict, cause: null, failIndex: null };
    let failIndex: number | null = null;
    for (let k = a; k <= b; k++) if (isFailedMessage(flow.msgs[k]!, flow.evidence?.[k])) { failIndex = k; break; }
    const t0 = timeOf(flow.evidence?.[a]), t1 = timeOf(flow.evidence?.[b]);
    const last = flow.msgs[b]!;
    const result: Verdict = failIndex != null ? 'FAILED' : DONE_MSG.test(last[1] ?? '') ? 'SUCCESS' : 'PARTIAL';
    const fm = failIndex != null ? flow.msgs[failIndex]! : null;
    return { name, start: a, end: b, t0, t1, durationMs: t0 != null && t1 != null ? t1 - t0 : null, result, cause: fm ? (fm[5] ?? fm[1]) : null, failIndex };
  });
}
export function overall(sessionState: unknown, s: Step[]): Verdict {
  const declared = verdict(sessionState);
  if (s.some(x => x.result === 'FAILED')) return 'FAILED';
  if (declared !== 'UNKNOWN') return declared;
  if (!s.length) return 'UNKNOWN';
  return s.every(x => x.result === 'SUCCESS') ? 'SUCCESS' : 'PARTIAL';
}
export type Failure = { index: number; procedure: string; message: string; interface: string; entity: string; cause: string; raw: string; time: number | null };
export function failures(flow: Flow): Failure[] {
  const out: Failure[] = [];
  flow.msgs.forEach((m, k) => {
    const e = flow.evidence?.[k];
    if (!isFailedMessage(m, e)) return;
    const proc = flow.procs.find(([, a, b]) => k >= a && k <= b)?.[0] ?? '—';
    const errs = e && Array.isArray(e['errors']) ? e['errors'].map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('; ') : '';
    out.push({ index: k, procedure: proc, message: m[1], interface: m[0], entity: (m[2] ?? '').split(' → ')[0] || '—', cause: m[5] ?? (errs || m[1]), raw: m[4] ? `${m[4]} ${m[5] ?? ''}`.trim() : (errs || String(e?.['semantic_status'] ?? '—')), time: timeOf(e) });
  });
  return out;
}
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function sessionKpis(session: Rec, flow: Flow) {
  const times = (flow.evidence ?? []).map(timeOf).filter((t): t is number => t != null);
  const start = toMs(session['start_timestamp']), end = toMs(session['end_timestamp']);
  const duration = start != null && end != null ? end - start : times.length > 1 ? Math.max(...times) - Math.min(...times) : null;
  const first = steps(flow).find(x => x.result === 'SUCCESS' && x.durationMs != null);
  return {
    durationMs: duration, setupMs: first?.durationMs ?? null,
    dlAvg: num(session['dl_throughput_avg_bps']), dlMax: num(session['dl_throughput_max_bps']), dlInst: num(session['dl_throughput_bps']),
    ulAvg: num(session['ul_throughput_avg_bps']), ulMax: num(session['ul_throughput_max_bps']), ulInst: num(session['ul_throughput_bps']),
    dlVolume: num(session['dl_bytes']), ulVolume: num(session['ul_bytes']), rttMs: num(session['rtt_ms']),
    retransmissions: num(session['retransmissions']), lossPct: num(session['packet_loss_percent']),
  };
}
export function fmtDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'N/A';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}
export function fmtBytes(b: number | null): string { if (b == null) return 'N/A'; const u = ['o', 'Ko', 'Mo', 'Go']; let i = 0, v = b; while (v >= 1024 && i < 3) { v /= 1024; i++; } return `${v.toFixed(i ? 1 : 0)} ${u[i]}`; }
export function fmtRate(b: number | null): string { if (b == null) return 'N/A'; return b >= 1e6 ? `${(b / 1e6).toFixed(1)} Mbit/s` : `${(b / 1e3).toFixed(0)} kbit/s`; }
export function fmtUtc(ms: number | null): string { if (ms == null) return '—'; const d = new Date(ms); return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(11, 23); }

// Compact page list for pagination: always first/last, neighbours of current, '…' for gaps.
export function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = [1, total, current - 1, current, current + 1].filter(p => p >= 1 && p <= total);
  const pages = [...new Set(set)].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  pages.forEach((p, i) => { if (i && p - pages[i - 1]! > 1) out.push('…'); out.push(p); });
  return out;
}
export const pageSlice = <T,>(rows: T[], page: number, size: number) => rows.slice((page - 1) * size, page * size);
