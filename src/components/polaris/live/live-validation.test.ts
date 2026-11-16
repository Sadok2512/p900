import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LIVE_BUFFER_MAX,
  LIVE_ACTIVE_WINDOW_MS,
  OPEN_SESSION_CONTEXT_STORAGE_KEY,
  buildOpenSessionContext,
  encodeSessionHashContext,
  findExistingTrace,
  liveTraceUiState,
  persistOpenSessionContext,
  readOpenSessionContext,
  validateLiveIdentity,
} from './live-validation';

describe('live-validation — état de trace SSE', () => {
  const now = 100_000;

  it('ARRÊTÉE si aucun job Live n\'est démarré', () => {
    expect(liveTraceUiState({ jobStarted: false, reconnecting: false, lastEventAt: now, now })).toBe('ARRÊTÉE');
  });

  it('ARMÉE sans événement reçu dans les 30 dernières secondes', () => {
    expect(liveTraceUiState({ jobStarted: true, reconnecting: false, lastEventAt: null, now })).toBe('ARMÉE');
    expect(liveTraceUiState({ jobStarted: true, reconnecting: false, lastEventAt: now - LIVE_ACTIVE_WINDOW_MS - 1, now })).toBe('ARMÉE');
  });

  it('ACTIVE dès qu\'un événement réel a été reçu depuis 30 secondes au plus', () => {
    expect(liveTraceUiState({ jobStarted: true, reconnecting: false, lastEventAt: now - LIVE_ACTIVE_WINDOW_MS, now })).toBe('ACTIVE');
  });

  it('COUPÉE pendant la reconnexion, même si un événement est encore récent', () => {
    expect(liveTraceUiState({ jobStarted: true, reconnecting: true, lastEventAt: now, now })).toBe('COUPÉE');
  });
});

describe('live-validation — validateLiveIdentity', () => {
  it('IMSI 15 chiffres valide → normalise sans préfixe', () => {
    const r = validateLiveIdentity('imsi', 'imsi-001010123456789');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalized).toBe('001010123456789');
      expect(r.normalized).toHaveLength(15);
    }
  });

  it('IMSI 14 chiffres (MCC+MNC2+MSIN9) valide', () => {
    const r = validateLiveIdentity('imsi', '20801234567890');
    expect(r.ok).toBe(true);
  });

  it('IMSI 13 chiffres (trop court) rejeté', () => {
    const r = validateLiveIdentity('imsi', '2080123456789');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/IMSI invalide/);
    }
  });

  it('IMSI vide rejeté', () => {
    expect(validateLiveIdentity('imsi', '')).toEqual({
      ok: false,
      reason: 'Identifiant requis.',
    });
  });

  it('IMSI avec lettres rejeté', () => {
    const r = validateLiveIdentity('imsi', '20801234567890X');
    expect(r.ok).toBe(false);
  });

  it('IMSI accepte les espaces et strip', () => {
    const r = validateLiveIdentity('imsi', '208 01 234 567 890');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe('20801234567890');
  });

  it('IMEI 15 chiffres valide', () => {
    expect(validateLiveIdentity('imei', '490154203237518').ok).toBe(true);
  });

  it('IMEISV 16 chiffres valide', () => {
    expect(validateLiveIdentity('imei', '4901542032375180').ok).toBe(true);
  });

  it('MSISDN E.164 avec + valide et strip le préfixe', () => {
    const r = validateLiveIdentity('msisdn', '+33612345678');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe('33612345678');
  });

  it('Pseudonyme ue-xxxx valide', () => {
    expect(validateLiveIdentity('pseudonym', 'ue-7f3a').ok).toBe(true);
  });

  it('Pseudonyme ue-XYZ hors format rejeté', () => {
    expect(validateLiveIdentity('pseudonym', 'ue-xyz').ok).toBe(false);
  });

  it('M-TMSI 8 hex valide', () => {
    expect(validateLiveIdentity('m_tmsi', '0A7E91F0').ok).toBe(true);
  });

  it('M-TMSI 0x prefixé valide', () => {
    expect(validateLiveIdentity('m_tmsi', '0x0A7E91F0').ok).toBe(true);
  });
});

