import React from 'react';
import {
  AVAILABILITY_LABEL, AVAILABILITY_TONE, CAPTURE_LABEL, CAPTURE_TONE, TRAFFIC_LABEL,
  availabilityOf, captureStateOf, interfaceFamilyOf, trafficOf,
} from '@/lib/polaris-ui/interfaceColors';

/*
 * Shared presentation pieces for network interfaces (brief §7). One geometry,
 * one type scale, one status vocabulary across Probe Manager, Probe Details,
 * Live Capture and the probe forms — so the same interface reads the same
 * everywhere and a colour never carries two meanings.
 *
 * Family colours are static Tailwind classes over the --ifc-* tokens, so the
 * scanner keeps them and a test can assert the mapping without a browser.
 */

const FAMILY_CLASS = {
  blue: 'text-ifc-blue-fg bg-ifc-blue-bg border-ifc-blue-line',
  green: 'text-ifc-green-fg bg-ifc-green-bg border-ifc-green-line',
  amber: 'text-ifc-amber-fg bg-ifc-amber-bg border-ifc-amber-line',
  purple: 'text-ifc-purple-fg bg-ifc-purple-bg border-ifc-purple-line',
  pink: 'text-ifc-pink-fg bg-ifc-pink-bg border-ifc-pink-line',
  teal: 'text-ifc-teal-fg bg-ifc-teal-bg border-ifc-teal-line',
  gray: 'text-ifc-gray-fg bg-ifc-gray-bg border-ifc-gray-line',
} as const;

const TONE_CLASS: Record<string, string> = {
  success: 'text-success bg-success-soft border-success-line',
  danger: 'text-danger bg-danger-soft border-danger-line',
  warning: 'text-warning bg-warning-soft border-warning-line',
  subtle: 'text-subtle bg-surface-2 border-border-subtle',
};
const TONE_DOT: Record<string, string> = {
  success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning', subtle: 'bg-track',
};
const toneText = (tone: string) => TONE_CLASS[tone]?.split(' ')[0] ?? 'text-subtle';

/* Compact family badge: light tint, thin border, no gradient, fixed size. */
type BadgeProps = { name: unknown; title?: string; className?: string };
export function InterfaceBadge({ name, title, className = '' }: BadgeProps) {
  const label = String(name ?? '').trim() || '—';
  return <span
    title={title ?? label}
    className={`inline-block whitespace-nowrap rounded-[3px] border px-1.5 py-[3px] font-mono text-[11px] font-semibold leading-none ${FAMILY_CLASS[interfaceFamilyOf(label)]} ${className}`}
  >{label}</span>;
}

/* Availability of an interface — its own colours, never the family colour. */
type AvailabilityProps = { active?: unknown; state?: unknown };
export function AvailabilityStatus({ active, state }: AvailabilityProps) {
  const kind = availabilityOf(active, state);
  const tone = AVAILABILITY_TONE[kind];
  return <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-[2px] text-[11.5px] font-medium ${TONE_CLASS[tone]}`}>
    <span className={`h-[7px] w-[7px] rounded-full ${TONE_DOT[tone]}`}/>
    {AVAILABILITY_LABEL[kind]}
  </span>;
}

/* dumpcap process state: a process, not a traffic proof. */
type CaptureProps = { row?: Record<string, unknown>; active?: unknown; className?: string };
export function CaptureStatus({ row = {}, active, className = '' }: CaptureProps) {
  const kind = captureStateOf({ ...row, ...(active == null ? {} : { active }) });
  const tone = CAPTURE_TONE[kind];
  return <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${className}`}>
    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${TONE_DOT[tone]} ${kind === 'starting' || kind === 'stopping' ? 'polaris-live-pulse' : ''}`}/>
    <span className={toneText(tone)}>{CAPTURE_LABEL[kind]}</span>
  </span>;
}

/* Traffic seen on the interface, shown apart from the process state. */
type TrafficProps = { packetRate?: unknown; bytesPerSecond?: unknown };
export function TrafficStatus({ packetRate, bytesPerSecond }: TrafficProps) {
  const kind = trafficOf(packetRate, bytesPerSecond);
  const tone = kind === 'observed' ? 'success' : kind === 'silent' ? 'warning' : 'subtle';
  return <span className={`inline-flex items-center gap-1.5 text-[11px] ${toneText(tone)}`}>
    <span className={`h-[6px] w-[6px] rounded-full ${TONE_DOT[tone]}`}/>
    {TRAFFIC_LABEL[kind]}
  </span>;
}

/* Monospace technical value: never clipped without the full value at hand. */
type TechnicalProps = { value?: unknown; className?: string; width?: string };
export function TechnicalValue({ value, className = '', width = 'max-w-[180px]' }: TechnicalProps) {
  const full = value == null || value === '' ? '—' : String(value);
  return <span title={full} className={`block truncate font-mono text-[11.5px] text-ink-2 ${width} ${className}`}>{full}</span>;
}

/* BPF filter: monospace on a light technical chip, full text in the tooltip. */
type BpfProps = { filter?: unknown; className?: string; width?: string };
export function BpfFilterDisplay({ filter, className = '', width = 'max-w-[200px]' }: BpfProps) {
  const full = filter == null || filter === '' ? '—' : String(filter);
  return <span title={full} className={`inline-block max-w-full truncate rounded-[3px] border border-border-subtle bg-surface-2 px-1.5 py-[2px] font-mono text-[11.5px] text-ink-2 ${width} ${className}`}>{full}</span>;
}

/* Numeric measure: tabular figures, missing stays a dash — never a zero. */
type MetricProps = { value?: unknown; suffix?: string; className?: string };
export function MetricValue({ value, suffix = '', className = '' }: MetricProps) {
  const known = value != null && value !== '' && Number.isFinite(Number(value));
  return <span className={`whitespace-nowrap font-mono text-[11.5px] tabular-nums ${known ? 'text-foreground' : 'text-faint'} ${className}`}>
    {known ? `${Number(value).toLocaleString('fr-FR')}${suffix}` : `—${suffix}`}
  </span>;
}

/*
 * 15-minute activity: thin line, fixed box, no gradient, no invented samples.
 * The baseline only appears when a real zero-valued sample exists.
 */
type SparkProps = { values?: readonly unknown[]; width?: number; height?: number };
export function ActivitySparkline({ values = [], width = 150, height = 34 }: SparkProps) {
  const samples = values.filter(v => v != null && Number.isFinite(Number(v))).map(Number);
  if (samples.length < 2) return <span className="inline-flex h-[34px] w-[150px] items-center rounded-[3px] border border-dashed border-border-subtle px-2 text-[11px] text-subtle">aucun échantillon</span>;
  const max = Math.max(...samples, 1);
  const points = samples.map((v, i) => `${(i / (samples.length - 1)) * width},${height - 2 - (v / max) * (height - 6)}`).join(' ');
  const zeroSeen = samples.some(v => v === 0);
  return <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="h-[34px] w-[150px]" role="img" aria-label="Débit des 15 dernières minutes">
    {zeroSeen && <line x1="0" x2={width} y1={height - 2} y2={height - 2} stroke="var(--border)"/>}
    <polyline points={points} fill="none" stroke="var(--app-accent-ink, var(--app-accent))" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>;
}
