// Demo-only subscriber journeys (labelled demo). Pseudonyms are invented; no clear identity ever appears.
import { SESS } from './catalogue';
type Rec = Record<string, unknown>;
const GROUPS: Record<string, number[]> = { 'demo-sub-a1f0c93e7b22d4': [1, 3, 6], 'demo-sub-b7e21d0a94cc58': [2, 5, 9] };
const sid = (id: unknown) => `demo-sess-${id}`;
const rows = SESS as unknown as Rec[];
for (const r of rows) {
  r['session_id'] = sid(r['id']);
  // Test PLMN 001-01 identities (demo only), one subscriber per group.
  const g = Object.entries(GROUPS).findIndex(([, ids]) => ids.includes(Number(r['id'])));
  const n = g >= 0 ? g + 1 : Number(r['id']) + 10;
  const mt = (0xC0A80000 + n * 4097 + Number(r['id'])).toString(16).toUpperCase().padStart(8, '0');
  Object.assign(r, { imsi: `00101${String(n).padStart(10, '0')}`, m_tmsi: mt, s_tmsi: `01${mt}`, msisdn: `3360000${String(n).padStart(4, '0')}` });
}
for (const [pseudo, ids] of Object.entries(GROUPS)) ids.forEach((id, i) => {
  const r = rows.find(x => x['id'] === id); if (!r) return;
  Object.assign(r, { subscriber_pseudonym: pseudo, subscriber_session_count: ids.length,
    previous_session_id: i > 0 ? sid(ids[i - 1]) : null, next_session_id: i < ids.length - 1 ? sid(ids[i + 1]) : null,
    previous_link: i > 0 ? { status: i === 2 ? 'OUVERT' : 'EXACT', proof: i === 2 ? 'TMSI présenté, attribution non capturée' : `TMSI attribué en (${r['cap']}, ${Number(r['seq']) - 40}) A, présenté en (${r['cap']}, ${r['seq']}) B` } : null,
    next_link: i < ids.length - 1 ? { status: i === 1 ? 'OUVERT' : 'EXACT', proof: i === 1 ? 'TMSI présenté, attribution non capturée' : 'TMSI attribué puis présenté' } : null });
});
const procs = (r: Rec) => String(r['proc'] ?? '').split('+').map(x => x.trim()).filter(Boolean).concat(['Release']);
function journey(pseudo: string) {
  const ids = GROUPS[pseudo]; if (!ids) return undefined;
  const ss = ids.map(id => rows.find(x => x['id'] === id)!).filter(Boolean);
  return { subscriber_pseudonym: pseudo,
    sessions: ss.map(r => ({ session_id: r['session_id'], capture_id: `cap-${r['cap']}`, seq: r['seq'], procedures: procs(r) })),
    links: ss.slice(1).map((r, i) => { const a = ss[i] as Rec; return i === 1
      ? { from: a['session_id'], to: r['session_id'], status: 'OUVERT', reason: 'attribution non capturée' }
      : { from: a['session_id'], to: r['session_id'], status: 'EXACT', rule: 'TMSI', proof: `TMSI attribué en (cap-${a['cap']}, ${a['seq']}), présenté en (cap-${r['cap']}, ${r['seq']})` }; }) };
}
function tmsi(pseudo: string) {
  const ids = GROUPS[pseudo]; if (!ids) return undefined;
  const ss = ids.map(id => rows.find(x => x['id'] === id)).filter((x): x is Rec => !!x); if (ss.length < 3) return undefined;
  const at = (r: Rec, d: number, m: string) => ({ session_id: r['session_id'], capture_id: `cap-${r['cap']}`, seq: Number(r['seq']) + d, message: m });
  return [
    { tmsi_pseudonym: 'demo-tmsi-01', assigned: at(ss[0] as Rec, 7, 'Registration Accept'), presented: [at(ss[1] as Rec, 0, 'Service Request')], status: 'replaced' },
    { tmsi_pseudonym: 'demo-tmsi-02', assigned: null, presented: [at(ss[2] as Rec, 0, 'Registration Request')], status: 'not_observed' },
    { tmsi_pseudonym: 'demo-tmsi-03', assigned: at(ss[2] as Rec, 7, 'Registration Accept'), presented: [], status: 'active' },
  ];
}
export function demoSubscriber(path: string, params: Rec = {}): unknown {
  let m = path.match(/^\/subscribers\/([^/]+)\/(journey|tmsi)$/);
  if (m) { const p = decodeURIComponent(m[1] ?? ''); return m[2] === 'journey' ? journey(p) : tmsi(p); }
  m = path.match(/^\/sessions\/([^/]+)\/identities$/);
  if (m) return { imsi: 'masqué (démo)', msisdn: 'masqué (démo)', imeisv: 'masqué (démo)' };
  if (path === '/identities') return String(params['q'] ?? '').length >= 4 ? { subscriber_pseudonym: Object.keys(GROUPS)[0] } : undefined;
  return undefined;
}
