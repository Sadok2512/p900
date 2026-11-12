/*
 * Interface presentation rules — the single source of truth for how a network
 * interface is coloured and how a capture/availability state is read.
 *
 * Colours identify the interface FAMILY (N2, N3, SBI, S6a …), never its
 * operational state: availability and dumpcap state keep their own tokens
 * (success / danger / warning / subtle) so a blue badge never reads as "up".
 *
 * Values live in src/styles.css as --ifc-* tokens; this module only maps a
 * name to a family and exposes the token names.
 */

export type InterfaceFamily = 'blue' | 'green' | 'amber' | 'purple' | 'pink' | 'teal' | 'gray';

/* Brief §2 mapping. Anything the lab names but does not list falls back to gray. */
export const INTERFACE_FAMILY: Record<string, InterfaceFamily> = {
  N2: 'blue', N3: 'green', N4: 'amber', SBI: 'purple',
  'S1-MME': 'blue', 'S1-U': 'green', S11: 'amber',
  'S5-C': 'amber', 'S5-U': 'green', S6a: 'purple', Sxab: 'purple',
  IMS: 'pink', N6: 'teal',
  /* Bare S5 is the GTP-C control plane, same family as S5-C. */
  S5: 'amber',
};

/* Reference hex of every family, kept so fixtures and tests can be checked
 * against the same values the CSS tokens were authored from. */
export const INTERFACE_FAMILY_HEX: Record<InterfaceFamily, { fg: string; bg: string; line: string }> = {
  blue: { fg: '#2563EB', bg: '#EFF6FF', line: '#BFDBFE' },
  green: { fg: '#15803D', bg: '#DCFCE7', line: '#BBF7D0' },
  amber: { fg: '#B45309', bg: '#FEF3C7', line: '#FDE68A' },
  purple: { fg: '#7C3AED', bg: '#F3E8FF', line: '#E9D5FF' },
  pink: { fg: '#BE185D', bg: '#FCE7F3', line: '#FBCFE8' },
  teal: { fg: '#0F766E', bg: '#CCFBF1', line: '#99F6E4' },
  gray: { fg: '#64748B', bg: '#F1F5F9', line: '#E2E8F0' },
};

const text = (value: unknown) => String(value ?? '').trim();

export function interfaceFamilyOf(name: unknown): InterfaceFamily {
  const raw = text(name);
  if (!raw) return 'gray';
  return INTERFACE_FAMILY[raw] ?? INTERFACE_FAMILY[raw.toUpperCase()] ?? 'gray';
}

export const interfaceInk = (name: unknown) => `var(--ifc-${interfaceFamilyOf(name)}-fg)`;
export const interfaceBackground = (name: unknown) => `var(--ifc-${interfaceFamilyOf(name)}-bg)`;
export const interfaceLine = (name: unknown) => `var(--ifc-${interfaceFamilyOf(name)}-line)`;

/* --- Availability: independent of the interface family (brief §4) --- */

export type Availability = 'available' | 'unavailable' | 'degraded' | 'unknown';

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Disponible', unavailable: 'Indisponible', degraded: 'Dégradé', unknown: 'Inconnue',
};

export const AVAILABILITY_TONE: Record<Availability, string> = {
  available: 'success', unavailable: 'danger', degraded: 'warning', unknown: 'subtle',
};

export function availabilityOf(active: unknown, state: unknown): Availability {
  const raw = text(state).toUpperCase();
  if (raw.includes('DEGRADED') || raw.includes('WARNING') || raw.includes('PARTIAL')) return 'degraded';
  if (active === true) return 'available';
  if (active === false) return 'unavailable';
  if (raw.includes('AVAILABLE') && !raw.includes('UNAVAILABLE')) return 'available';
  if (raw.includes('UNAVAILABLE')) return 'unavailable';
  return 'unknown';
}

/* --- dumpcap process state (brief §5): process activity, not traffic --- */

export type CaptureState = 'active' | 'inactive' | 'starting' | 'stopping' | 'unknown';

export const CAPTURE_LABEL: Record<CaptureState, string> = {
  active: 'actif', inactive: 'inactif', starting: 'démarrage', stopping: 'arrêt', unknown: 'inconnu',
};

export const CAPTURE_TONE: Record<CaptureState, string> = {
  active: 'success', inactive: 'subtle', starting: 'warning', stopping: 'warning', unknown: 'subtle',
};

export function captureStateOf(row: Record<string, unknown> = {}): CaptureState {
  const raw = text(row.state ?? row.status ?? row.capture_state).toUpperCase();
  if (raw.includes('START')) return 'starting';
  if (raw.includes('STOP')) return 'stopping';
  if (raw.includes('CAPTUR') || raw.includes('RUNNING') || raw === 'ACTIVE') return 'active';
  if (raw.includes('INACTIVE') || raw.includes('IDLE') || raw.includes('STOPPED')) return 'inactive';
  if (row.active === true) return 'active';
  if (row.active === false) return 'inactive';
  return 'unknown';
}

/* --- Traffic: a running process is not proof that packets are captured --- */

export type TrafficState = 'observed' | 'silent' | 'unavailable';

export const TRAFFIC_LABEL: Record<TrafficState, string> = {
  observed: 'trafic vu', silent: 'aucun paquet', unavailable: 'métrique indisponible',
};

export function trafficOf(packetRate: unknown, bytesPerSecond: unknown): TrafficState {
  // Number(null) is 0, so a missing measure must be screened before comparing.
  if (!hasMetric(packetRate) && !hasMetric(bytesPerSecond)) return 'unavailable';
  return (Number(packetRate) > 0 || Number(bytesPerSecond) > 0) ? 'observed' : 'silent';
}

/* --- Metric values: a missing measure stays missing, never a zero --- */

export const hasMetric = (value: unknown) => value != null && value !== '' && Number.isFinite(Number(value));

export const bytesPerSecond = (value: unknown) => {
  if (!hasMetric(value)) return '—';
  const n = Number(value);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GiB/s`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MiB/s`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB/s`;
  return `${n} B/s`;
};

export const packetsPerSecond = (value: unknown) => (hasMetric(value) ? `${Number(value).toLocaleString('fr-FR')} p/s` : '— p/s');

/* Samples for the 15-minute activity chart: only real readings, so a missing
 * measure cannot draw a flat zero line. */
export const activitySamples = (values: readonly unknown[] = []) =>
  values.filter((value): value is number => hasMetric(value)).map(Number);
