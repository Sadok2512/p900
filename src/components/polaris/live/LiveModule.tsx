// @ts-nocheck
import { useLiveDemo, usePacketDissection, usePolarisMode, observedIdentity } from '@/lib/polaris-api';
import { apiPath, request } from '@/lib/polaris-api/client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InterfaceBadge } from '../ui/InterfaceBadge';

/* ---------- Scripts (demo) : [ifc, proto, from, to, message, procedure, result, cause, kind] ---------- */
const fingerprint = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return 'sha256:' + h.toString(16).padStart(8,'0') + '…'; };

const useStore = (key, init) => { const [v,setV] = useState(init); useEffect(()=>{ try{ const s=localStorage.getItem(key); if(s) setV(JSON.parse(s)); }catch{} },[key]); const set=(x)=>setV(p=>{ const n=typeof x==='function'?x(p):x; try{localStorage.setItem(key,JSON.stringify(n));}catch{} return n; }); return [v,set]; };
const card = 'bg-white rounded-xl border border-border';
const Btn = ({ primary, on, children, className='', ...p }) => <button {...p} className={`h-8 px-3 rounded-md text-[12.5px] font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${primary?'bg-[var(--app-accent)] text-white hover:opacity-90':on?'bg-muted text-foreground border border-border':'border border-border bg-white text-foreground hover:bg-surface-2'} ${className}`}>{children}</button>;
const Tag = ({ c='#666666', children }) => <span className="text-[11px] font-medium rounded px-1.5 py-[1px] border whitespace-nowrap" style={{ color:c, borderColor:c+'33', background:c+'0D' }}>{children}</span>;
const RES_C = (r) => r==='Échec'?'#B42318':r==='Succès'||r==='Accepted'||/^2\d\d/.test(r)?'#15803D':'#8F8F8F';
const fmtRate = (v) => v>=1000?(v/1000).toFixed(2)+' Gb/s':v>=1?v.toFixed(1)+' Mb/s':(v*1000).toFixed(0)+' kb/s';

