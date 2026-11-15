// 2.5.0 (ANR1 #10 Live-IMSI) — purs helpers pour l'onglet Live. Extraits
// de LiveModule.tsx pour être testables sans monter React. Aucune
// identité en clair n'est loguée depuis ces helpers (c'est le contrat
// règle Sadok 2026-11-14 : clair-text IMSI reste dans l'UI auth, jamais
// dans GitHub/logs).

export const LIVE_BUFFER_MAX = 2000;

export type LiveKeyType =
  | 'pseudonym'
  | 'imsi'
  | 'tmsi'
  | 's_tmsi'
  | 'm_tmsi'
  | 'imei'
  | 'msisdn';

export type ValidateResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

// TS 24.301 / 24.501 : IMSI = MCC (3 chiffres) + MNC (2 ou 3 chiffres) +
// MSIN (9 ou 10 chiffres), total 14 ou 15 chiffres. On tolère un préfixe
// "imsi-" déjà présent (3GPP TS 29.571 §2.1.3.2.2) et on strip tout
// espace.
const IMSI_DIGITS_RE = /^\d{14,15}$/;
// MSISDN = E.164, 1..15 chiffres, préfixe "+" optionnel.
const MSISDN_RE = /^\+?\d{1,15}$/;
// IMEI = 15 chiffres, IMEISV = 16 chiffres.
const IMEI_RE = /^\d{15,16}$/;
// TMSI / M-TMSI / S-TMSI : 32-bit identifier représenté soit en 8 hex,
// soit en décimal jusqu'à 10 chiffres. S-TMSI inclut parfois le MMEC
// (xx-xx-xxxxxxxx).
const TMSI_HEX_RE = /^0?[xX]?[0-9A-Fa-f]{8}$/;
const TMSI_DEC_RE = /^\d{1,10}$/;
const S_TMSI_LONG_RE = /^[0-9A-Fa-f-]{10,}$/;
// Pseudonyme UE court : ue-xxxx (4 hex).
const PSEUDONYM_RE = /^ue-[0-9a-fA-F]{4}$/;

export function validateLiveIdentity(
  keyType: LiveKeyType,
  raw: string,
): ValidateResult {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, reason: 'Identifiant requis.' };
  }
  switch (keyType) {
    case 'pseudonym':
      if (!PSEUDONYM_RE.test(value)) {
        return { ok: false, reason: 'Format pseudonyme : ue-xxxx (4 hex).' };
      }
      return { ok: true, normalized: value.toLowerCase() };
    case 'imsi': {
      const digits = value.replace(/^imsi-/i, '').replace(/\s+/g, '');
      if (!IMSI_DIGITS_RE.test(digits)) {
        return {
          ok: false,
          reason: 'IMSI invalide — 14 ou 15 chiffres (MCC+MNC+MSIN).',
        };
      }
      return { ok: true, normalized: digits };
    }
    case 'msisdn': {
      const digits = value.replace(/\s+/g, '');
      if (!MSISDN_RE.test(digits)) {
        return { ok: false, reason: 'MSISDN invalide — format E.164.' };
      }
      return { ok: true, normalized: digits.replace(/^\+/, '') };
    }
    case 'imei': {
      const digits = value.replace(/\s+/g, '');
      if (!IMEI_RE.test(digits)) {
        return { ok: false, reason: 'IMEI invalide — 15 ou 16 chiffres.' };
      }
      return { ok: true, normalized: digits };
    }
    case 'tmsi':
    case 'm_tmsi': {
      const normalized = value.replace(/\s+/g, '');
      if (!TMSI_HEX_RE.test(normalized) && !TMSI_DEC_RE.test(normalized)) {
        return {
          ok: false,
          reason: 'TMSI invalide — 8 chiffres hex ou décimal 32 bits.',
        };
      }
      return { ok: true, normalized };
    }
    case 's_tmsi': {
      const normalized = value.replace(/\s+/g, '');
      if (!S_TMSI_LONG_RE.test(normalized) && !TMSI_HEX_RE.test(normalized)) {
        return {
          ok: false,
          reason: 'S-TMSI invalide — MMEC-M-TMSI ou 8 chiffres hex.',
        };
      }
      return { ok: true, normalized };
    }
    default:
      return { ok: false, reason: 'Type d\'identifiant non géré.' };
  }
}

