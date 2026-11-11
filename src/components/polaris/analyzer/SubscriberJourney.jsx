import React, { useMemo, useState } from 'react';
import { useSubscriberJourney, useSubscriberTmsi, useSessionIdentities, useIdentityLookup, apiPath, available } from '@/lib/polaris-api';
import { toJourney, toTmsiList, shortPseudo, refLabel } from './subscriber';

// Procedure colours (light mode only).
export const KIND = { attach:['#0062A1','Attach / Registration'], pdu:['#0F5B56','PDU / PDN'], release:['#64748B','Idle / Release'], service:['#7C3AED','Service Request'], tau:['#D97706','TAU'], handover:['#DB2777','Handover'], detach:['#DC2626','Detach'], other:['#94A3B8','Autre'] };
const H = ({children}) => <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] mb-1.5">{children}</div>;
const pending = 'Non disponible : backend à venir';
export function Fail({q, path}) {
  if (!q.isError) return null;
  const st = q.error?.status;
  return <div role="alert" className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[11.5px] text-[#64748B]">{st===404||st===405||st===501 ? pending : 'Échec'} · <span className="font-mono">GET {apiPath(path)}</span> → {st ? `HTTP ${st}` : 'réseau'}</div>;
}

export function OtherSessions({s, onOpen}) {
  const p = s.subscriber_pseudonym;
  const prev = s.previous_session_id, next = s.next_session_id;
  return <section aria-label="Autres sessions de cet abonné"><H>Autres sessions de cet abonné</H>
    {!p ? <div className="text-[12px] text-[#94A3B8]">{pending} (subscriber_pseudonym)</div> : <div className="space-y-1 text-[12px]">
      <div className="text-[#64748B]">Abonné <span className="font-mono text-[#172033]">{shortPseudo(p)}</span>{s.subscriber_session_count!=null && <> · {s.subscriber_session_count} sessions</>}</div>
      {[['← Précédente',prev,s.previous_link],['Suivante →',next,s.next_link]].map(([l,id,link])=><button key={l} disabled={!id} onClick={()=>onOpen?.(id)} className="w-full text-left rounded-md border border-[#E2E8F0] px-2 py-1 disabled:opacity-50 hover:bg-[#F8FAFC]">
        <span className="text-[#64748B]">{l}</span> <span className="font-mono">{id ?? '—'}</span>{link?.proof && <div className="text-[11px] text-[#64748B]">{link.status ?? 'EXACT'} · {link.proof}</div>}</button>)}
    </div>}
  </section>;
}

export default function SubscriberJourney({s, role, onOpen}) {
  const [query,setQuery] = useState(''); const [submitted,setSubmitted] = useState('');
  const lookup = useIdentityLookup(submitted);
  const looked = lookup.data?.data?.subscriber_pseudonym;
  const pseudo = looked ?? s.subscriber_pseudonym ?? null;
  const operator = role === 'operator' || role === 'administrator';
  const journeyQ = useSubscriberJourney(pseudo), tmsiQ = useSubscriberTmsi(pseudo), idQ = useSessionIdentities(s.session_id, operator);
  const j = useMemo(()=>toJourney(journeyQ.data?.data),[journeyQ.data]);
  const tmsi = useMemo(()=>toTmsiList(tmsiQ.data?.data, operator),[tmsiQ.data,operator]);
  const ids = idQ.data?.data ?? {};
  const pos = Object.fromEntries(j.sessions.map((x,i)=>[x.session_id,i]));
  const COL = 168;
  return <div className="p-4 space-y-4 text-[12.5px]">
    <form onSubmit={e=>{e.preventDefault(); setSubmitted(query.trim());}} className="flex gap-2">
      <input aria-label="Rechercher un abonné" value={query} onChange={e=>setQuery(e.target.value)} placeholder="IMSI, TMSI, IMEI ou MSISDN" className="flex-1 h-8 rounded-md border border-[#E2E8F0] px-2 outline-none focus:border-[var(--app-accent)]"/>
      <button className="h-8 px-3 rounded-md text-white text-[12px]" style={{background:'var(--app-accent)'}}>Ouvrir le parcours</button>
    </form>
    {submitted && <Fail q={lookup} path={`/identities?q=…`}/>}
    {submitted && lookup.data && !looked && <div className="text-[#64748B]">Aucun abonné trouvé.</div>}

    <section><H>Identités</H>
      <dl className="grid grid-cols-[110px_1fr] gap-y-0.5 text-[12px]">
        <dt className="text-[#64748B]">Abonné</dt><dd className="font-mono">{shortPseudo(pseudo)}</dd>
        {[['IMSI','imsi'],['MSISDN','msisdn'],['IMEI(SV)','imeisv']].map(([l,k])=><React.Fragment key={k}><dt className="text-[#64748B]">{l}</dt><dd className="font-mono">{operator ? available(ids[k] ?? (k==='imeisv'?ids['imei']:undefined)) : 'masqué'}</dd></React.Fragment>)}
      </dl>
      {operator && <div className="mt-1"><Fail q={idQ} path={`/sessions/${s.session_id}/identities`}/></div>}
    </section>

    {!pseudo ? <div className="rounded-md border border-dashed border-[#E2E8F0] p-4 text-[#64748B]">{pending} : le serveur ne fournit pas encore l'abonné de cette session (subscriber_pseudonym, OIRAN 2.13.0).</div> : <>
      <section><H>Parcours (ordre capture_id, seq)</H>
        <Fail q={journeyQ} path={`/subscribers/${pseudo}/journey`}/>
        {journeyQ.isPending && <div className="text-[#64748B]">Chargement du parcours…</div>}
        {journeyQ.data && (j.sessions.length===0 ? <div className="text-[#64748B]">Aucune session.</div> : <div className="overflow-x-auto scroll-thin">
          <svg width={j.sessions.length*COL} height={150} role="img" aria-label="Frise des sessions">
            {j.links.map((l,i)=>{ const b=pos[l.to]; if(b==null) return null; const a=l.from!=null?pos[l.from]:null; const x2=b*COL+12, x1=a!=null?a*COL+COL-20:x2-40;
              return <g key={i}><path d={`M${x1} 22 C ${(x1+x2)/2} 2, ${(x1+x2)/2} 2, ${x2} 22`} fill="none" stroke={l.status==='EXACT'?'#16A34A':'#D97706'} strokeWidth="1.5" strokeDasharray={l.status==='EXACT'?undefined:'4 3'}/>
                <title>{l.status}{l.rule?` · ${l.rule}`:''}{l.proof?` · ${l.proof}`:''}{l.reason?` · ${l.reason}`:''}</title></g>; })}
            {j.sessions.map((x,i)=><g key={x.session_id} transform={`translate(${i*COL},28)`} onClick={()=>onOpen?.(x.session_id)} className="cursor-pointer">
              <rect width={COL-20} height={112} rx="8" fill={x.session_id===s.session_id?'#EFF6FF':'#FFFFFF'} stroke={x.session_id===s.session_id?'var(--app-accent)':'#E2E8F0'}/>
              <text x="8" y="16" fontSize="10.5" fontFamily="Geist Mono" fill="#172033">{shortPseudo(x.session_id)}</text>
              <text x="8" y="30" fontSize="10" fontFamily="Geist Mono" fill="#64748B">{`(${shortPseudo(x.capture_id)}, ${x.seq ?? '—'})`}</text>
              {x.procedures.slice(0,5).map((p,k)=><g key={k} transform={`translate(8,${40+k*14})`}><rect width="8" height="8" y="1" rx="2" fill={KIND[p.kind][0]}/><text x="13" y="9" fontSize="10.5" fill="#334155">{p.name.slice(0,22)}</text></g>)}
            </g>)}
          </svg>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[#64748B]">{Object.values(KIND).map(([c,l])=><span key={l} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{background:c}}/>{l}</span>)}<span>— EXACT</span><span>┄ OUVERT</span></div>
          {j.links.filter(l=>l.status==='OUVERT').map((l,i)=><div key={i} className="text-[11.5px] text-[#D97706]">Maillon ouvert → {shortPseudo(l.to)} : {l.reason}</div>)}
        </div>)}
      </section>
      <section><H>Liste TMSI</H>
        <Fail q={tmsiQ} path={`/subscribers/${pseudo}/tmsi`}/>
        {tmsiQ.data && (tmsi.length===0 ? <div className="text-[#64748B]">Aucun TMSI observé.</div> : <table className="w-full text-[12px]"><thead><tr>{['TMSI','Attribué','Présenté','Statut'].map(h=><th key={h} className="h-7 px-2 text-left font-medium text-[#64748B] bg-[#F8FAFC] border-b border-[#E2E8F0]">{h}</th>)}</tr></thead>
          <tbody>{tmsi.map((t,i)=><tr key={i} className="align-top">
            <td className="px-2 py-1 border-b border-[#F1F5F9] font-mono">{t.label}</td>
            <td className="px-2 py-1 border-b border-[#F1F5F9]">{t.assigned ? <button onClick={()=>onOpen?.(t.assigned.session_id)} className="text-left hover:underline">{t.assigned.message ?? '—'} <span className="font-mono text-[#64748B]">{refLabel(t.assigned)}</span></button> : '—'}</td>
            <td className="px-2 py-1 border-b border-[#F1F5F9]">{t.presented.length ? t.presented.map((r,k)=><button key={k} onClick={()=>onOpen?.(r.session_id)} className="block text-left hover:underline">{r.message ?? '—'} <span className="font-mono text-[#64748B]">{shortPseudo(r.session_id)} {refLabel(r)}</span></button>) : '—'}</td>
            <td className={`px-2 py-1 border-b border-[#F1F5F9] ${t.status==='actif'?'text-[#16A34A]':t.status==='remplacé'?'text-[#64748B]':'text-[#D97706]'}`}>{t.status}</td></tr>)}</tbody></table>)}
      </section>
    </>}
  </div>;
}