export default function LiveModule({ t, setPage }) {
  const { demo, setDemo } = usePolarisMode();
  const liveData = useLiveDemo(); const DIR = liveData.directory; const NODES = liveData.nodes; const IFC_C = liveData.colors;
  const [ttype, setTtype] = useState('pseudonym');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null); // {st, ue, err}
  const [traceId, setTraceId] = useState(null);
  const [realUe, setRealUe] = useState(null);
  const [journal, setJournal] = useState([]);
  const [msgs, setMsgs] = useState([]); const [buf, setBuf] = useState([]);
  const [running, setRunning] = useState(true);
  const [marks, setMarks] = useState([]);
  const [delay, setDelay] = useState(0);
  const [ttl, setTtl] = useState(30*60);
  const [mode, setMode] = useStore('polaris-live-mode', 'ladder');
  const [sel, setSel] = useState(null);
  const [hide, setHide] = useState([]); const [fq, setFq] = useState('');
  const [rightW, setRightW] = useStore('polaris-live-rightw', 360);
  const [rightOpen, setRightOpen] = useStore('polaris-live-right', true);
  const [ladH, setLadH] = useStore('polaris-live-ladh', 380);
  const [full, setFull] = useState(null); // 'sig' | 'thr'
  const [thr, setThr] = useState([]); // {ts, dl, ul}
  const seq = useRef(0);
  const runningRef = useRef(true);
  const sigBox = useRef(null); const atEnd = useRef(true);
  const onSigScroll = (e) => { const b = e.currentTarget; atEnd.current = b.scrollTop + b.clientHeight >= b.scrollHeight - 40; };
  const ue = demo ? (res?.ue && DIR[res.ue]) : realUe;
  const tech = ue?.tech || '5G';
  const tracking = demo ? !!(ue && (res?.st === 'Trouvé' || res?.st === 'OUVERT')) : !!traceId;

  useEffect(() => { setMsgs([]); setBuf([]); setThr([]); seq.current = 0; setSel(null); setTtl(30*60); }, [res?.ue, demo]);
  useEffect(() => { runningRef.current=running; },[running]);
  useEffect(() => { if (!tracking || !demo) return; const script = liveData.scripts[tech]; const t0 = Date.now();
    const id = setInterval(() => {
      const s = script[seq.current % script.length]; seq.current++;
      const m = { cap: ue.cap, seq: 1200 + seq.current, ts: new Date().toLocaleTimeString('fr-FR'), rel: ((Date.now()-t0)/1000).toFixed(3), ifc:s[0], proto:s[1], from:s[2], to:s[3], name:s[4], proc:s[5], res:s[6], cause:s[7], kind:s[8], corr: res.st==='Trouvé'?'EXACT':'OUVERT' };
      const now = Date.now(); const k = now/4000; const p = { ts: now, dl: Math.max(0, 42 + Math.sin(k)*14 + (Math.random()-0.5)*10), ul: Math.max(0, 6 + Math.cos(k/1.3)*2 + (Math.random()-0.5)*2) };
      if (running) { setMsgs(x => [...x, m].slice(-400)); setThr(x => [...x, p].filter(z => now - z.ts < 30*60000)); }
      else { setBuf(b => [...b, { m, p }]); }
      setDelay(2 + Math.round(Math.random()*4)); setTtl(v => Math.max(0, v-1));
    }, 1000); return () => clearInterval(id); }, [tracking, running, tech, res?.st]);
  const resume = () => { setMsgs(x => [...x, ...buf.map(b=>b.m)].slice(-400)); setThr(x => [...x, ...buf.map(b=>b.p)]); setBuf([]); setRunning(true); };

  useEffect(()=>{ if(demo||!traceId)return; const source=new EventSource(apiPath(`/live/traces/${encodeURIComponent(traceId)}/stream`),{withCredentials:true});
    const receive=(kind)=>(event)=>{let data;try{data=JSON.parse(event.data)}catch{return} if(kind==='message'){const m={cap:data.capture_id,seq:data.packet_number,eventId:data.event_id,ts:new Date().toLocaleTimeString('fr-FR'),rel:'—',ifc:data.interface,proto:data.protocol,from:data.source,to:data.destination,name:data.message_name,proc:data.procedure||data.message_name,res:data.result||'En cours',cause:data.cause||'',kind:data.phase||'message',corr:'LIVE',decoded:data.decoded_ie_tree};if(runningRef.current)setMsgs(x=>[...x,m].slice(-2000));else setBuf(x=>[...x,{m}].slice(-2000));} else if(kind==='throughput'){const p={ts:Date.now(),dl:Number(data.dl_bytes_s||0)*8/1e6,ul:Number(data.ul_bytes_s||0)*8/1e6};if(runningRef.current)setThr(x=>[...x,p].filter(z=>Date.now()-z.ts<1800000));else setBuf(x=>[...x,{p}].slice(-2000));}else if(kind==='ue_info'){setRealUe({tech:data.technology||'5G',info:data});}else if(kind==='status'){setTtl(Math.max(0,Number(data.expires_at||0)-Math.floor(Date.now()/1000)));}};
    ['message','throughput','ue_info','procedure','marker','status'].forEach(k=>source.addEventListener(k,receive(k))); source.onerror=()=>setRes(r=>({...r,st:'Déconnecté',err:'Flux SSE interrompu'})); return()=>source.close(); },[traceId,demo]);

  const find = async (e) => { e?.preventDefault(); const v=q.trim(); if(!v){setRes({st:'Invalide',err:t('Identifiant requis.')});return;} if(!demo){try{const out=await request('/live/traces',{method:'POST',body:{key_type:ttype,value:v,duration_s:1800,interfaces:[]},clearIdentityResponse:true});setTraceId(out.data.trace_id);setTtl(Math.max(0,out.data.expires_at-Math.floor(Date.now()/1000)));setRes({st:out.data.armed?'ARMÉE':'OUVERT',ue:out.data.subscriber_pseudonyms?.[0],identities:out.data.identities??out.data});setJournal(j=>[{ts:new Date().toLocaleTimeString('fr-FR'),who:'SD',a:`trace ${ttype}`,c:'valeur protégée',r:out.data.armed?'ARMÉE':'OUVERT'},...j]);}catch(error){setRes({st:'Indisponible',err:error?.message||'API Live indisponible'});}return;} let r;
    if (ttype === 'pseudo') { if (!/^ue-[0-9a-f]{4}$/.test(v)) r = { st:'Invalide', err:t('Format pseudonyme : ue-xxxx') }; else r = DIR[v] ? { st:DIR[v].st, ue:v } : { st:'Non trouvé' }; setJournal(j => [{ ts:new Date().toLocaleTimeString('fr-FR'), who:'SD', a:'recherche pseudo', c:v, r:r.st }, ...j]); }
    else if (ttype === 'guti') { r = /^[0-9A-F-]{8,}$/i.test(v) ? (v.toUpperCase().includes('0A7E91F0') ? { st:'Trouvé', ue:'ue-7f3a' } : { st:'Non trouvé' }) : { st:'Invalide', err:t('Format GUTI/TMSI invalide.') }; }
    else if (ttype === 'cell') { r = ['0A1F','0B07'].includes(v.toUpperCase()) ? { st:'Trouvé', ue: v.toUpperCase()==='0A1F'?'ue-7f3a':'ue-21c0' } : { st:'Non trouvé' }; }
    else { r = /482/.test(v) ? { st:'Trouvé', ue:'ue-7f3a' } : /219/.test(v) ? { st:'Trouvé', ue:'ue-21c0' } : { st:'Non trouvé' }; }
    setRes(r); };
  const addMarker=async()=>{if(!traceId)return;await request(`/live/traces/${encodeURIComponent(traceId)}/markers`,{method:'POST',body:{label:`Marqueur ${marks.length+1}`}});const s=msgs.at(-1)?.seq;if(s!=null)setMarks(m=>[...m,s]);};

  const shown = useMemo(() => msgs.filter(m => !hide.includes(m.ifc) && (!fq || (m.name+' '+m.proc+' '+m.cause+' '+m.proto).toLowerCase().includes(fq.toLowerCase()))), [msgs, hide, fq]);
  const ifcs = tech==='LTE' ? ['S1-MME','S6a','S11','S5'] : ['N2','SBI','N4'];
  useEffect(() => { const b = sigBox.current; if (b && mode === 'table' && atEnd.current) b.scrollTop = b.scrollHeight; }, [shown.length, mode]);
  const selM = msgs.find(m => m.seq === sel);
  const dissection = usePacketDissection(selM?.cap, selM?.seq, !demo && !!selM);
  const drag = (e, kind) => { e.preventDefault(); const x0=e.clientX, y0=e.clientY, w0=rightW, h0=ladH; const mv=(ev)=>{ if(kind==='w') setRightW(Math.max(280, Math.min(560, w0 - (ev.clientX-x0)))); else setLadH(Math.max(200, Math.min(800, h0 + ev.clientY-y0))); }; const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);}; addEventListener('pointermove',mv); addEventListener('pointerup',up); };
  const ST_C = { 'Trouvé':'#15803D', 'OUVERT':'#A15C07', 'Non trouvé':'#666666', 'Invalide':'#B42318', 'Refusé':'#B42318', 'Indisponible':'#A15C07' };
  const exportCsv = () => { const h='capture_id,seq,t_rel,interface,protocol,message,src,dst,procedure,result,cause\n'; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([h+shown.map(m=>[m.cap,m.seq,m.rel,m.ifc,m.proto,m.name,m.from,m.to,m.proc,m.res,m.cause].map(x=>`"${x}"`).join(',')).join('\n')],{type:'text/csv'})); a.download='live-'+res.ue+'.csv'; a.click(); };

  const sig = <div className={card+' overflow-hidden flex flex-col'} style={full==='sig'?{height:'calc(100vh - 220px)'}:{}}>
    <div className="h-11 px-3 flex items-center gap-2 border-b border-border-subtle">
      <div className="flex rounded-md border border-border p-0.5 bg-surface-2">{[['ladder','Flèches'],['table','Lignes']].map(([k,n])=><button key={k} onClick={()=>setMode(k)} className={`h-7 px-3 rounded text-[12px] ${mode===k?'bg-white shadow-sm font-semibold text-foreground':'text-muted-foreground'}`}>{t(n)}</button>)}</div>
      <div className="flex gap-1 ml-1">{ifcs.map(i=>{const off=hide.includes(i);return <button key={i} onClick={()=>setHide(h=>off?h.filter(x=>x!==i):[...h,i])} className={`h-6 px-2 rounded-full text-[11px] font-medium border ${off?'border-border text-subtle line-through':'border-transparent text-white'}`} style={off?{}:{background:IFC_C[i]}}>{i}</button>;})}</div>
      <input value={fq} onChange={e=>setFq(e.target.value)} placeholder={t('Filtrer messages…')} className="h-7 w-44 px-2.5 rounded-md border border-border text-[12px] outline-none focus:border-[var(--app-accent)]"/>
      <span className="ml-auto text-[11px] text-subtle tabular-nums">{shown.length}/{msgs.length}</span>
      {mode==='table' && <Btn disabled={!shown.length} onClick={exportCsv}>CSV</Btn>}
      <Btn onClick={()=>setFull(full==='sig'?null:'sig')}>{full==='sig'?t('Quitter'):'⤢'}</Btn>
    </div>
    <div ref={sigBox} onScroll={onSigScroll} className="overflow-auto scroll-thin flex-1" style={full==='sig'?{}:{height:ladH}}>
      {!tracking ? <Empty t={t} demo={demo} res={res}/> : mode==='ladder' ? <Ladder t={t} msgs={shown} nodes={NODES[tech]} sel={sel} setSel={setSel} marks={marks} atEnd={atEnd}/> :
        <table className="w-full text-[12px]"><thead className="sticky top-0 bg-white"><tr className="text-left text-[11px] text-subtle">{['Capture','Seq','t (s)','Interface','Protocole','Message','Source','Destination','Procédure','Résultat','Cause',''].map(h=><th key={h} className="px-2.5 py-2 font-medium border-b border-border-subtle whitespace-nowrap">{t(h)}</th>)}</tr></thead>
          <tbody>{shown.map(m=><tr key={m.seq} onClick={()=>setSel(m.seq)} className={`cursor-pointer whitespace-nowrap ${sel===m.seq?'bg-surface-2 shadow-[inset_2px_0_0_var(--app-accent)]':'hover:bg-surface-2'} ${marks.includes(m.seq)?'bg-warning-soft':''}`}>
            <td className="px-2.5 py-1.5 font-mono text-subtle">{m.cap}</td><td className="px-2.5 font-mono">{m.seq}</td><td className="px-2.5 font-mono text-subtle">{m.rel}</td><td className="px-2.5"><span className="font-medium" style={{color:IFC_C[m.ifc]}}>{m.ifc}</span></td><td className="px-2.5 text-muted-foreground">{m.proto}</td><td className="px-2.5 text-foreground">{m.name}</td><td className="px-2.5">{m.from}</td><td className="px-2.5">{m.to}</td><td className="px-2.5 text-muted-foreground">{m.proc}</td><td className="px-2.5" style={{color:RES_C(m.res)}}>{m.res}</td><td className="px-2.5 text-danger">{m.cause}</td>
            <td className="px-2.5"><button onClick={e=>{e.stopPropagation();setSel(m.seq);setMode('ladder');}} className="text-[11px] text-[var(--app-accent)]">{t('→ ladder')}</button></td></tr>)}</tbody></table>}
    </div>
    {selM && <div className="border-t border-border-subtle px-4 py-3 grid grid-cols-[1fr_auto] gap-3 text-[12px] bg-surface-2">
      <div className="min-w-0"><div className="flex items-center gap-2"><b className="text-[13px]">{selM.name}</b><InterfaceBadge name={selM.ifc}/><Tag c={selM.corr==='EXACT'?'#15803D':'#A15C07'}>{selM.corr}</Tag>{selM.cause&&<Tag c="#B42318">{selM.cause}</Tag>}</div>
        <pre className="mt-2 font-mono text-[11px] text-ink-2 whitespace-pre-wrap">{`capture_id=${selM.cap}  seq=${selM.seq}  t_rel=${selM.rel}s\n${selM.proto.split('/').map((l,i)=>'  '.repeat(i)+'▸ '+l).join('\n')}\n${'  '.repeat(selM.proto.split('/').length)}▸ ${selM.name}  (${selM.from} → ${selM.to})`}</pre>
        {!demo&&<pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{dissection.isLoading?t('Décodage complet…'):dissection.isError?t('Décodage complet indisponible'):String(dissection.data?.data?.dissection??'')}</pre>}</div>
      <div className="flex flex-col gap-1.5"><Btn onClick={()=>setPage('sessions')}>{t('Décodage complet')} →</Btn><Btn onClick={()=>setPage('sessions')}>{t('Preuves')} →</Btn><Btn onClick={()=>setSel(null)}>✕</Btn></div>
    </div>}
  </div>;

  return (
    <div className="flex-1 overflow-auto scroll-thin bg-surface-2">
      {/* Top zone */}
      <div className="bg-white border-b border-border">
        <div className="w-full px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="mr-2"><div className="text-[12px] text-muted-foreground">POLARIS Live</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-1">Live Trace</h1></div>
          <form onSubmit={find} className="flex items-center h-9 rounded-lg border border-border bg-white focus-within:border-[var(--app-accent)] overflow-hidden">
            <select value={ttype} onChange={e=>{setTtype(e.target.value);setQ('');}} className="h-full px-2 text-[12px] bg-surface-2 border-r border-border outline-none">
              <option value="pseudonym">{t('Pseudonyme')}</option><option value="imsi">IMSI / SUPI</option><option value="tmsi">TMSI / GUTI</option><option value="s_tmsi">S-TMSI</option><option value="m_tmsi">M-TMSI</option><option value="imei">IMEI</option><option value="msisdn">MSISDN</option>
            </select>
            <input value={q} onChange={e=>setQ(e.target.value)} type="text" autoComplete="off" placeholder={ttype==='pseudonym'?'UE-…':'identité en clair'} className="w-48 px-3 text-[13px] font-mono outline-none"/>
            <button className="h-full px-3 bg-[var(--app-accent)] text-white text-[12.5px] font-medium hover:opacity-90">{t('Rechercher')}</button>
          </form>
          {res && <span className="flex items-center gap-1.5 text-[12px]"><Tag c={ST_C[res.st]||'#666'}>{t(res.st)}</Tag>{res.ue && <span className="font-mono text-foreground">{res.ue}</span>}{res.err && <span className="text-danger">{res.err}</span>}</span>}
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className={`w-[7px] h-[7px] rounded-full ${tracking&&running?'bg-success animate-pulse':'bg-track'}`}/>{tracking?(running?t('Live'):t('En pause')):t('Inactif')}</span>
            {tracking && <span className="text-[12px] text-warning bg-warning-soft border border-warning-line rounded px-1.5 h-6 grid place-items-center">{t('Retard import')} {delay} s</span>}
            <Btn disabled={!tracking} onClick={()=>running?setRunning(false):resume()}>{running?'❚❚ '+t('Pause'):'▶ '+t('Reprendre')+(buf.length?` (+${buf.length})`:'')}</Btn>
            <Btn disabled={!tracking||(!msgs.length&&!traceId)} onClick={demo?()=>{const s=msgs[msgs.length-1].seq;setMarks(m=>[...m,s]);}:addMarker}>⚑ {t('Marqueur')}</Btn>
            <Btn onClick={()=>setPage('sessions')}>Session Explorer →</Btn>
            <button onClick={()=>setDemo(!demo)} className={`h-7 px-2.5 rounded-full text-[11.5px] font-medium border flex items-center gap-1.5 ${demo?'bg-warning-soft border-warning-line text-warning':'border-border text-muted-foreground'}`}><span className={`w-6 h-3.5 rounded-full relative ${demo?'bg-warning':'bg-track'}`}><span className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white transition-all ${demo?'left-[12px]':'left-[2px]'}`}/></span>{t('Démo')}</button>
          </div>
        </div>
        {/* compact counters */}
        <div className="w-full px-6 h-8 flex items-center gap-5 text-[11.5px] text-muted-foreground border-t border-border-subtle">
          {[['Traces actives', tracking?'1 / 10':'—'],['Expiration', tracking?`${Math.floor(ttl/60)}:${String(ttl%60).padStart(2,'0')}`:'—'],['Messages',msgs.length],['Tampon',buf.length],['Marqueurs',marks.length],['Techno',ue?(ue.tech==='LTE'?'LTE':'5G SA'):'—']].map(([n,v])=><span key={n}>{t(n)} <b className="text-foreground tabular-nums">{v}</b></span>)}
          {demo && <span className="ml-auto text-warning">{t('Données de démo — API live POLARIS (WebSocket) non connectée')}</span>}
        </div>
      </div>

      <div className="w-full px-6 py-4">
        {full==='sig' ? sig : full==='thr' ? <Throughput t={t} data={thr} running={running} delay={delay} tracking={tracking} full onFull={()=>setFull(null)} ue={ue}/> :
        <div className="flex items-start">
          <div className="flex-1 min-w-0 space-y-0">
            {sig}
            <div onPointerDown={e=>drag(e,'h')} onDoubleClick={()=>setLadH(380)} className="h-3 cursor-row-resize grid place-items-center group"><span className="h-1 w-10 rounded-full bg-track group-hover:bg-[var(--app-accent)]"/></div>
            <Throughput t={t} data={thr} running={running} delay={delay} tracking={tracking} onFull={()=>setFull('thr')} ue={ue}/>
          </div>
          {rightOpen ? <>
            <div onPointerDown={e=>drag(e,'w')} onDoubleClick={()=>setRightW(360)} className="w-3 self-stretch cursor-col-resize grid place-items-center group"><span className="w-1 h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)]"/></div>
            <div className="shrink-0 space-y-3" style={{width:rightW}}>
              <UeInfo t={t} ue={ue} res={res} tracking={tracking} msgs={msgs} onHide={()=>setRightOpen(false)}/>
              <Procedures t={t} msgs={msgs} tracking={tracking} onGo={(s)=>{setSel(s);}}/>
              <div className={card+' overflow-hidden'}><div className="h-10 px-4 flex items-center border-b border-border-subtle text-[12.5px] font-semibold">{t('Journal des recherches')}</div>
                {journal.length===0?<div className="px-4 py-3 text-[12px] text-subtle">{t('Aucune recherche dans cette session.')}</div>:journal.slice(0,6).map((j,i)=><div key={i} className="px-4 py-2 border-b border-border-subtle text-[11.5px] flex gap-2"><span className="font-mono text-subtle">{j.ts}</span><span>{t(j.a)}</span><span className="font-mono text-muted-foreground truncate">{j.c}</span><span className="ml-auto" style={{color:ST_C[j.r]}}>{t(j.r)}</span></div>)}</div>
            </div></> : <button onClick={()=>setRightOpen(true)} className={card+' ml-3 w-8 self-stretch text-[11px] text-muted-foreground [writing-mode:vertical-rl] py-3'}>UE Info</button>}
        </div>}
      </div>
    </div>
  );
}

function Empty({ t, demo, res }) {
  return <div className="h-full min-h-[240px] grid place-items-center text-center px-6"><div>
    <div className="mx-auto w-9 h-9 rounded-full bg-muted grid place-items-center text-subtle">⌕</div>
    <div className="mt-3 text-[13px] font-medium text-foreground">{res?.st==='Non trouvé'?t('Aucun abonné rattaché à cet identifiant'):t('Recherchez un UE pour démarrer le suivi')}</div>
    <div className="mt-1 text-[12.5px] text-muted-foreground">{!demo?t('Aucune donnée simulée n’est affichée. Activez « Démo » pour un aperçu.'):t('Exemples : ue-7f3a (5G, EXACT) · ue-21c0 (LTE, OUVERT) · cellule 0A1F · run 482')}</div></div></div>;
}

function Ladder({ t, msgs, nodes, sel, setSel, marks, atEnd }) {
  const W = 900, col = W / nodes.length, cx = (n) => col * nodes.indexOf(n) + col / 2, RH = 34;
  const box = useRef(null);
  useEffect(() => { const b = box.current?.parentElement; if (b && atEnd.current) b.scrollTop = b.scrollHeight; }, [msgs.length]);
  return <div ref={box}>
    <div className="sticky top-0 z-10 bg-white grid border-b border-border-subtle" style={{ gridTemplateColumns: `repeat(${nodes.length},1fr)` }}>{nodes.map(n => <div key={n} className="text-center text-[11.5px] font-semibold text-ink-2 py-2">{n}</div>)}</div>
    <svg viewBox={`0 0 ${W} ${msgs.length * RH + 12}`} className="w-full block" style={{ height: msgs.length * RH + 12 }} preserveAspectRatio="none">
      {nodes.map(n => <line key={n} x1={cx(n)} x2={cx(n)} y1={0} y2={msgs.length * RH + 12} stroke="#EFEFEF" />)}
      {msgs.map((m, i) => { const y = i * RH + 22, a = cx(m.from), b = cx(m.to), c = IFC_C[m.ifc] || '#666', on = sel === m.seq, fail = m.res === 'Échec';
        return <g key={m.seq} onClick={() => setSel(m.seq)} className="cursor-pointer">
          <rect x={0} y={y - 20} width={W} height={RH} fill={on ? '#F5F5F5' : marks.includes(m.seq) ? '#FFFBEB' : 'transparent'} />
          <line x1={a} x2={b} y1={y} y2={y} stroke={c} strokeWidth={on ? 2.4 : 1.5} strokeDasharray={m.proto.includes('NAS') && !m.proto.startsWith('NAS') ? '' : ''} />
          <path d={b > a ? `M${b},${y} l-7,-3.5 v7z` : `M${b},${y} l7,-3.5 v7z`} fill={c} />
          <text x={(a + b) / 2} y={y - 6} fontSize="11" textAnchor="middle" fill={fail ? '#B42318' : '#171717'} fontWeight={on ? 600 : 400}>{m.name}{m.cause ? ' · ' + m.cause.split(' ').slice(0, 2).join(' ') : ''}</text>
          <text x={6} y={y + 4} fontSize="9.5" fill="#A3A3A3" fontFamily="monospace">{m.seq}</text>
          <text x={W - 6} y={y + 4} fontSize="9.5" textAnchor="end" fill={c}>{m.ifc}{m.corr !== 'EXACT' ? ' ·?' : ''}</text>
        </g>; })}
    </svg></div>;
}

function Throughput({ t, data, running, delay, tracking, onFull, full, ue }) {
  const [win, setWin] = useStore('polaris-live-thrwin', 5);
  const [show, setShow] = useState({ dl: true, ul: true });
  const [zoom, setZoom] = useState(null); const [dragSel, setDragSel] = useState(null); const [hover, setHover] = useState(null);
  const svg = useRef(null);
  const now = data.length ? data[data.length - 1].ts : Date.now();
  const lo = zoom ? zoom[0] : now - win * 60000, hi = zoom ? zoom[1] : now;
  const pts = data.filter(p => p.ts >= lo && p.ts <= hi);
  const W = 1000, H = full ? 460 : 300, L = 56, R = 16, T = 14, B = 26;
  const vals = pts.flatMap(p => [show.dl && p.dl, show.ul && p.ul].filter(v => v !== false));
  const ymax = Math.max(1, ...vals) * 1.15;
  const X = ts => L + (ts - lo) / Math.max(1, hi - lo) * (W - L - R), Y = v => T + (1 - v / ymax) * (H - T - B);
  const path = k => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.ts).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ');
  const stats = k => { const v = pts.map(p => p[k]); return v.length ? { cur: v[v.length - 1], min: Math.min(...v), max: Math.max(...v), avg: v.reduce((a, b) => a + b, 0) / v.length } : null; };
  const toTs = (e) => { const r = svg.current.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; return lo + (x - L) / (W - L - R) * (hi - lo); };
  const S = { dl: ['DL', 'var(--app-accent)'], ul: ['UL', '#A15C07'] };
  return <div className={card + ' overflow-hidden'}>
    <div className="h-11 px-4 flex items-center gap-3 border-b border-border-subtle">
      <h3 className="text-[13px] font-semibold">Throughput UL / DL</h3>
      {ue && <span className="text-[11px] text-subtle font-mono">{ue.tech === 'LTE' ? 'Bearer 5 · QCI 9 · APN internet' : 'PDU #1 · 5QI 9 · QFI 1 · DNN internet'} · GTP-U {ue.tech === 'LTE' ? 'S1-U' : 'N3'}</span>}
      <div className="ml-auto flex items-center gap-2">
        {['dl', 'ul'].map(k => <button key={k} onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))} className={`flex items-center gap-1.5 text-[12px] ${show[k] ? 'text-foreground' : 'text-subtle line-through'}`}><span className="w-3 h-[3px] rounded" style={{ background: S[k][1], opacity: show[k] ? 1 : 0.3 }} />{S[k][0]}</button>)}
        <div className="flex rounded-md border border-border overflow-hidden ml-2">{[1, 5, 15, 30].map(w => <button key={w} onClick={() => { setWin(w); setZoom(null); }} className={`h-7 px-2.5 text-[12px] whitespace-nowrap ${win === w && !zoom ? 'bg-[var(--app-accent)] text-white' : 'text-ink-2 hover:bg-surface-2'}`}>{w} min</button>)}</div>
        {zoom && <Btn onClick={() => setZoom(null)}>{t('Réinitialiser zoom')}</Btn>}
        <Btn onClick={onFull}>{full ? t('Quitter') : '⤢'}</Btn>
      </div>
    </div>
    <div className="px-4 pt-3 flex gap-8 text-[12px]">{['dl', 'ul'].map(k => { const s = stats(k); return <div key={k} className="flex items-baseline gap-3"><span className="font-semibold" style={{ color: S[k][1] }}>{S[k][0]}</span><span className="text-[20px] font-semibold tabular-nums whitespace-nowrap text-foreground">{s ? fmtRate(s.cur) : '—'}</span>{s && <span className="text-subtle tabular-nums whitespace-nowrap text-[11.5px]">min {fmtRate(s.min)} · max {fmtRate(s.max)} · moy {fmtRate(s.avg)}</span>}</div>; })}
      <span className="ml-auto text-[11.5px] text-subtle">{!running && tracking ? t('Affichage en pause — acquisition continue') : tracking ? `${t('Retard import')} ${delay} s` : ''}</span></div>
    <div className="p-2 relative">
      {!tracking || pts.length < 2 ? <div className="grid place-items-center text-[12.5px] text-subtle" style={{ height: H }}>{tracking ? t('En attente de mesures GTP-U…') : t('Aucune mesure — aucun UE suivi.')}</div> :
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height: H }} preserveAspectRatio="none"
          onPointerDown={e => setDragSel([toTs(e), toTs(e)])} onPointerMove={e => { const ts = toTs(e); if (dragSel) setDragSel([dragSel[0], ts]); const p = pts.reduce((a, b) => Math.abs(b.ts - ts) < Math.abs(a.ts - ts) ? b : a, pts[0]); setHover(p); }}
          onPointerUp={() => { if (dragSel && Math.abs(dragSel[1] - dragSel[0]) > 2000) setZoom([Math.min(...dragSel), Math.max(...dragSel)]); setDragSel(null); }} onPointerLeave={() => { setHover(null); setDragSel(null); }}>
          {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}><line x1={L} x2={W - R} y1={Y(ymax * f)} y2={Y(ymax * f)} stroke="#F2F2F2" /><text x={L - 6} y={Y(ymax * f) + 3} fontSize="10" textAnchor="end" fill="#A3A3A3">{fmtRate(ymax * f)}</text></g>)}
          {[0, 0.25, 0.5, 0.75, 1].map(f => { const ts = lo + (hi - lo) * f; return <text key={f} x={X(ts)} y={H - 8} fontSize="10" textAnchor="middle" fill="#A3A3A3">{new Date(ts).toLocaleTimeString('fr-FR')}</text>; })}
          {show.dl && <><path d={`${path('dl')} L${X(pts[pts.length - 1].ts)},${H - B} L${X(pts[0].ts)},${H - B} Z`} fill="var(--app-accent)" opacity="0.07" /><path d={path('dl')} fill="none" stroke="var(--app-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
          {show.ul && <path d={path('ul')} fill="none" stroke="#A15C07" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />}
          {dragSel && <rect x={Math.min(X(dragSel[0]), X(dragSel[1]))} y={T} width={Math.abs(X(dragSel[1]) - X(dragSel[0]))} height={H - T - B} fill="var(--app-accent)" opacity="0.1" />}
          {hover && <line x1={X(hover.ts)} x2={X(hover.ts)} y1={T} y2={H - B} stroke="#A3A3A3" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>}
      {hover && tracking && <div className="absolute top-3 right-6 bg-white border border-border rounded-md shadow-sm px-3 py-2 text-[11.5px] pointer-events-none"><div className="font-mono text-subtle">{new Date(hover.ts).toLocaleTimeString('fr-FR')}</div><div><span style={{ color: 'var(--app-accent)' }}>DL</span> {fmtRate(hover.dl)}</div><div><span className="text-warning">UL</span> {fmtRate(hover.ul)}</div><div className="text-subtle">{t('source GTP-U, 1 s')}</div></div>}
      {tracking && <div className="px-2 text-[11px] text-subtle">{t('Glissez sur le graphique pour zoomer sur une plage.')}</div>}
    </div>
  </div>;
}

function UeInfo({ t, ue, res, tracking, msgs, onHide }) {
  const last = msgs[msgs.length - 1]; const lastFail = [...msgs].reverse().find(m => m.res === 'Échec');
  const reg = msgs.find(m => /Registration Accept|Attach Accept/.test(m.name)); const pdu = [...msgs].reverse().find(m => /PDU Session Establishment (Accept|Reject)|Create Session Response/.test(m.name));
  const Row = ({ n, v, s }) => <div className="flex items-baseline gap-2 py-[5px] text-[12px]"><span className="w-[120px] shrink-0 text-subtle">{n}</span>{v ? <span className="text-foreground font-mono text-[11.5px] break-all" title={s ? 'preuve : seq ' + s : ''}>{v}</span> : <span className="text-subtle italic">{t('Non disponible')}</span>}{v && s && <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--app-accent)]">#{s}</span>}</div>;
  const Sec = ({ title, children }) => <div className="px-4 py-2.5 border-b border-border-subtle"><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-1">{t(title)}</div>{children}</div>;
  const [proof, setProof] = useState(false);
  const I = ue?.info || {}; const clearIdentities={...(res?.identities??{}),...I}; const has = (k) => { const v = I[k]; if (!tracking || !v || !v[0]) return [null, null]; if (v[1] == null) return v; const need = v[1] < 1000 ? v[1] + 400 : v[1]; return msgs.some(m => m.seq >= need) ? [v[0], need] : [null, null]; };
  return <div className={card + ' overflow-hidden'}>
    <div className="h-10 px-4 flex items-center gap-2 border-b border-border-subtle"><h3 className="text-[13px] font-semibold">UE Info</h3>{tracking && <span className="text-[11px] text-subtle">{t('màj')} {last?.ts}</span>}<button onClick={onHide} className="ml-auto text-[12px] text-subtle hover:text-foreground">⟩</button></div>
    {!tracking ? <div className="px-4 py-6 text-[12.5px] text-subtle">{t('Aucun UE suivi.')}</div> : <>
      <Sec title="Identité">
        <Row n={t('Pseudonyme')} v={res.ue} s={null} />
        {[['IMSI / SUPI','subscriber'],['TMSI / GUTI','temporary'],['S-TMSI','s_tmsi'],['M-TMSI','m_tmsi'],['IMEI(SV) / PEI','equipment'],['MSISDN / GPSI','directory']].map(([label,kind])=><Row key={kind} n={label} v={observedIdentity(clearIdentities,kind)} s={null}/>)}
        <div className="flex items-center gap-2 py-1 text-[12px]"><span className="w-[120px] text-subtle">{t('Rattachement')}</span><Tag c={res.st === 'Trouvé' ? '#15803D' : '#A15C07'}>{res.st === 'Trouvé' ? 'EXACT' : 'OUVERT'}</Tag><button onClick={() => setProof(!proof)} className="ml-auto text-[11px] text-[var(--app-accent)]">{proof ? t('masquer') : t('preuve')}</button></div>
        {proof && <div className="text-[11px] text-ink-2 bg-surface-2 rounded p-2 mb-1">{ue.proof}</div>}
      </Sec>
      <Sec title="Réseau radio">{['Technologie', 'PLMN', 'Site', 'Cell Name', ue.tech === 'LTE' ? 'ECGI' : 'NR-CGI', 'TAC', ue.tech === 'LTE' ? 'eNB ID' : 'gNB ID'].map(k => { const [v, s] = has(k); return <Row key={k} n={k} v={v} s={s} />; })}</Sec>
      <Sec title="Cœur réseau">{(ue.tech === 'LTE' ? ['MME', 'SGW', 'APN', 'Bearer ID', 'QCI'] : ['AMF', 'SMF', 'UPF', 'DNN', 'S-NSSAI', 'PDU Session ID', '5QI', 'QFI']).map(k => { const [v, s] = has(k); return <Row key={k} n={k} v={v} s={s} />; })}</Sec>
      <Sec title="État UE">
        <Row n={ue.tech === 'LTE' ? 'Attach' : 'Registration'} v={reg ? 'REGISTERED' : msgs.length ? t('en cours') : null} s={reg?.seq} />
        <Row n="RM / CM" v={null} />
        <Row n={ue.tech === 'LTE' ? 'Bearer' : 'PDU Session'} v={pdu ? (pdu.res === 'Échec' ? 'REJECTED' : 'ACTIVE') : null} s={pdu?.seq} />
        <Row n={t('Dernière procédure')} v={last?.proc} s={last?.seq} />
        <Row n={t('Dernier message')} v={last?.name} s={last?.seq} />
        <Row n={t('Dernier échec')} v={lastFail?.cause} s={lastFail?.seq} />
      </Sec></>}
  </div>;
}

function Procedures({ t, msgs, tracking, onGo }) {
  const list = useMemo(() => { const out = []; const open = {};
    msgs.forEach(m => { let p = open[m.proc]; if (!p || m.kind === 'start' && p.status !== 'En cours') { p = { name: m.proc, start: m, status: 'En cours', last: m, cause: '' }; open[m.proc] = p; out.push(p); }
      p.last = m; if (m.res === 'Échec') { p.status = 'Échec'; p.cause = m.cause; } else if (m.kind === 'end' && p.status === 'En cours') p.status = 'Succès'; });
    return out.reverse(); }, [msgs]);
  const C = { 'En cours': '#0062A1', 'Succès': '#15803D', 'Échec': '#B42318', 'Incomplète': '#8F8F8F' };
  return <div className={card + ' overflow-hidden'}>
    <div className="h-10 px-4 flex items-center border-b border-border-subtle"><h3 className="text-[13px] font-semibold">UE Procedure Updates</h3><span className="ml-auto text-[11px] text-subtle">{list.length}</span></div>
    <div className="max-h-[320px] overflow-auto scroll-thin">{!tracking || !list.length ? <div className="px-4 py-4 text-[12px] text-subtle">{t('Aucune procédure observée.')}</div> :
      list.map((p, i) => <button key={i} onClick={() => onGo(p.last.seq)} className="w-full text-left px-4 py-2 border-b border-border-subtle hover:bg-surface-2 flex items-start gap-2.5">
        <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${p.status === 'En cours' ? 'animate-pulse' : ''}`} style={{ background: C[p.status] }} />
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[12.5px] font-medium text-foreground truncate">{p.name}</span><span className="ml-auto text-[11px] font-medium" style={{ color: C[p.status] }}>{t(p.status)}</span></span>
          <span className="block text-[11px] text-subtle truncate font-mono">{p.start.cap}·{p.start.seq}→{p.last.seq} · {p.last.ts}</span>
          <span className="block text-[11px] text-muted-foreground truncate">{p.last.name}{p.cause && <span className="text-danger"> · {p.cause}</span>}</span></span>
      </button>)}</div>
  </div>;
}
