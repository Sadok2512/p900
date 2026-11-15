import { describe, expect, it } from 'vitest';
import {
  buildE2EChain,
  formatChainLabel,
  isObservedStatus,
  isProvenStatus,
} from './e2e-chain';

describe('e2e-chain — buildE2EChain', () => {
  it('data-plane complet prouvé → overall STRONG, IMS non observé', () => {
    const chain = buildE2EChain({
      N2_SBI: 'STRONG',
      SBI_N4: 'STRONG',
      N4_N3: 'EXACT',
      N4_IMS: 'UNKNOWN',
      IMS_RTP: 'UNKNOWN',
      E2E: 'STRONG',
    });
    expect(chain.overall).toBe('STRONG');
    expect(chain.imsObserved).toBe(false);
    expect(chain.hops).toHaveLength(3);
    expect(chain.hops.map((h) => `${h.from}->${h.to}`)).toEqual([
      'N2->SBI',
      'SBI->N4',
      'N4->N3',
    ]);
  });

  it('IMS observé → 5 hops (data-plane + IMS)', () => {
    const chain = buildE2EChain({
      N2_SBI: 'STRONG',
      SBI_N4: 'STRONG',
      N4_N3: 'EXACT',
      N4_IMS: 'EXACT',
      IMS_RTP: 'EXACT',
      E2E: 'STRONG',
    });
    expect(chain.imsObserved).toBe(true);
    expect(chain.hops).toHaveLength(5);
    expect(chain.hops.map((h) => `${h.from}->${h.to}`)).toEqual([
      'N2->SBI',
      'SBI->N4',
      'N4->N3',
      'N4->IMS',
      'IMS->RTP',
    ]);
  });

  it('un hop OPEN → overall OPEN (dérivé si back ne fournit pas E2E)', () => {
    const chain = buildE2EChain({
      N2_SBI: 'STRONG',
      SBI_N4: 'OUVERT',
      N4_N3: 'UNKNOWN',
    });
    expect(chain.overall).toBe('OPEN');
  });

  it('IMS observé avec data-plane manquant → overall OPEN', () => {
    const chain = buildE2EChain({
      N4_IMS: 'EXACT',
    });
    expect(chain.overall).toBe('OPEN');
    expect(chain.imsObserved).toBe(true);
  });

  it('aucune jonction observée → overall UNKNOWN', () => {
    const chain = buildE2EChain({});
    expect(chain.overall).toBe('UNKNOWN');
    expect(chain.imsObserved).toBe(false);
    expect(chain.hops).toHaveLength(3);
    expect(chain.hops.every((h) => h.status === 'UNKNOWN')).toBe(true);
  });

  it('respecte le E2E fourni par le back sans le re-dériver', () => {
    const chain = buildE2EChain({
      N2_SBI: 'UNKNOWN',
      SBI_N4: 'UNKNOWN',
      N4_N3: 'UNKNOWN',
      E2E: 'STRONG',
    });
    // Même si tous les hops sont UNKNOWN localement, si le back
    // dit STRONG on respecte.
    expect(chain.overall).toBe('STRONG');
  });

  it('entrée invalide (null / string) → chaîne vide UNKNOWN', () => {
    const fromNull = buildE2EChain(null);
    expect(fromNull.overall).toBe('UNKNOWN');
    expect(fromNull.hops).toHaveLength(3);
    const fromString = buildE2EChain('UNKNOWN');
    expect(fromString.overall).toBe('UNKNOWN');
    expect(fromString.hops).toHaveLength(3);
  });
});

describe('e2e-chain — isObservedStatus / isProvenStatus', () => {
  it('EXACT et STRONG sont prouvés', () => {
    expect(isProvenStatus('EXACT')).toBe(true);
    expect(isProvenStatus('STRONG')).toBe(true);
    expect(isProvenStatus('OPEN')).toBe(false);
    expect(isProvenStatus('UNKNOWN')).toBe(false);
  });

  it('observed ≠ UNKNOWN et ≠ null', () => {
    expect(isObservedStatus('EXACT')).toBe(true);
    expect(isObservedStatus('OPEN')).toBe(true);
    expect(isObservedStatus('UNKNOWN')).toBe(false);
    expect(isObservedStatus(null)).toBe(false);
    expect(isObservedStatus('')).toBe(false);
  });
});

describe('e2e-chain — formatChainLabel', () => {
  it('rend la séquence des nœuds', () => {
    const chain = buildE2EChain({
      N2_SBI: 'STRONG',
      SBI_N4: 'STRONG',
      N4_N3: 'EXACT',
      N4_IMS: 'EXACT',
      IMS_RTP: 'EXACT',
    });
    expect(formatChainLabel(chain)).toBe('N2 → SBI → N4 → N3 → IMS → RTP');
  });

  it('chaîne vide → fallback data-plane', () => {
    const chain = { hops: [], overall: 'UNKNOWN', imsObserved: false };
    expect(formatChainLabel(chain)).toBe('N2 → SBI → N4 → N3');
  });
});
