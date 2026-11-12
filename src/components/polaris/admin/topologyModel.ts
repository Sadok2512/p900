/*
 * Network topology model — pure rules deciding what the canvas may draw.
 * Node positions are fixed per slot (stable across refresh); links are drawn
 * only when the lab names the interface (configuration, runtime, probe capture
 * point or observed link). A 3GPP reference alone never creates a link.
 */
import { availabilityOf, captureStateOf, type Availability, type CaptureState } from '@/lib/polaris-ui/interfaceColors';

export type Rec = Record<string, unknown>;
export type Slot = { id: string; label: string; zone: 'ran' | '5gc' | 'epc' | 'dn'; x: number; y: number; w: number; h: number };
export type RefLink = { name: string; from: string; to: string; protocol: string; plane: 'control' | 'user' | 'sbi' | 'logical' };

export const NODE_W = 84, NODE_H = 40;
const nf = (id: string, zone: Slot['zone'], x: number, y: number, label = id): Slot => ({ id, label, zone, x, y, w: NODE_W, h: NODE_H });

export const CORE_5G = ['NRF','AUSF','UDM','UDR','PCF','NSSF','BSF','AMF','SMF','UPF'];
export const CORE_LTE = ['MME','SGW-C','PGW-C','PCRF','HSS','SGW-U','PGW-U'];
export const SBI_Y = 150;

export const SLOTS: Slot[] = [
  ...['NRF','AUSF','UDM','UDR','PCF','NSSF','BSF'].map((id, i) => nf(id, '5gc', 400 + i * 96, 78)),
  nf('AMF', '5gc', 430, 196), nf('SMF', '5gc', 670, 196), nf('UPF', '5gc', 670, 282),
  nf('MME', 'epc', 430, 430), nf('SGW-C', 'epc', 670, 430), nf('PGW-C', 'epc', 880, 430), nf('PCRF', 'epc', 1010, 430),
  nf('HSS', 'epc', 430, 560), nf('SGW-U', 'epc', 670, 560), nf('PGW-U', 'epc', 880, 560),
  { id: 'gNB', label: 'gNB', zone: 'ran', x: 150, y: 210, w: 110, h: 46 },
  { id: 'eNB', label: 'eNB', zone: 'ran', x: 150, y: 470, w: 110, h: 46 },
  { id: 'DN', label: 'Data Network', zone: 'dn', x: 1170, y: 340, w: 150, h: 64 },
];
export const slotById = Object.fromEntries(SLOTS.map(s => [s.id, s]));

export const REFERENCE_LINKS: RefLink[] = [
  { name: 'N2', from: 'gNB', to: 'AMF', protocol: 'NGAP / SCTP', plane: 'control' },
  { name: 'N3', from: 'gNB', to: 'UPF', protocol: 'GTP-U', plane: 'user' },
  { name: 'N4', from: 'SMF', to: 'UPF', protocol: 'PFCP', plane: 'control' },
  { name: 'N6', from: 'UPF', to: 'DN', protocol: 'IP', plane: 'user' },
  { name: 'N1', from: 'UE5G', to: 'AMF', protocol: 'NAS-5GS (logique)', plane: 'logical' },
  { name: 'SBI', from: 'SBI', to: 'SBI', protocol: 'HTTP/2', plane: 'sbi' },
  { name: 'S1-MME', from: 'eNB', to: 'MME', protocol: 'S1AP / SCTP', plane: 'control' },
  { name: 'S1-U', from: 'eNB', to: 'SGW-U', protocol: 'GTP-U', plane: 'user' },
  { name: 'S11', from: 'MME', to: 'SGW-C', protocol: 'GTPv2-C', plane: 'control' },
  { name: 'S5-C', from: 'SGW-C', to: 'PGW-C', protocol: 'GTPv2-C', plane: 'control' },
  { name: 'S5-U', from: 'SGW-U', to: 'PGW-U', protocol: 'GTP-U', plane: 'user' },
  { name: 'S6a', from: 'MME', to: 'HSS', protocol: 'Diameter', plane: 'control' },
  { name: 'SGi', from: 'PGW-U', to: 'DN', protocol: 'IP', plane: 'user' },
];

