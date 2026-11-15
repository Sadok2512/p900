// 2.6.0 (ANR1 #10 E2E-5G) — helpers pour rendre la « Chaîne E2E »
// N2 → SBI → N4 → N3 (→ IMS) à partir de la map `correlation_status`
// exposée par oiran-api 2.17.0 dans `/sessions/:id` et
// `/sessions/:id/callflow`. Pure, aucun import React.

export type CorrelationStatusValue =
  | string
  | undefined
  | null;

export type CorrelationStatusMap = Record<string, CorrelationStatusValue>;

export interface E2EHop {
  from: string;
  to: string;
  statusKey: string;
  status: string;
}

export interface E2EChain {
  hops: E2EHop[];
  overall: string;
  imsObserved: boolean;
}

const DATA_PLANE_HOPS: Array<{ from: string; to: string; key: string }> = [
  { from: 'N2', to: 'SBI', key: 'N2_SBI' },
  { from: 'SBI', to: 'N4', key: 'SBI_N4' },
  { from: 'N4', to: 'N3', key: 'N4_N3' },
];

const IMS_HOPS: Array<{ from: string; to: string; key: string }> = [
  { from: 'N4', to: 'IMS', key: 'N4_IMS' },
  { from: 'IMS', to: 'RTP', key: 'IMS_RTP' },
];

function statusAt(
  map: CorrelationStatusMap,
  key: string,
): string {
  const v = map[key];
  if (typeof v === 'string' && v.length > 0) return v;
  return 'UNKNOWN';
}

// Un hop est « observé » quand son statut n'est ni null ni UNKNOWN.
export function isObservedStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return normalized !== 'UNKNOWN' && normalized !== '';
}

// Un hop est « prouvé » quand son statut est EXACT ou STRONG.
export function isProvenStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return normalized === 'EXACT' || normalized === 'STRONG';
}

export function buildE2EChain(
  rawStatus: unknown,
): E2EChain {
  const map: CorrelationStatusMap =
    rawStatus && typeof rawStatus === 'object' && !Array.isArray(rawStatus)
      ? (rawStatus as CorrelationStatusMap)
      : {};
  const dataHops: E2EHop[] = DATA_PLANE_HOPS.map(({ from, to, key }) => ({
    from,
    to,
    statusKey: key,
    status: statusAt(map, key),
  }));
  const imsObserved =
    isObservedStatus(statusAt(map, 'N4_IMS')) ||
    isObservedStatus(statusAt(map, 'IMS_RTP'));
  const imsHops: E2EHop[] = imsObserved
    ? IMS_HOPS.map(({ from, to, key }) => ({
        from,
        to,
        statusKey: key,
        status: statusAt(map, key),
      }))
    : [];
  const providedE2E = map['E2E'];
  const overall =
    typeof providedE2E === 'string' && providedE2E.length > 0
      ? providedE2E
      : // Si le back n'a pas (encore) écrit E2E, on dérive localement :
        // STRONG si data-plane complet, OPEN si une jonction observée,
        // UNKNOWN sinon. Même règle que callflow-schema::build_callflow.
        dataHops.every((hop) => isProvenStatus(hop.status))
        ? 'STRONG'
        : dataHops.some((hop) => isObservedStatus(hop.status)) || imsObserved
          ? 'OPEN'
          : 'UNKNOWN';
  return {
    hops: [...dataHops, ...imsHops],
    overall,
    imsObserved,
  };
}

// Variante utilisée pour l'affichage compact : « N2 → SBI → N4 → N3 »
// (+ « → IMS → RTP » si observé), avec un badge statut par flèche.
export function formatChainLabel(chain: E2EChain): string {
  const first = chain.hops[0];
  if (!first) return 'N2 → SBI → N4 → N3';
  const nodes = [first.from, ...chain.hops.map((h) => h.to)];
  return nodes.join(' → ');
}
