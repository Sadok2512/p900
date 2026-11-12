import React, { useMemo } from 'react';
import { OtherSessions } from './SubscriberJourney';
import { toMs, steps, backgroundSteps, fmtSpan, overall, failures, sessionKpis, fmtDuration, fmtBytes, fmtRate, fmtUtc, timeOf } from './analysis';

export const VERDICT_STYLE = { SUCCESS:['#4ADE80','#0F2A20'], FAILED:['#F87171','#2E1518'], PARTIAL:['#F0B429','#2B2110'], UNKNOWN:['#8FA5BB','#16344F'] };
export const VerdictBadge = ({v}) => { const [c,b]=VERDICT_STYLE[v]||VERDICT_STYLE.UNKNOWN; return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-semibold tracking-[0.03em]" style={{color:c,background:b}}><span className="w-1.5 h-1.5 rounded-full" style={{background:c}}/>{v}</span>; };
const H = ({children}) => <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">{children}</div>;
const Row = ({k,v}) => <><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground truncate" title={String(v)}>{v}</dd></>;

export default function SessionAnalysis({s,width,onPick,onHide,loading,onOpenSession}) {
  const flow = s.d;
  const st = useMemo(()=>steps(flow),[flow]);
  const bg = useMemo(()=>backgroundSteps(flow),[flow]);
  const fails = useMemo(()=>failures(flow),[flow]);
  const k = useMemo(()=>sessionKpis(s,flow),[s,flow]);
  const res = overall(s.state ?? s.res, st);
  const bgIdx = new Set(bg.flatMap(x=>x.start<0?[]:Array.from({length:x.end-x.start+1},(_,j)=>x.start+j)));
  const times = (flow.evidence??[]).filter((_,j)=>!bgIdx.has(j)).map(timeOf).filter(x=>x!=null);
  const iso = ms => ms==null ? '—' : new Date(ms).toISOString().replace('T',' ').slice(0,23)+' UTC';
  const start = iso(toMs(s.start_timestamp) ?? (times.length ? Math.min(...times) : null));
  const end = iso(toMs(s.end_timestamp) ?? (times.length ? Math.max(...times) : null));
  const kpi = [['Durée session',fmtSpan(k.durationMs,k.multiCapture)],['Setup time',fmtDuration(k.setupMs)],['DL moyen',fmtRate(k.dlAvg)],['DL instantané',fmtRate(k.dlInst)],['DL max',fmtRate(k.dlMax)],['UL moyen',fmtRate(k.ulAvg)],['UL instantané',fmtRate(k.ulInst)],['UL max',fmtRate(k.ulMax)],['Volume DL',fmtBytes(k.dlVolume)],['Volume UL',fmtBytes(k.ulVolume)],['RTT',k.rttMs==null?'N/A':`${k.rttMs} ms`],['Retransmissions',k.retransmissions==null?'N/A':k.retransmissions],['Pertes',k.lossPct==null?'N/A':`${k.lossPct} %`]];
  return (
    <aside style={{width}} aria-label="Analyse sessions" className="shrink-0 bg-card flex flex-col min-w-0 rounded-xl border border-border overflow-hidden">
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-border">
        <span className="text-[13px] font-semibold text-foreground">Analyse sessions</span><VerdictBadge v={res}/>
        <button onClick={onHide} title="Masquer Analyse sessions" className="ml-auto w-7 h-7 rounded-md grid place-items-center text-muted-foreground hover:bg-muted">×</button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-3 space-y-4 text-[12px]">
        {loading && <div className="text-muted-foreground">Chargement des messages…</div>}
        <section><H>Synthèse</H>
          <dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-1">
            <Row k="Session ID" v={s.session_id ?? '—'}/><Row k="UE" v={!s.ue || /^unknown$/i.test(s.ue) ? '—' : s.ue}/><Row k="IMSI / SUPI" v="masqué"/><Row k="Technologie" v={s.rat ?? '—'}/>
            <Row k="Début" v={start}/><Row k="Fin" v={end}/><Row k="Durée" v={fmtSpan(k.durationMs,k.multiCapture)}/>
            <Row k="Cellule" v={s.cell ?? '—'}/><Row k="MME / AMF" v={s.serving_node ?? '—'}/><Row k="Procédure" v={s.proc ?? '—'}/>
          </dl>
        </section>
        <OtherSessions s={s} onOpen={onOpenSession}/>
        <section><H>Chronologie</H>
          {st.length===0 ? <div className="text-muted-foreground">Aucune étape observée.</div> : <ol className="space-y-1">{st.map((x,i)=>(
            <li key={i}><button disabled={x.start<0} onClick={()=>onPick(x.failIndex ?? x.start)} className="w-full text-left rounded-md border border-border px-2 py-1.5 hover:bg-surface-2">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:VERDICT_STYLE[x.result][0]}}/><span className="font-medium text-foreground truncate">{x.name}</span><span className="ml-auto"><VerdictBadge v={x.result}/></span></div>
              <div className="pl-3.5 mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtUtc(x.t0)} · {fmtSpan(x.durationMs,x.multiCapture)}{x.cause?<span className="text-danger"> · {x.cause}</span>:null}</div>
            </button></li>))}</ol>}
        </section>
        {bg.length>0 && <section><H>Arrière-plan</H>
          <div className="text-[11px] text-muted-foreground mb-1">Événements hors session, exclus du Début/Fin et de la durée.</div>
          <ol className="space-y-1">{bg.map((x,i)=><li key={i}><button disabled={x.start<0} onClick={()=>onPick(x.start)} className="w-full text-left rounded-md border border-dashed border-border px-2 py-1 hover:bg-surface-2 text-muted-foreground"><span className="font-medium">{x.name}</span><span className="ml-2 font-mono text-[11px]">{fmtUtc(x.t0)} · {x.end-x.start+1} msg</span></button></li>)}</ol>
        </section>}
        <section><H>Analyse des échecs</H>
          {fails.length===0 ? <div className="text-muted-foreground">Aucun échec prouvé par les messages.</div> : fails.map(f=>(
            <button key={f.index} onClick={()=>onPick(f.index)} className="w-full text-left rounded-md border border-danger-line bg-danger-soft/60 p-2 mb-1.5 hover:bg-danger-soft">
              <div className="font-medium text-danger">{f.procedure} · {f.message}</div>
              <dl className="mt-1 grid grid-cols-[82px_1fr] gap-x-2 text-[11px]"><Row k="Cause" v={f.cause}/><Row k="Cause brute" v={f.raw}/><Row k="Interface" v={f.interface}/><Row k="Entité" v={f.entity}/><Row k="Horodatage" v={fmtUtc(f.time)}/><Row k="Message" v={`#${f.index+1}`}/></dl>
            </button>))}
        </section>
        <section><H>KPI de session</H>
          <div className="grid grid-cols-2 gap-1.5">{kpi.map(([n,v])=><div key={n} className="rounded-md border border-border px-2 py-1.5"><div className="text-[11px] text-muted-foreground">{n}</div><div className={`tabular-nums font-semibold ${v==='N/A'?'text-subtle':'text-foreground'}`}>{v}</div></div>)}</div>
        </section>
      </div>
    </aside>
  );
}