const ALIASES: Record<string, string> = { 'NG-C': 'N2', 'NG-U': 'N3', 'S1-C': 'S1-MME', S1AP: 'S1-MME', S5: 'S5-C' };
export const canonical = (name: unknown) => { const raw = String(name ?? '').trim(); const up = raw.toUpperCase(); const ref = REFERENCE_LINKS.find(l => l.name.toUpperCase() === up); return ref?.name ?? ALIASES[up] ?? raw; };
const nameOf = (row: Rec) => canonical(row['interface'] ?? row['name'] ?? row['capture_interface'] ?? row['role']);

export type Evidence = { configured: boolean; runtime?: Rec; observed?: Rec; probes: string[] };
export type LinkView = RefLink & { evidence: Evidence; network: Availability; capturePoint: Availability; capture: CaptureState };

/** Which reference interfaces the lab actually names, and in what state. */
export function buildLinks({ interfaces = [], runtime = [], observedLinks = [], probes = [] }: { interfaces?: Rec[]; runtime?: Rec[]; observedLinks?: Rec[]; probes?: { id: string; interfaces: string[] }[] }): LinkView[] {
  const out: LinkView[] = [];
  for (const ref of REFERENCE_LINKS) {
    const configured = interfaces.some(r => nameOf(r) === ref.name);
    const rt = runtime.find(r => nameOf(r) === ref.name);
    const obs = observedLinks.find(r => nameOf(r) === ref.name);
    const by = probes.filter(p => p.interfaces.map(canonical).includes(ref.name)).map(p => p.id);
    if (!configured && !rt && !obs && !by.length) continue; // no evidence: never draw it
    out.push({
      ...ref, evidence: { configured, runtime: rt, observed: obs, probes: by },
      // Network state comes only from observed topology; a running capture is not proof the link works.
      network: obs ? availabilityOf(obs['active'] ?? obs['up'], obs['state'] ?? obs['status']) : 'unknown',
      capturePoint: rt ? availabilityOf(rt['active'], rt['state'] ?? rt['status']) : 'unknown',
      capture: rt ? captureStateOf(rt) : 'unknown',
    });
  }
  return out;
}

export type NodeState = 'operational' | 'degraded' | 'failed' | 'unknown';
export function nodeStateOf(value: unknown): NodeState {
  const s = String(value ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (['running','healthy','active','connected','ready','up','ok','online','operational'].includes(s)) return 'operational';
  if (['starting','degraded','warning','warn','partial'].includes(s)) return 'degraded';
  if (['stopped','failed','error','down','offline','crashed','exited'].includes(s)) return 'failed';
  return 'unknown';
}

/** Orthogonal route between two slot anchors; label sits on the middle segment. */
export function route(a: Slot, b: Slot, lane = 0) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2 + lane * a.h * 0.25, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  if (Math.abs(ay - by) < 4) { const x1 = ax < bx ? a.x + a.w : a.x, x2 = ax < bx ? b.x : b.x + b.w; return { d: `M${x1},${ay} H${x2}`, lx: (x1 + x2) / 2, ly: ay }; }
  if (Math.abs(ax - bx) < 4) { const y1 = ay < by ? a.y + a.h : a.y, y2 = ay < by ? b.y : b.y + b.h; return { d: `M${ax},${y1} V${y2}`, lx: ax, ly: (y1 + y2) / 2 }; }
  const x1 = ax < bx ? a.x + a.w : a.x, x2 = ax < bx ? b.x : b.x + b.w, mx = Math.round((x1 + x2) / 2);
  return { d: `M${x1},${ay} H${mx} V${by} H${x2}`, lx: mx, ly: (ay + by) / 2 };
}
