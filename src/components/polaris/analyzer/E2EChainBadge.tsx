// @ts-nocheck
// 2.6.0 (ANR1 #10 E2E-5G) — Composant « Chaîne E2E » compact.
// Rend N2 → SBI → N4 → N3 (+ IMS → RTP si observé) à partir de la
// map `correlation_status` (object) produite par oiran-api 2.17.0.
// Compatible back-compat : si `correlation_status` est une string
// (versions oiran-api ≤ 2.16.0) ou absent, le composant rend un
// placeholder discret sans erreur.

import React from 'react';
import { buildE2EChain, isProvenStatus } from '@/lib/polaris-api/e2e-chain';

const STAT_COLOR = {
  EXACT: '#15803D',
  STRONG: '#15803D',
  OUVERT: '#A15C07',
  OPEN: '#A15C07',
  POSSIBLE: '#A15C07',
  UNKNOWN: '#8F8F8F',
  WEAK: '#B42318',
  MISSING: '#B42318',
};

function Arrow({ status }) {
  const color = STAT_COLOR[status?.toUpperCase?.() ?? ''] || STAT_COLOR.UNKNOWN;
  const proven = isProvenStatus(status);
  return (
    <span
      className="inline-flex flex-col items-center min-w-[70px] px-1"
      aria-label={`status ${status ?? 'UNKNOWN'}`}
    >
      <span
        className="font-mono text-[10px] font-semibold tracking-wider uppercase"
        style={{ color }}
      >
        {status ?? 'UNKNOWN'}
      </span>
      <span className="flex items-center" style={{ color }}>
        <span className="h-[2px] w-full min-w-[40px]" style={{ background: color, opacity: proven ? 1 : 0.5 }} />
        <span className="ml-[-1px]" style={{ borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `7px solid ${color}`, opacity: proven ? 1 : 0.5 }} />
      </span>
    </span>
  );
}

function Node({ label }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[40px] h-6 px-2 rounded border border-border bg-surface-2 text-[11.5px] font-semibold text-foreground">
      {label}
    </span>
  );
}

export default function E2EChainBadge({ correlationStatus, title }) {
  // Support back-compat : si `correlation_status` est string (ex.
  // "UNKNOWN" sur oiran-api ≤ 2.16.0 ou sur une session sans
  // multi-plane), on affiche juste la valeur dans un badge.
  if (typeof correlationStatus === 'string') {
    return (
      <div className="inline-flex items-center gap-2 text-[12px]">
        {title && <span className="text-muted-foreground">{title}</span>}
        <span
          className="font-mono text-[11px] font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px]"
          style={{ color: STAT_COLOR[correlationStatus.toUpperCase?.()] || STAT_COLOR.UNKNOWN }}
        >
          {correlationStatus}
        </span>
      </div>
    );
  }
  if (!correlationStatus || typeof correlationStatus !== 'object') {
    return null;
  }
  const chain = buildE2EChain(correlationStatus);
  const overallColor = STAT_COLOR[chain.overall?.toUpperCase?.() ?? ''] || STAT_COLOR.UNKNOWN;
  const nodes = [chain.hops[0]?.from ?? 'N2', ...chain.hops.map((h) => h.to)];
  return (
    <div className="inline-flex flex-col gap-1.5 bg-white border border-border rounded-md px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title ?? 'Chaîne E2E 5G'}
        </span>
        <span
          className="text-[11px] font-mono font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px]"
          style={{ color: overallColor }}
          aria-label={`e2e-overall-${chain.overall}`}
        >
          {chain.overall}
        </span>
      </div>
      <div className="flex items-center flex-wrap gap-0">
        {nodes.map((node, index) => {
          const hop = chain.hops[index];
          return (
            <React.Fragment key={`${node}-${index}`}>
              <Node label={node} />
              {hop && <Arrow status={hop.status} />}
            </React.Fragment>
          );
        })}
      </div>
      {!chain.imsObserved && (
        <div className="text-[11px] text-subtle">
          IMS non observé (ajout 2.17.0 — N4↔IMS/IMS↔RTP en attente de captures).
        </div>
      )}
    </div>
  );
}
