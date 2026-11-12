import React, { useMemo, useState } from 'react';
import { useSubscriberJourney, useSubscriberTmsi, useSessionIdentities, useIdentityLookup, apiPath, observedIdentity, identityProofs } from '@/lib/polaris-api';
import { toJourney, toTmsiList, shortPseudo, refLabel } from './subscriber';

// Procedure colours (light mode only).
export const KIND = { attach:['#0062A1','Attach / Registration'], pdu:['#0F5B56','PDU / PDN'], release:['#64748B','Idle / Release'], service:['#7C3AED','Service Request'], tau:['#D97706','TAU'], handover:['#DB2777','Handover'], detach:['#DC2626','Detach'], other:['#94A3B8','Autre'] };
const H = ({children}) => <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">{children}</div>;
const pending = 'Non disponible : backend à venir';
export function Fail({q, path}) {
  if (!q.isError) return null;
  const st = q.error?.status;
  return <div role="alert" className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11.5px] text-muted-foreground">{st===404||st===405||st===501 ? pending : 'Échec'} · <span className="font-mono">GET {apiPath(path)}</span> → {st ? `HTTP ${st}` : 'réseau'}</div>;
}

export function OtherSessions({s, onOpen}) {
  const p = s.subscriber_pseudonym;
  const prev = s.previous_session_id, next = s.next_session_id;
  return <section aria-label="Autres sessions de cet abonné"><H>Autres sessions de cet abonné</H>
    {!p ? <div className="text-[12px] text-subtle">{pending} (subscriber_pseudonym)</div> : <div className="space-y-1 text-[12px]">
      <div className="text-muted-foreground">Pseudonyme <span className="font-mono text-foreground">{shortPseudo(p)}</span>{s.subscriber_session_count!=null && <> · {s.subscriber_session_count} sessions</>}</div>
      {[['← Précédente',prev,s.previous_link],['Suivante →',next,s.next_link]].map(([l,id,link])=><button key={l} disabled={!id} onClick={()=>onOpen?.(id)} className="w-full text-left rounded-md border border-border px-2 py-1 disabled:opacity-50 hover:bg-surface-2">
        <span className="text-muted-foreground">{l}</span> <span className="font-mono">{id ?? '—'}</span>{link?.proof && <div className="text-[11px] text-muted-foreground">{link.status ?? 'EXACT'} · {link.proof}</div>}</button>)}
    </div>}
  </section>;
}

