import type { IdentityProof, SessionIdentities } from './types';

const text = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() ? value : null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'value' in value) return text((value as { value?: unknown }).value);
  return null;
};

const latest = (value: unknown): unknown => Array.isArray(value) ? value.at(-1) : value;

export type IdentityKind = 'subscriber' | 'temporary' | 's_tmsi' | 'm_tmsi' | 'equipment' | 'directory';

const aliases: Record<IdentityKind, string[]> = {
  subscriber: ['imsi', 'supi'],
  temporary: ['tmsi', 'guti', 'five_g_guti', 'fiveGguti'],
  s_tmsi: ['s_tmsi', 'stmsi', 'five_g_s_tmsi'],
  m_tmsi: ['m_tmsi', 'mtmsi', 'five_g_m_tmsi'],
  equipment: ['imei', 'imeisv', 'pei'],
  directory: ['msisdn', 'gpsi'],
};

export function identityValue(identities: SessionIdentities | Record<string, unknown> | null | undefined, kind: IdentityKind): string | null {
  if (!identities) return null;
  for (const key of aliases[kind]) {
    const value=text(latest(identities[key]));
    if (value) return value;
  }
  return null;
}

export function identityProofs(identities: SessionIdentities | undefined, kind: IdentityKind): IdentityProof[] {
  if (!identities) return [];
  for (const key of aliases[kind]) {
    const value=identities[key];
    if (Array.isArray(value)) return value.filter(item=>item && typeof item==='object') as IdentityProof[];
    if (value && typeof value==='object') return [value as IdentityProof];
  }
  return [];
}

export const observedIdentity = (identities: SessionIdentities | Record<string, unknown> | null | undefined, kind: IdentityKind) => identityValue(identities,kind) ?? 'non observé';