describe('live-validation — findExistingTrace (anti-doublon)', () => {
  const existing = [
    {
      trace_id: 'trace-aaaa1111',
      key_type: 'imsi',
      subscriber_pseudonyms: ['psn-user-a'],
    },
    {
      trace_id: 'trace-bbbb2222',
      key_type: 'pseudonym',
      subscriber_pseudonyms: ['psn-user-b'],
    },
  ];

  it('match sur même key_type et pseudonyme → doublon', () => {
    const dup = findExistingTrace(existing, 'imsi', 'psn-user-a');
    expect(dup?.trace_id).toBe('trace-aaaa1111');
  });

  it('match sur pseudonyme via trace key_type=pseudonym → doublon aussi', () => {
    const dup = findExistingTrace(existing, 'imsi', 'psn-user-b');
    expect(dup?.trace_id).toBe('trace-bbbb2222');
  });

  it('pseudonyme inconnu → pas de doublon', () => {
    expect(findExistingTrace(existing, 'imsi', 'psn-unknown')).toBeNull();
  });

  it('pseudonyme null → pas de doublon', () => {
    expect(findExistingTrace(existing, 'imsi', null)).toBeNull();
  });
});

describe('live-validation — buildOpenSessionContext (lien enrichi)', () => {
  it('session_id capture seq complets → context plein', () => {
    const ctx = buildOpenSessionContext(
      { cap: 'sha256:abc', seq: 42 },
      [
        {
          session_id: 'sess-1',
          source: 'flows',
          technology: '5G SA',
        },
      ],
    );
    expect(ctx).toEqual({
      page: 'sessions',
      sessionId: 'sess-1',
      captureId: 'sha256:abc',
      seq: 42,
    });
  });

  it('préfère flows à capture_manager', () => {
    const ctx = buildOpenSessionContext(null, [
      { session_id: 'live-1', source: 'capture_manager' },
      { session_id: 'flow-1', source: 'flows' },
    ]);
    expect(ctx.sessionId).toBe('flow-1');
  });

  it('aucune session corrélée → sessionId null, fallback nue', () => {
    const ctx = buildOpenSessionContext(null, []);
    expect(ctx.sessionId).toBeNull();
    expect(ctx.page).toBe('sessions');
  });
});

describe('live-validation — encodeSessionHashContext', () => {
  it('encode session + capture + seq en query-hash stable', () => {
    const hash = encodeSessionHashContext({
      page: 'sessions',
      sessionId: 'sess-1',
      captureId: 'sha256:abc',
      seq: 42,
    });
    expect(hash).toMatch(/^sessions\?/);
    expect(hash).toContain('session=sess-1');
    expect(hash).toContain('capture=sha256%3Aabc');
    expect(hash).toContain('seq=42');
  });

  it('page nue si contexte vide', () => {
    const hash = encodeSessionHashContext({
      page: 'sessions',
      sessionId: null,
      captureId: null,
      seq: null,
    });
    expect(hash).toBe('sessions');
  });
});

describe('live-validation — persistOpenSessionContext/readOpenSessionContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it('round-trip persist/read', () => {
    const ctx = {
      page: 'sessions' as const,
      sessionId: 'sess-abc',
      captureId: 'sha256:cap',
      seq: 7,
    };
    persistOpenSessionContext(ctx);
    expect(sessionStorage.getItem(OPEN_SESSION_CONTEXT_STORAGE_KEY)).not.toBeNull();
    const read = readOpenSessionContext();
    expect(read).toEqual(ctx);
  });

  it('read sans context → null', () => {
    expect(readOpenSessionContext()).toBeNull();
  });

  it('read context corrompu → null (ne throw pas)', () => {
    sessionStorage.setItem(OPEN_SESSION_CONTEXT_STORAGE_KEY, '{not-json');
    expect(readOpenSessionContext()).toBeNull();
  });
});

describe('live-validation — LIVE_BUFFER_MAX', () => {
  it('constante exposée explicitement = 2000 (parité back MAX_EVENTS)', () => {
    expect(LIVE_BUFFER_MAX).toBe(2000);
  });
});