export default function SubscriberJourney({s, onOpen}) {
  const [query,setQuery] = useState(''); const [submitted,setSubmitted] = useState('');
  const lookup = useIdentityLookup(submitted,true);
  const looked = lookup.data?.data?.subscriber_pseudonym;
  const pseudo = looked ?? s.subscriber_pseudonym ?? null;
  const journeyQ = useSubscriberJourney(pseudo), tmsiQ = useSubscriberTmsi(pseudo,true), idQ = useSessionIdentities(s.session_id, true);
  const j = useMemo(()=>toJourney(journeyQ.data?.data),[journeyQ.data]);
  const ids = idQ.data?.data ?? {};
  const identityRows = [
    ['IMSI / SUPI','subscriber'],['TMSI / GUTI','temporary'],['S-TMSI','s_tmsi'],['M-TMSI','m_tmsi'],
    ['IMEI(SV) / PEI','equipment'],['MSISDN / GPSI','directory'],
  ];
  const tmsi = useMemo(()=>toTmsiList(tmsiQ.data?.data,true),[tmsiQ.data]);
  return <div className="p-4 space-y-4 text-[12.5px]">
    <h2 className="text-[16px] font-semibold font-mono break-all" title={pseudo??undefined}>{observedIdentity(ids,'subscriber')}</h2>
    <form onSubmit={e=>{e.preventDefault(); setSubmitted(query.trim());}} className="flex gap-2">
      <input aria-label="Rechercher un abonné" value={query} onChange={e=>setQuery(e.target.value)} placeholder="IMSI, TMSI, S-TMSI, M-TMSI, IMEI ou MSISDN" className="flex-1 h-8 rounded-md border border-border px-2 outline-none focus:border-[var(--app-accent)]"/>
      <button className="h-8 px-3 rounded-md text-white text-[12px]" style={{background:'var(--app-accent)'}}>Ouvrir le parcours</button>
    </form>
    {submitted && <Fail q={lookup} path={`/identities?q=…`}/>}
    {submitted && lookup.data && !looked && <div className="text-muted-foreground">Aucun abonné trouvé.</div>}

    <section><H>Identités</H>
      <dl className="grid grid-cols-[110px_1fr] gap-y-0.5 text-[12px]">
        <dt className="text-muted-foreground">Pseudonyme</dt><dd className="font-mono" title={pseudo??undefined}>{shortPseudo(pseudo)}</dd>
        {identityRows.map(([label,kind])=>{const proof=identityProofs(ids,kind).at(-1);return <React.Fragment key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-mono break-all" title={proof?.capture_id?`preuve ${proof.capture_id}·${proof.packet_number}`:undefined}>{observedIdentity(ids,kind)}{proof?.event_id&&<span className="ml-1 text-[10px] text-[var(--app-accent)]">#{proof.packet_number}</span>}</dd></React.Fragment>;})}
      </dl>
      <div className="mt-1"><Fail q={idQ} path={`/sessions/${s.session_id}/identities`}/></div>
    </section>

    {!pseudo ? <div className="rounded-md border border-dashed border-border p-4 text-muted-foreground">{pending} : le serveur ne fournit pas encore l'abonné de cette session (subscriber_pseudonym, OIRAN 2.13.0).</div> : <>
      <section><H>Parcours (ordre capture_id, seq)</H>
        <Fail q={journeyQ} path={`/subscribers/${pseudo}/journey`}/>
        {journeyQ.isPending && <div className="text-muted-foreground">Chargement du parcours…</div>}
        {journeyQ.data && (j.sessions.length===0 ? <div className="text-muted-foreground">Aucune session.</div> : <ol aria-label="Sessions de l'abonné" className="flex flex-col">
          {j.sessions.map((x,i)=>{ const l=j.links.find(k=>k.to===x.session_id); const cur=x.session_id===s.session_id;
            return <li key={x.session_id} className="flex flex-col items-stretch">
              {i>0 && <div className="h-5 ml-5 border-l-2" title={l?`${l.status}${l.rule?` · ${l.rule}`:''}${l.proof?` · ${l.proof}`:''}${l.reason?` · ${l.reason}`:''}`:undefined} style={{borderColor:l?.status==='EXACT'?'#16A34A':l?'#D97706':'#E2E8F0',borderStyle:l&&l.status!=='EXACT'?'dashed':'solid'}}/>}
              <button type="button" onClick={()=>onOpen?.(x.session_id)} className={`text-left rounded-lg border px-3 py-2 transition ${cur?'border-[var(--app-accent)] bg-brand-soft':'border-border bg-white hover:bg-surface-2'}`}>
                <div className="flex items-baseline justify-between gap-2"><span className="font-mono text-[12px] text-foreground">{shortPseudo(x.session_id)}</span><span className="font-mono text-[11px] text-muted-foreground">({shortPseudo(x.capture_id)}, {x.seq ?? '—'})</span></div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">{x.procedures.map((p,k)=><span key={k} className="inline-flex items-center gap-1 text-[11.5px] text-ink-2"><span className="w-2 h-2 rounded-sm" style={{background:KIND[p.kind][0]}}/>{p.name}</span>)}</div>
              </button></li>; })}
        </ol>)}
      </section>
      <section><H>Chaîne TMSI</H>
        <Fail q={tmsiQ} path={`/subscribers/${pseudo}/tmsi`}/>
        {tmsiQ.isPending && <div className="text-muted-foreground">Chargement des attributions…</div>}
        {tmsiQ.data && (tmsi.length===0 ? <div className="text-muted-foreground">Aucune identité temporaire observée.</div> : <ul className="space-y-1.5">
          {tmsi.map((item,index)=><li key={`${item.label}-${index}`} className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center gap-2"><span className="font-mono text-[11.5px]">{item.label}</span><span className={`ml-auto text-[11px] ${item.status==='attribution non capturée'?'text-warning':'text-muted-foreground'}`}>{item.status}</span></div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Attribué : {item.assigned ? refLabel(item.assigned) : '—'} · Présenté : {item.presented.length ? item.presented.map(refLabel).join(', ') : '—'}</div>
          </li>)}
        </ul>)}
      </section>
    </>}
  </div>;
}
