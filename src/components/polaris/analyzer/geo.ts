// Geolocation extraction: reads only coordinates and radio identifiers present in POLARIS data.
// Never derives positions (no Timing Advance → coordinates), never treats a cell site as the UE position.
export type GeoKind = 'ue-actual' | 'ue-estimated' | 'cell';
export type GeoPoint = { kind: GeoKind; lat: number; lon: number; rat: 'LTE' | 'NR' | null; label: string; source: string; accuracy_m: number | null; timestamp: string | null; eventIndex: number | null; cellId: string | null; serving: boolean };
export type RadioContext = { cellId: string | null; pci: string | null; arfcn: string | null; tac: string | null; node: string | null; timingAdvance: string | null };
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : null; };
const LAT = ['latitude', 'lat'], LON = ['longitude', 'lon', 'lng'];
const pick = (o: Obj, keys: string[]) => { for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase())) return o[k]; return undefined; };
export function coords(o: Obj): { lat: number; lon: number } | null {
  const lat = num(pick(o, LAT)), lon = num(pick(o, LON));
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null;
  return { lat, lon };
}
const text = (v: unknown) => (v == null || v === '' ? null : typeof v === 'object' ? null : String(v));
const ratOf = (v: unknown): 'LTE' | 'NR' | null => { const s = String(v ?? '').toUpperCase(); return /NR|5G/.test(s) ? 'NR' : /LTE|4G|EUTRA/.test(s) ? 'LTE' : null; };
const RADIO: Record<keyof RadioContext, RegExp> = { cellId: /^(cell_?id|nci|eci|ecgi|ncgi|cgi|serving_cell(_id)?)$/i, pci: /^(pci|phys_?cell_?id)$/i, arfcn: /^(earfcn|nr_?arfcn|arfcn|dl_?earfcn)$/i, tac: /^(tac|tracking_area_code)$/i, node: /^(enb(_id)?|gnb(_id)?|enodeb(_id)?|gnodeb(_id)?|global_ran_node_id)$/i, timingAdvance: /^(timing_?advance|ta)$/i };
export function radioContext(value: unknown, depth = 0, out: RadioContext = { cellId: null, pci: null, arfcn: null, tac: null, node: null, timingAdvance: null }): RadioContext {
  if (depth > 6) return out;
  if (Array.isArray(value)) { value.forEach(v => radioContext(v, depth + 1, out)); return out; }
  if (!isObj(value)) return out;
  // IE trees often carry {name, value} pairs.
  const n = typeof value['name'] === 'string' ? value['name'] : typeof value['field'] === 'string' ? value['field'] : null;
  for (const [field, re] of Object.entries(RADIO) as [keyof RadioContext, RegExp][]) {
    if (out[field] == null && n && re.test(n)) out[field] = text(value['value'] ?? value['decoded']);
    for (const [k, v] of Object.entries(value)) if (out[field] == null && re.test(k)) out[field] = text(v);
  }
  Object.values(value).forEach(v => { if (typeof v === 'object') radioContext(v, depth + 1, out); });
  return out;
}
function scan(value: unknown, ctx: { path: string; rat: 'LTE' | 'NR' | null; ts: string | null; eventIndex: number | null }, out: GeoPoint[], depth = 0) {
  if (depth > 6 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(v => scan(v, ctx, out, depth + 1)); return; }
  const o = value as Obj; const c = coords(o);
  const path = ctx.path.toLowerCase();
  const rat = ratOf(o['rat'] ?? o['technology']) ?? ctx.rat;
  if (c) {
    const source = text(o['source'] ?? o['location_source'] ?? o['method']) ?? '';
    const isCell = /cell|site|enb|gnb|antenna|sector/.test(path) || o['kind'] === 'cell' || o['cell_id'] != null && !/ue|gnss|gps/.test(path);
    const isUe = /ue|gnss|gps|position|location|device/.test(path) || /gnss|gps/i.test(source);
    if (isCell || isUe) {
      const estimated = o['estimated'] === true || /estim|ta|timing|measure|e-?cid|otdoa/i.test(source);
      const kind: GeoKind = isCell && !/gnss|gps/i.test(source) ? 'cell' : estimated || !/gnss|gps|actual|reported/i.test(source) ? 'ue-estimated' : 'ue-actual';
      const cellId = text(o['cell_id'] ?? o['eci'] ?? o['nci'] ?? o['id']);
      out.push({ kind, ...c, rat, label: text(o['name'] ?? o['label']) ?? (kind === 'cell' ? `Cellule ${cellId ?? '—'}` : 'UE'), source: source || (kind === 'cell' ? 'inventaire cellules' : 'non précisée'), accuracy_m: num(o['accuracy_m'] ?? o['accuracy'] ?? o['uncertainty_m']), timestamp: text(o['timestamp'] ?? o['time']) ?? ctx.ts, eventIndex: ctx.eventIndex, cellId, serving: kind === 'cell' && !/neighbo/.test(path) && o['neighbor'] !== true });
    }
  }
  for (const [k, v] of Object.entries(o)) if (typeof v === 'object') scan(v, { ...ctx, path: `${ctx.path}.${k}`, rat }, out, depth + 1);
}
export function extractGeo(session: Obj | null | undefined, events: unknown[] = []) {
  const points: GeoPoint[] = [];
  if (session) { const { d: _d, ...rest } = session; scan(rest, { path: 'session', rat: ratOf(session['technology'] ?? session['rat']), ts: null, eventIndex: null }, points); }
  events.forEach((e, i) => { if (isObj(e)) scan(e, { path: 'event', rat: ratOf(e['technology']), ts: text(e['timestamp'] ?? e['time']), eventIndex: i }, points); });
  const seen = new Set<string>();
  const unique = points.filter(p => { const k = `${p.kind}|${p.lat}|${p.lon}|${p.eventIndex ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const trajectory = unique.filter(p => p.kind !== 'cell' && p.eventIndex != null).sort((a, b) => (a.eventIndex ?? 0) - (b.eventIndex ?? 0));
  return { points: unique, trajectory: trajectory.length > 1 ? trajectory : [] };
}
