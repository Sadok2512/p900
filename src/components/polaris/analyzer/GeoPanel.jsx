import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { extractGeo, radioContext } from './geo';

const GeoMap = lazy(() => import('./GeoMap'));
const KIND_L = { 'ue-actual': 'Position UE réelle', 'ue-estimated': 'Position UE estimée', cell: 'Site de la cellule' };
const Row = ({ k, v }) => <div className="flex justify-between gap-3 py-[3px] text-[12px]"><span className="text-muted-foreground">{k}</span><span className="font-mono text-foreground text-right truncate">{v ?? '—'}</span></div>;
const H = ({ children }) => <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1">{children}</div>;

export default function GeoPanel({ s, msg, setMsg, onHide, max, setMax }) {
  const [theme, setTheme] = useState('light'); const [hydrated, setHydrated] = useState(false); const [picked, setPicked] = useState(null);
  const [layers, setLayers] = useState({ cell: true, ue: true, traj: true });
  useEffect(() => setHydrated(true), []);
  const events = s?.d?.evidence ?? [];
  const geo = useMemo(() => extractGeo(s, events), [s, events]);
  const ev = events[msg];
  const radio = useMemo(() => { const r = radioContext(ev); const b = radioContext(s ? { ...s, d: undefined } : null); return Object.fromEntries(Object.keys(r).map(k => [k, r[k] ?? b[k]])); }, [ev, s]);
  const shown = geo.points.filter(p => (p.kind === 'cell' ? layers.cell : layers.ue));
  const msgPoints = geo.points.filter(p => p.eventIndex === msg);
  const current = picked ?? msgPoints.find(p => p.kind !== 'cell') ?? msgPoints[0] ?? geo.points.find(p => p.kind === 'ue-actual') ?? geo.points.find(p => p.kind === 'cell' && p.serving) ?? null;
  const activeCell = radio.cellId ?? geo.points.find(p => p.kind === 'cell' && p.serving)?.cellId ?? null;
  useEffect(() => setPicked(null), [s?.id, msg]);
  const btn = 'h-7 px-2 rounded-md text-[12px] border border-border hover:bg-muted';
  return <div className="flex flex-col h-full min-h-0">
    <div className="h-[42px] shrink-0 px-3 flex items-center gap-1.5 border-b border-border">
      <span className="text-[13px] font-semibold text-foreground mr-auto">Geolocating</span>
      <div role="group" aria-label="Style de carte" className="flex rounded-md border border-border overflow-hidden">{[['light', 'Clair'], ['dark', 'Sombre'], ['osm', 'OpenStreetMap']].map(([k, l]) => <button key={k} onClick={() => setTheme(k)} aria-pressed={theme === k} className={`h-7 px-2 text-[12px] ${theme === k ? 'bg-brand-soft text-[var(--app-accent)]' : 'hover:bg-muted'}`}>{l}</button>)}</div>
      <button onClick={() => setMax(!max)} className={btn} title={max ? 'Restaurer' : 'Agrandir la carte'}>{max ? 'Restaurer' : 'Agrandir'}</button>
      <button onClick={onHide} title="Masquer Geolocating" className="w-7 h-7 rounded-md grid place-items-center text-muted-foreground hover:bg-muted">×</button>
    </div>
    <div className="px-3 py-1.5 flex items-center gap-3 border-b border-border text-[11.5px] text-muted-foreground flex-wrap">
      {[['cell', 'Cellules'], ['ue', 'UE'], ['traj', 'Trajectoire']].map(([k, l]) => <label key={k} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={layers[k]} onChange={e => setLayers({ ...layers, [k]: e.target.checked })} />{l}</label>)}
      <span className="ml-auto flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rotate-45 rounded-[2px]" style={{ background: '#2563EB' }} />NR<i className="inline-block w-2.5 h-2.5 rotate-45 rounded-[2px]" style={{ background: '#16A34A' }} />LTE<i className="inline-block w-2.5 h-2.5 rounded-full bg-foreground" />UE réelle<i className="inline-block w-2.5 h-2.5 rounded-full border border-dashed border-foreground" />UE estimée</span>
    </div>
    <div className="relative flex-1 min-h-[220px] bg-surface-2">
      {hydrated && geo.points.length > 0 && <Suspense fallback={null}><GeoMap points={shown} trajectory={layers.traj ? geo.trajectory : []} theme={theme} activeCell={activeCell} onPick={p => { setPicked(p); if (p.eventIndex != null) setMsg(p.eventIndex); }} /></Suspense>}
      {!s ? <Empty t="Sélectionnez une session" d="La carte suit la session et le message sélectionnés." /> : geo.points.length === 0 && <Empty t="Aucune donnée géographique" d="Cette session ne contient ni coordonnées de cellule ni position UE. Aucune position n'est déduite (Timing Advance, mesures radio)." />}
    </div>
    <div className="shrink-0 max-h-[45%] overflow-auto scroll-thin border-t border-border px-3 py-2 space-y-2">
      <section><H>Contexte session</H>
        <Row k="UE" v={s?.ue} /><Row k="RAT" v={s?.rat === '5G' ? 'NR' : s?.rat === '4G' ? 'LTE' : s?.rat} />
        <Row k="Cellule servante" v={radio.cellId} /><Row k="PCI" v={radio.pci} /><Row k="EARFCN / NR-ARFCN" v={radio.arfcn} /><Row k="TAC" v={radio.tac} /><Row k="eNB / gNB" v={radio.node} /><Row k="Timing Advance" v={radio.timingAdvance} />
      </section>
      <section><H>Message sélectionné {ev ? `#${msg + 1}` : ''}</H>
        <Row k="Message" v={ev?.message_name} /><Row k="Horodatage" v={ev?.timestamp ?? current?.timestamp} />
        {current ? <><Row k="Type de position" v={KIND_L[current.kind]} /><Row k="Coordonnées" v={`${current.lat.toFixed(5)}, ${current.lon.toFixed(5)}`} /><Row k="Source" v={current.source} /><Row k="Précision" v={current.accuracy_m != null ? `± ${current.accuracy_m} m` : null} />
          {current.kind === 'cell' && <p className="text-[11px] text-warning mt-1">Position du site radio — ce n'est pas la position de l'UE.</p>}
          {current.eventIndex != null && current.eventIndex !== msg && <button onClick={() => setMsg(current.eventIndex)} className={`${btn} mt-1`}>Aller au message #{current.eventIndex + 1}</button>}</>
          : <p className="text-[11.5px] text-subtle">Pas de position pour ce message.</p>}
      </section>
    </div>
  </div>;
}
const Empty = ({ t, d }) => <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><div className="mx-auto mb-2 w-9 h-9 rounded-full bg-muted grid place-items-center text-muted-foreground"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg></div><div className="text-[13px] font-medium text-foreground">{t}</div><div className="text-[12px] text-muted-foreground max-w-[280px] mt-1">{d}</div></div></div>;