export interface ExistingTrace {
  trace_id: string;
  key_type: string;
  subscriber_pseudonyms?: string[];
  armed?: boolean;
}

// Anti-doublon : si une trace active correspond déjà au même
// (key_type, pseudonyme), on la réutilise plutôt que de pousser une
// deuxième trace sur le même UE (le back refuse après MAX_TRACES=10,
// mais on veut un no-op idempotent côté UI).
export function findExistingTrace(
  existing: ExistingTrace[],
  keyType: LiveKeyType,
  expectedPseudonym: string | null,
): ExistingTrace | null {
  if (!expectedPseudonym) {
    // Pour une recherche directe par pseudonyme, on compare aussi par
    // value brute (key_type=pseudonym).
    return null;
  }
  for (const trace of existing) {
    if (trace.key_type !== keyType && trace.key_type !== 'pseudonym') {
      continue;
    }
    const pseudos = trace.subscriber_pseudonyms ?? [];
    if (pseudos.some((p) => p === expectedPseudonym)) {
      return trace;
    }
  }
  return null;
}

export interface CorrelatedSession {
  session_id: string;
  dataset_id?: string;
  technology?: string;
  source?: string;
}

export interface OpenSessionContext {
  page: 'sessions';
  sessionId: string | null;
  captureId: string | null;
  seq: number | null;
}

// Construit l'intent "ouvrir la session dans l'Analyzer" à partir
// (dans l'ordre) du contexte de l'event sélectionné (capture_id, seq)
// puis de la liste des sessions corrélées par /live/traces/:id/sessions.
// On préfère la source `flows` (session published) à la source
// `capture_manager` (live dataset). Pas de session trouvée → sessionId
// null : le front conserve l'ouverture nue de l'Analyzer (fallback
// comportement 2.4.4).
export function buildOpenSessionContext(
  selected: { cap?: string; seq?: number } | null,
  correlated: CorrelatedSession[],
): OpenSessionContext {
  const captureId = selected?.cap ?? null;
  const seq = typeof selected?.seq === 'number' ? selected.seq : null;
  const preferred =
    correlated.find((s) => s.source === 'flows') ??
    correlated.find((s) => s.source === 'capture_manager') ??
    correlated[0];
  return {
    page: 'sessions',
    sessionId: preferred?.session_id ?? null,
    captureId,
    seq,
  };
}

// Sérialise le contexte en query hash lisible par l'Analyzer, sans
// fuiter d'IMSI ni de pseudonyme (uniquement session_id + capture + seq).
export function encodeSessionHashContext(ctx: OpenSessionContext): string {
  const params = new URLSearchParams();
  if (ctx.sessionId) params.set('session', ctx.sessionId);
  if (ctx.captureId) params.set('capture', ctx.captureId);
  if (ctx.seq != null) params.set('seq', String(ctx.seq));
  const query = params.toString();
  return query ? `${ctx.page}?${query}` : ctx.page;
}

// Clé sessionStorage où l'onglet Live dépose le contexte avant de
// basculer sur l'onglet Analyzer. L'Analyzer (hors périmètre Live
// 2.5.0) peut y lire le session_id + capture_id + seq à focaliser.
// Convention : effacé par le consommateur après lecture.
export const OPEN_SESSION_CONTEXT_STORAGE_KEY =
  'polaris-live-open-session-context';

export function persistOpenSessionContext(ctx: OpenSessionContext): void {
  try {
    const serialized = JSON.stringify(ctx);
    sessionStorage.setItem(OPEN_SESSION_CONTEXT_STORAGE_KEY, serialized);
  } catch {
    /* non-bloquant : sessionStorage peut être indisponible */
  }
}

export function readOpenSessionContext(): OpenSessionContext | null {
  try {
    const raw = sessionStorage.getItem(OPEN_SESSION_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpenSessionContext;
    if (parsed && parsed.page === 'sessions') return parsed;
    return null;
  } catch {
    return null;
  }
}
