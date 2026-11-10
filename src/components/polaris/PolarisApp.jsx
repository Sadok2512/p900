import React, { useState, useMemo, useEffect, useRef } from 'react';

/* Données fictives — PLMN de test 001/01. Tri canonique (capture_id, seq). */
const IFC = {
  'N2':['#1D4ED8','#EFF4FF'],'SBI':['#6D28D9','#F4F0FF'],'N4':['#A15C07','#FDF6E7'],'N3':['#15803D','#ECF8F0'],
  'S1-MME':['#1D4ED8','#EFF4FF'],'S6a':['#BE185D','#FDEEF5'],'S11':['#A15C07','#FDF6E7'],'S5-C':['#A15C07','#FDF6E7'],'S1-U':['#15803D','#ECF8F0'],
};
const N5 = ['gNB','AMF','AUSF/UDM','SMF','UPF'];
const N4n = ['eNB','MME','HSS','SGW-C','PGW-C','SGW-U'];
const nodeIdx = (nodes, n) => nodes.indexOf(n==='AUSF'||n==='UDM' ? 'AUSF/UDM' : n);

const OK5 = { nodes:N5, procs:[['Registration',0,8],['PDU Session',9,18],['Trafic',19,20]],
  summary:'Registration et PDU Session réussies. Plan usager actif dans les deux sens.',
  msgs:[
    ['N2','NGAP InitialUEMessage','gNB → AMF','Registration Request'],
    ['SBI','Nausf UEAuthentication POST','AMF → AUSF'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','Authentication Request'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','Authentication Response'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','Security Mode Command'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','Security Mode Complete'],
    ['SBI','Nudm SDM Get am-data','AMF → UDM'],
    ['N2','NGAP InitialContextSetupRequest','AMF → gNB','Registration Accept'],
    ['N2','NGAP InitialContextSetupResponse','gNB → AMF'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','PDU Session Establishment Request'],
    ['SBI','Nsmf CreateSMContext','AMF → SMF',null,'smContextRef','ctx-1'],
    ['N4','PFCP Session Establishment Request','SMF → UPF',null,'SEID','0x3a1'],
    ['N4','PFCP Session Establishment Response','UPF → SMF',null,'UL F-TEID','0x0000a1f2'],
    ['SBI','Namf N1N2MessageTransfer','SMF → AMF',null,'UL TEID','0x0000a1f2'],
    ['N2','NGAP PDUSessionResourceSetupRequest','AMF → gNB','PDU Session Establishment Accept','UL TEID','0x0000a1f2'],
    ['N2','NGAP PDUSessionResourceSetupResponse','gNB → AMF',null,'DL TEID','0x00000b07'],
    ['SBI','Nsmf UpdateSMContext','AMF → SMF',null,'DL TEID','0x00000b07'],
    ['N4','PFCP Session Modification Request','SMF → UPF',null,'DL F-TEID','0x00000b07'],
    ['N4','PFCP Session Modification Response','UPF → SMF'],
    ['N3','GTP-U G-PDU ×1 248 (UL)','gNB → UPF',null,'TEID','0x0000a1f2'],
    ['N3','GTP-U G-PDU ×3 902 (DL)','UPF → gNB',null,'TEID','0x00000b07'],
  ],
  links:[[12,14,'N4','N2','UL TEID 0x0000a1f2','EXACT'],[12,19,'N4','N3','UL TEID 0x0000a1f2','EXACT'],[17,20,'N4','N3','DL TEID 0x00000b07','EXACT'],[13,14,'SBI','N2','n2SmInfo UL TEID','À PROUVER'],[10,11,'SBI','N4','smContextRef ↔ SEID','À PROUVER']],
};
const KO5 = { nodes:N5, procs:[['PDU Session',0,5]],
  summary:'PDU Session refusée par le SMF — 5GSM #27 Missing or unknown DNN.',
  diverge:'Première divergence au message 5 : attendu PFCP Session Establishment Request (N4), observé CreateSMContext 403 (SBI).',
  msgs:[
    ['N2','NGAP UplinkNASTransport','gNB → AMF','PDU Session Establishment Request'],
    ['SBI','Nsmf CreateSMContext','AMF → SMF',null,'smContextRef','ctx-7'],
    ['SBI','Nudm SDM Get sm-data','SMF → UDM'],
    ['SBI','Nudm SDM 200 (DNN absent)','UDM → SMF'],
    ['SBI','Nsmf CreateSMContext 403','SMF → AMF',null,'cause 5GSM','#27'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','PDU Session Establishment Reject #27'],
  ],
  links:[[1,null,'SBI','N4','smContextRef → SEID','ABSENT']],
};
const LTE = { nodes:N4n, procs:[['Attach',0,15],['Bearer par défaut',9,17],['Trafic',18,19]],
  summary:'Attach et bearer par défaut réussis. Les 5 liens attendus sont prouvés.',
  msgs:[
    ['S1-MME','S1AP InitialUEMessage','eNB → MME','Attach Request'],
    ['S6a','Diameter AIR','MME → HSS',null,'Session-Id','d1'],
    ['S6a','Diameter AIA 2001','HSS → MME',null,'Session-Id','d1'],
    ['S1-MME','S1AP DownlinkNASTransport','MME → eNB','Authentication Request'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Authentication Response'],
    ['S1-MME','S1AP DownlinkNASTransport','MME → eNB','Security Mode Command'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Security Mode Complete'],
    ['S6a','Diameter ULR','MME → HSS',null,'Session-Id','d2'],
    ['S6a','Diameter ULA 2001','HSS → MME',null,'Session-Id','d2'],
    ['S11','GTPv2 Create Session Request','MME → SGW-C'],
    ['S5-C','GTPv2 Create Session Request','SGW-C → PGW-C'],
    ['S5-C','GTPv2 Create Session Response 16','PGW-C → SGW-C'],
    ['S11','GTPv2 Create Session Response 16','SGW-C → MME',null,'S1-U F-TEID','0x00001c3a'],
    ['S1-MME','S1AP InitialContextSetupRequest','MME → eNB','Attach Accept','UL TEID','0x00001c3a'],
    ['S1-MME','S1AP InitialContextSetupResponse','eNB → MME',null,'eNB F-TEID','0x0000e214'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Attach Complete'],
    ['S11','GTPv2 Modify Bearer Request','MME → SGW-C',null,'eNB F-TEID','0x0000e214'],
    ['S11','GTPv2 Modify Bearer Response 16','SGW-C → MME'],
    ['S1-U','GTP-U G-PDU ×812 (UL)','eNB → SGW-U',null,'TEID','0x00001c3a'],
    ['S1-U','GTP-U G-PDU ×2 640 (DL)','SGW-U → eNB',null,'TEID','0x0000e214'],
  ],
  links:[[12,13,'S11','S1-MME','UL TEID 0x00001c3a','EXACT'],[12,18,'S11','S1-U','UL TEID 0x00001c3a','EXACT'],[14,16,'S1-MME','S11','eNB TEID 0x0000e214','EXACT'],[16,19,'S11','S1-U','eNB TEID 0x0000e214','EXACT'],[1,7,'S6a','S6a','Session-Id','EXACT']],
};
const SESS = [
  {id:1,cap:41,seq:18204,ue:'UE-7f3a',imsi:'001010000000101',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'412 ms',d:OK5},
  {id:2,cap:41,seq:18877,ue:'UE-2c90',imsi:'001010000000102',rat:'LTE',proc:'Attach + bearer par défaut',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'5/5',comp:100,dur:'538 ms',d:LTE},
  {id:3,cap:41,seq:20511,ue:'UE-9b14',imsi:'001010000000103',rat:'5G SA',proc:'PDU Session',res:'Échec',cause:'5GSM #27 Missing or unknown DNN',cell:'gNB-1 / 0x001',ex:'0/1',comp:100,dur:'96 ms',d:KO5},
  {id:4,cap:42,seq:311,ue:'UE-7f3a',imsi:'001010000000101',rat:'5G SA',proc:'Service Request',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/3',comp:92,dur:'58 ms',d:OK5},
  {id:5,cap:42,seq:1290,ue:'UE-51de',imsi:'001010000000104',rat:'LTE',proc:'Attach',res:'Échec',cause:'S6a 5001 USER_UNKNOWN',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'38 ms',d:LTE},
  {id:6,cap:42,seq:2044,ue:'UE-2c90',imsi:'001010000000102',rat:'LTE',proc:'Tracking Area Update',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'44 ms',d:LTE},
  {id:7,cap:42,seq:3315,ue:'UE-c6e2',imsi:'001010000000105',rat:'5G SA',proc:'Registration',res:'Échec',cause:'5GMM #7 5GS services not allowed',cell:'gNB-1 / 0x001',ex:'0/1',comp:88,dur:'71 ms',d:KO5},
  {id:8,cap:42,seq:4102,ue:'UE-0ae7',imsi:'001010000000106',rat:'LTE',proc:'Dedicated Bearer Activation',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'4/4',comp:100,dur:'120 ms',d:LTE},
  {id:9,cap:43,seq:77,ue:'UE-9b14',imsi:'001010000000103',rat:'5G SA',proc:'Deregistration',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/2',comp:100,dur:'64 ms',d:OK5},
  {id:10,cap:43,seq:812,ue:'UE-51de',imsi:'001010000000104',rat:'LTE',proc:'Detach',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'31 ms',d:LTE},
  {id:11,cap:43,seq:1555,ue:'UE-44f0',imsi:'001010000000107',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'398 ms',d:OK5},
  {id:12,cap:43,seq:2210,ue:'UE-0ae7',imsi:'001010000000106',rat:'LTE',proc:'E-RAB Release',res:'Succès',cause:'S1AP radio #20 user-inactivity',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'22 ms',d:LTE},
];
const FIELDS = [
  ['Résultat',['Succès','Échec']],['RAT',['5G SA','LTE']],
  ['Procédure',['Registration','PDU Session','Service Request','Attach','Tracking Area Update','Detach','Deregistration','E-RAB Release']],
  ['Cause',['5GSM #27','5GMM #7','S6a 5001','S1AP radio #20']],
  ['Interface',['N2','SBI','N4','N3','S1-MME','S6a','S11','S1-U']],['Cellule',['gNB-1','eNB-1']],['UE',['UE-7f3a','UE-9b14','UE-2c90','UE-51de']],
];
const test = (s,[k,v]) => ({
  'Résultat':()=>s.res===v,'RAT':()=>s.rat===v,'Procédure':()=>s.proc.includes(v),'Cause':()=>s.cause.includes(v),
  'Interface':()=>s.d.msgs.some(m=>m[0]===v),'Cellule':()=>s.cell.includes(v),'UE':()=>s.ue===v,
}[k] || (()=>true))();

/* ------------------------------------------------------------------ */
const I = ({d,c='w-4 h-4'}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={c}><path d={d}/></svg>;
const ic = {
  search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35', x:'M18 6 6 18M6 6l12 12', plus:'M12 5v14M5 12h14',
  cols:'M4 5h16v14H4zM10 5v14M16 5v14', dl:'M12 4v11m0 0-4-4m4 4 4-4M5 20h14', lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  play:'M7 5l12 7-12 7z', star:'M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z', chev:'m6 9 6 6 6-6',
  lens:'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', pin:'M9 4h6l-1 6 4 3H6l4-3zM12 13v7',
  split:'M4 5h16v14H4zM12 5v14',
};
const Tag = ({i}) => <span className="inline-block font-mono text-[10.5px] font-semibold leading-none rounded-[3px] px-1.5 py-[3px]" style={{color:IFC[i][0],background:IFC[i][1]}}>{i}</span>;
const Res = ({r}) => <span className="inline-flex items-center gap-1.5"><span className={`w-[7px] h-[7px] rounded-full ${r==='Succès'?'bg-[#15803D]':'bg-[#C2410C]'}`}/>{r}</span>;
const Stat = ({s}) => {
  const m = {'EXACT':'text-[#15803D] bg-[#ECF8F0] border-[#BFE5CC]','À PROUVER':'text-[#A15C07] bg-[#FDF6E7] border-[#F1D9A8]','ABSENT':'text-[#B42318] bg-[#FDEFEE] border-[#F5C6C2]'}[s];
  return <span className={`inline-block text-[10.5px] font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px] ${m}`}>{s}</span>;
};
const Lbl = ({children}) => <div className="text-[11px] font-semibold text-[#666666] uppercase tracking-[0.06em] mb-1.5">{children}</div>;

function TopBar({role,setRole,page,setPage,onAnalyzer,accent,onSettings}) {
  return (
    <header className="h-12 shrink-0 bg-white border-b border-[#EBEBEB] flex items-center px-4 gap-6">
      <div className="flex items-center gap-2">
        <div style={{background:accent}} className="w-6 h-6 rounded-[5px] grid place-items-center"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" fill="#fff"/></svg></div>
        <span className="text-[14px] font-semibold tracking-tight text-[#171717]">POLARIS</span>
      </div>
      <nav className="flex h-full">
        {[['home','Accueil'],['sessions','Analyzer'],['nodes','Nœuds'],['kpi','KPI'],['live','Live'],['trafic','Trafic']].map(([k,n]) => {
          const on = page===k, ok = k==='home'||k==='sessions'||k==='nodes';
          return <button key={k} type="button" onClick={()=>{ if(ok) { setPage(k); if(k==='sessions' && onAnalyzer) onAnalyzer(); } }} className={`relative px-3 h-full flex items-center text-[13px] ${ok?'cursor-pointer':'cursor-default'} ${on?'text-[#171717] font-semibold':'text-[#666666] hover:text-[#171717]'}`}>{n}{on && <span style={{background:accent}} className="absolute inset-x-3 bottom-0 h-[2px]"/>}</button>;
        })}
      </nav>
      <div className="flex-1 max-w-[420px] h-8 rounded-md border border-[#EBEBEB] bg-[#FAFAFA] flex items-center gap-2 px-2.5 text-[13px] text-[#8F8F8F]">
        <I d={ic.search} c="w-[15px] h-[15px]"/>Rechercher une session, une requête, une commande<kbd className="ml-auto text-[11px] border border-[#EBEBEB] bg-white rounded px-1.5 text-[#666666]">⌘K</kbd>
      </div>
      <div className="ml-auto flex items-center gap-4 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-[#666666]"><span className="w-[7px] h-[7px] rounded-full bg-[#15803D]"/>Données à jour · retard 4 s</span>
        <div className="flex rounded-md border border-[#EBEBEB] p-[2px] bg-[#FAFAFA]">
          {['viewer','operator'].map(r => <button key={r} onClick={()=>setRole(r)} className={`px-2.5 h-6 rounded-[4px] text-[12px] ${role===r ? (r==='operator'?'bg-[#A15C07] text-white':'bg-white text-[#171717] shadow-sm') : 'text-[#666666]'}`}>{r==='operator'?'operator':'viewer'}</button>)}
        </div>
        <button type="button" onClick={onSettings} title="Paramètres" style={{background:accent}} className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold text-white hover:opacity-90">SD</button>
      </div>
    </header>
  );
}

function Tabs({onHome}) {
  const t = [['Requête','Échecs · run 482',true],['Session','UE-9b14 · PDU Session'],['Comparaison','UE-9b14 ↔ UE-7f3a'],['Trace','UE-7f3a',false,true]];
  return (
    <div className="h-9 shrink-0 bg-[#FAFAFA] border-b border-[#EBEBEB] flex items-end px-2 gap-px">
      <button onClick={onHome} className="h-8 px-3 flex items-center gap-1.5 text-[12.5px] text-[#666666] hover:text-[#171717] rounded-t-md hover:bg-white/60"><I d={ic.cols} c="w-3.5 h-3.5"/>Requêtes</button>
      <span className="w-px h-4 bg-[#EBEBEB] mb-2 mx-1"/>
      {t.map(([k,n,a,live]) => (
        <div key={n} className={`h-8 px-3 flex items-center gap-2 text-[12.5px] rounded-t-md border border-b-0 ${a?'bg-white border-[#EBEBEB] text-[#171717]':'border-transparent text-[#666666] hover:bg-white/60'}`}>
          {live && <span className="w-[6px] h-[6px] rounded-full bg-[#15803D]"/>}
          <span className="text-[11px] text-[#8F8F8F]">{k}</span><span className={a?'font-medium':''}>{n}</span>
          <I d={ic.x} c="w-3 h-3 text-[#8F8F8F]"/>
        </div>
      ))}
      <button className="h-8 w-8 grid place-items-center text-[#666666]"><I d={ic.plus}/></button>
      <button className="ml-auto mb-1 h-7 px-2 flex items-center gap-1.5 text-[12px] text-[#666666] hover:text-[#171717]"><I d={ic.split} c="w-3.5 h-3.5"/>Vue partagée</button>
    </div>
  );
}

function QueryPanel({conds,setConds}) {
  const [tpl,setTpl] = useState('Parcourir');
  const [adding,setAdding] = useState(false);
  const [f,setF] = useState(FIELDS[0][0]);
  const [v,setV] = useState(FIELDS[0][1][0]);
  const vals = (FIELDS.find(x=>x[0]===f)||FIELDS[0])[1];
  return (
    <aside className="w-[264px] shrink-0 bg-white border-r border-[#EBEBEB] flex flex-col">
      <div className="p-4 space-y-5 overflow-auto scroll-thin flex-1">
        <div><Lbl>Gabarit</Lbl>
          <div className="grid grid-cols-4 rounded-md border border-[#EBEBEB] p-[2px] bg-[#FAFAFA]">
            {['Trace','Parcourir','Inspecter','Capture'].map(t => <button key={t} onClick={()=>setTpl(t)} className={`h-6 rounded-[4px] text-[11.5px] ${tpl===t?'bg-white text-[#171717] shadow-sm font-medium':'text-[#666666]'}`}>{t}</button>)}
          </div>
        </div>
        <div><Lbl>Portée</Lbl>
          <div className="h-8 rounded-md border border-[#EBEBEB] px-2.5 flex items-center text-[13px]">Run 5G #482<span className="ml-auto text-[#8F8F8F] font-mono text-[11.5px]">c41 → c43</span><I d={ic.chev} c="w-3.5 h-3.5 ml-1.5 text-[#8F8F8F]"/></div>
        </div>
        <div><Lbl>Conditions</Lbl>
          <div className="space-y-1.5">
            {conds.map((c,i) => (
              <div key={i} className="flex items-center h-8 rounded-md border border-[#EBEBEB] text-[12.5px] overflow-hidden">
                <span className="px-2 h-full flex items-center bg-[#FAFAFA] border-r border-[#EBEBEB] text-[#666666]">{c[0]}</span>
                <span className="px-2 text-[#8F8F8F]">=</span>
                <span className="flex-1 truncate font-medium">{c[1]}</span>
                <button onClick={()=>setConds(conds.filter((_,j)=>j!==i))} className="w-7 h-full grid place-items-center text-[#8F8F8F] hover:text-[#B42318]"><I d={ic.x} c="w-3.5 h-3.5"/></button>
              </div>
            ))}
            {adding ? (
              <div className="rounded-md border border-[#171717] p-2 space-y-1.5 bg-[#FAFAFA]">
                <select value={f} onChange={e=>{setF(e.target.value); setV(FIELDS.find(x=>x[0]===e.target.value)[1][0]);}} className="w-full h-7 rounded border border-[#EBEBEB] text-[12.5px] px-1.5 bg-white">{FIELDS.map(x=><option key={x[0]}>{x[0]}</option>)}</select>
                <select value={v} onChange={e=>setV(e.target.value)} className="w-full h-7 rounded border border-[#EBEBEB] text-[12.5px] px-1.5 bg-white">{vals.map(x=><option key={x}>{x}</option>)}</select>
                <div className="flex gap-1.5"><button onClick={()=>{setConds([...conds,[f,v]]); setAdding(false);}} className="flex-1 h-7 rounded bg-[#171717] text-white text-[12px] font-medium">Ajouter</button><button onClick={()=>setAdding(false)} className="h-7 px-2 rounded border border-[#EBEBEB] text-[12px] bg-white">Annuler</button></div>
              </div>
            ) : <button onClick={()=>setAdding(true)} className="w-full h-8 rounded-md border border-dashed border-[#D4D4D4] text-[12.5px] text-[#666666] hover:border-[#171717] hover:text-[#171717] flex items-center justify-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter une condition</button>}
            <div className="flex items-center gap-1.5 pt-1 text-[11.5px] text-[#8F8F8F]"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator uniquement</div>
          </div>
        </div>
        <div><Lbl>Regrouper par</Lbl>
          <div className="h-8 rounded-md border border-[#EBEBEB] px-2.5 flex items-center text-[13px] text-[#8F8F8F]">Aucun<I d={ic.chev} c="w-3.5 h-3.5 ml-auto"/></div>
        </div>
        <button className="w-full h-8 rounded-md bg-[#171717] hover:bg-[#383838] text-white text-[13px] font-medium flex items-center justify-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter</button>
        <div className="border-t border-[#F2F2F2] pt-4"><Lbl>Requêtes enregistrées</Lbl>
          {['Échecs · run 482','PDU Session 5G · toutes causes','Attach LTE · certification','Liens à prouver SBI'].map((q,k) => (
            <div key={q} className="flex items-center gap-2 h-7 px-1 rounded text-[12.5px] text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.star} c={`w-3.5 h-3.5 ${k<2?'text-[#A15C07]':'text-[#D4D4D4]'}`}/>{q}</div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Grid({rows,sel,setSel,role,conds,setConds,onEdit}) {
  const [txt,setTxt] = useState('');
  const ko = rows.filter(r=>r.res==='Échec').length;
  const cols = ['capture · seq','UE','RAT','Procédure','Résultat','Cause','Interfaces','Liens EXACT','Compl.','Durée','Cellule','IMSI'];
  return (
    <section className="flex flex-col min-h-0 bg-white border-b border-[#EBEBEB]" style={{height:'44%'}}>
      <div className="h-11 shrink-0 flex items-center gap-3 px-3 border-b border-[#EBEBEB]">
        <div className="flex-1 h-8 rounded-md border border-[#EBEBEB] flex items-center gap-1.5 px-2 focus-within:border-[#171717]">
          <I d={ic.search} c="w-[15px] h-[15px] text-[#8F8F8F]"/>
          {conds.map((c,i) => <span key={i} className="flex items-center gap-1 h-6 rounded-[4px] bg-[#F2F2F2] border border-[#E5E5E5] pl-1.5 pr-1 text-[12px] text-[#171717] whitespace-nowrap"><span className="text-[#8F8F8F]">{c[0]}</span>{c[1]}<button onClick={()=>setConds(conds.filter((_,j)=>j!==i))}><I d={ic.x} c="w-3 h-3"/></button></span>)}
          <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&txt){ const f=FIELDS.find(x=>x[1].some(v=>v.toLowerCase()===txt.toLowerCase())); if(f){ setConds([...conds,[f[0],f[1].find(v=>v.toLowerCase()===txt.toLowerCase())]]); setTxt(''); } } }}
            placeholder="Filtrer : tape Échec, LTE, N4, 5GSM #27… puis Entrée" className="flex-1 min-w-[160px] outline-none text-[13px] placeholder:text-[#8F8F8F]"/>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[#666666]">
          <span className="font-semibold text-[#171717] tabular-nums">{rows.length}</span> sessions
          <div className="w-16 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden flex"><div className="bg-[#15803D]" style={{width:`${rows.length?(rows.length-ko)/rows.length*100:0}%`}}/><div className="bg-[#C2410C]" style={{width:`${rows.length?ko/rows.length*100:0}%`}}/></div>
          <span className="tabular-nums">{ko} échecs</span>
        </div>
        <button onClick={onEdit} className="h-8 px-2.5 rounded-md border border-[#EBEBEB] text-[12.5px] flex items-center gap-1.5 text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.search} c="w-3.5 h-3.5"/>Modifier la requête</button>
        <button className="h-8 px-2.5 rounded-md border border-[#EBEBEB] text-[12.5px] flex items-center gap-1.5 text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.cols} c="w-3.5 h-3.5"/>Colonnes</button>
        <button className="h-8 px-2.5 rounded-md border border-[#EBEBEB] text-[12.5px] flex items-center gap-1.5 text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.dl} c="w-3.5 h-3.5"/>Exporter</button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full text-[12.5px] whitespace-nowrap border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>{cols.map((c,k) => <th key={c} className="h-8 px-3 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{c==='IMSI' ? <span className="inline-flex items-center gap-1"><I d={ic.lock} c="w-3 h-3"/>IMSI</span> : c}{k===0 && <span className="ml-1 text-[#171717]">↑</span>}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const on = sel===r.id;
              return (
                <tr key={r.id} onClick={()=>setSel(r.id)} className={`cursor-pointer ${on?'bg-[#F2F2F2]':'hover:bg-[#FAFAFA]'}`}>
                  <td className={`h-7 px-3 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666] ${on?'shadow-[inset_2px_0_0_#171717]':''}`}>c{r.cap} · {r.seq}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px] text-[#171717]">{r.ue}</td>
                  <td className="px-3 border-b border-[#F2F2F2]">{r.rat}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#171717]">{r.proc}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><Res r={r.res}/></td>
                  <td className={`px-3 border-b border-[#F2F2F2] ${r.res==='Échec'?'text-[#B42318]':'text-[#666666]'}`}>{r.cause || '—'}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><span className="flex gap-1">{[...new Set(r.d.msgs.map(m=>m[0]))].map(i=><Tag key={i} i={i}/>)}</span></td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px]">{r.ex}</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums">{r.comp} %</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums text-[#666666]">{r.dur}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#666666]">{r.cell}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[11.5px]">{role==='operator' ? <span className="text-[#A15C07]">{r.imsi}</span> : <span className="text-[#D4D4D4]">masqué</span>}</td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-[#666666]">Aucune session ne correspond à ces {conds.length} conditions. Retire une condition pour élargir.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Ladder({d,sel,setSel,lens}) {
  const W = 760, LG = 150, n = d.nodes.length, ROW = 26, TOP = 40;
  const x = k => LG + 30 + k*((W-LG-80)/(n-1));
  const H = TOP + d.msgs.length*ROW + 12;
  return (
    <svg width={W} height={H} className="block select-none">
      {d.procs.map(([p,a,b],k) => <g key={p}><rect x={8 + k*0} y={TOP + a*ROW + 2} width="4" height={(b-a+1)*ROW - 4} rx="2" fill="#171717" opacity={k===0?.9:.45} transform={`translate(${k*8},0)`}/><text x={30 + k*0} y={TOP + a*ROW + 15} fontSize="11" fill="#171717" fontWeight="600" transform={`translate(${k*0},0)`}>{k>0 ? '' : p}</text></g>)}
      {d.nodes.map((nd,k) => <g key={nd}><line x1={x(k)} x2={x(k)} y1="30" y2={H} stroke="#EBEBEB"/><rect x={x(k)-46} y="6" width="92" height="22" rx="4" fill="#fff" stroke="#D4D4D4"/><text x={x(k)} y="21" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#171717">{nd}</text></g>)}
      {d.msgs.map((m,k) => {
        const [a,b] = m[2].split(' → ').map(s=>nodeIdx(d.nodes,s));
        const y = TOP + k*ROW + 16, x1 = x(a), x2 = x(b), dir = x2>x1?1:-1, c = IFC[m[0]][0];
        const on = sel===k, lit = lens && m[5]===lens;
        return (
          <g key={k} onClick={()=>setSel(k)} className="cursor-pointer">
            <rect x="0" y={y-16} width={W} height={ROW} fill={on?'#F2F2F2':lit?'#FDF6E7':'transparent'}/>
            <text x="34" y={y+4} fontSize="10.5" fill="#8F8F8F" fontFamily="Geist Mono">{String(k+1).padStart(2,'0')}</text>
            {d.procs.filter(p=>p[1]===k).map((p,j)=> j===0 && k>0 ? <text key={p[0]} x="58" y={y+4} fontSize="10.5" fill="#171717" fontWeight="600">{p[0]}</text> : null)}
            <line x1={x1} x2={x2 - dir*6} y1={y} y2={y} stroke={c} strokeWidth={on?2:1.25}/>
            <path d={`M${x2},${y} l${-dir*7},-3.5 l0,7 z`} fill={c}/>
            <text x={Math.min(x1,x2)+6} y={y-4} fontSize="11" fill="#171717" fontWeight={on?600:400}>{m[1]}{m[3] ? '  ·  '+m[3] : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Detail({s,sel,setSel,lens}) {
  const [tab,setTab] = useState('Ladder');
  const d = s.d, ex = d.links.filter(l=>l[5]==='EXACT').length;
  return (
    <section className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="px-4 pt-3 pb-2 border-b border-[#EBEBEB]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[#666666]">c{s.cap} · {s.seq}</span>
          <span className="text-[14px] font-semibold text-[#171717]">{s.proc}</span>
          <span className="font-mono text-[12.5px] text-[#4D4D4D]">{s.ue}</span>
          <Res r={s.res}/>
          <span className="ml-auto flex items-center gap-4 text-[12px] text-[#666666]"><span><b className="text-[#171717] tabular-nums">{d.msgs.length}</b> messages</span><span><b className="text-[#171717] tabular-nums">{ex}/{d.links.length}</b> liens EXACT</span><span><b className="text-[#171717] tabular-nums">{s.comp} %</b> complétude</span></span>
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#4D4D4D]">{d.summary}{d.diverge && <span className="ml-2 text-[#B42318]">{d.diverge}</span>}</div>
        <div className="flex gap-5 mt-2 -mb-2">
          {['Ladder','Messages','Corrélation','Plan usager','Comparer'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-8 text-[12.5px] border-b-2 ${tab===t?'border-[#171717] text-[#171717] font-medium':'border-transparent text-[#666666] hover:text-[#171717]'}`}>{t}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {tab==='Ladder' && <Ladder d={d} sel={sel} setSel={setSel} lens={lens}/>}
        {tab==='Messages' && <table className="w-full text-[12.5px]"><tbody>{d.msgs.map((m,k)=>(
          <tr key={k} onClick={()=>setSel(k)} className={`cursor-pointer ${sel===k?'bg-[#F2F2F2]':'hover:bg-[#FAFAFA]'}`}>
            <td className="h-7 px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#8F8F8F] w-12">{k+1}</td><td className="px-2 border-b border-[#F2F2F2] w-20"><Tag i={m[0]}/></td>
            <td className="px-2 border-b border-[#F2F2F2]">{m[1]}{m[3]&&<span className="text-[#666666]"> · {m[3]}</span>}</td><td className="px-2 border-b border-[#F2F2F2] text-[#666666]">{m[2]}</td>
            <td className="px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666]">{m[4]?`${m[4]} ${m[5]}`:''}</td></tr>))}</tbody></table>}
        {tab==='Corrélation' && <table className="w-full text-[12.5px]"><thead><tr>{['De','Vers','Clé','Messages','Statut'].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{h}</th>)}</tr></thead><tbody>{d.links.map((l,k)=>(
          <tr key={k}><td className="h-8 px-4 border-b border-[#F2F2F2]"><Tag i={l[2]}/></td><td className="px-4 border-b border-[#F2F2F2]"><Tag i={l[3]}/></td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px]">{l[4]}</td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px] text-[#666666]">{l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun'}</td><td className="px-4 border-b border-[#F2F2F2]"><Stat s={l[5]}/></td></tr>))}</tbody></table>}
        {(tab==='Plan usager'||tab==='Comparer') && <div className="p-8 text-[13px] text-[#666666]">{tab==='Plan usager' ? 'Volumes UL / DL par TEID, comparés aux règles N4 et aux rapports d’usage PFCP.' : 'Choisis une session réussie de même procédure pour aligner les deux flux et voir le point de bifurcation.'}</div>}
      </div>
    </section>
  );
}

function Inspector({s,sel,role,lens,setLens}) {
  const [tab,setTab] = useState('Décodage');
  const d = s.d, m = d.msgs[Math.min(sel,d.msgs.length-1)];
  const shared = m[5] ? d.msgs.filter(x=>x[5]===m[5]).length : 0;
  return (
    <aside className="w-[340px] shrink-0 bg-white border-l border-[#EBEBEB] flex flex-col">
      <div className="h-10 shrink-0 flex items-end gap-5 px-4 border-b border-[#EBEBEB]">
        {['Décodage','Preuves','Hex','Identité'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-9 text-[12.5px] border-b-2 ${tab===t?'border-[#171717] text-[#171717] font-medium':'border-transparent text-[#666666]'}`}>{t}</button>)}
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-4 text-[12.5px]">
        {tab==='Décodage' && <div className="space-y-4">
          <div><div className="flex items-center gap-2"><Tag i={m[0]}/><span className="font-mono text-[11.5px] text-[#8F8F8F]">message {Math.min(sel,d.msgs.length-1)+1}</span></div>
            <div className="mt-1.5 text-[14px] font-semibold text-[#171717] leading-snug">{m[1]}</div><div className="text-[#666666]">{m[2]}</div></div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 font-mono text-[11.5px]">
            <dt className="text-[#8F8F8F]">capture_id</dt><dd>{s.cap}</dd><dt className="text-[#8F8F8F]">seq</dt><dd>{s.seq+sel*3}</dd>
            <dt className="text-[#8F8F8F]">packet_number</dt><dd>{(s.seq+sel*3)*2+1}</dd><dt className="text-[#8F8F8F]">décodeur</dt><dd>2.10.2</dd>
          </dl>
          <div className="rounded-md border border-[#EBEBEB] bg-[#FAFAFA] p-3 font-mono text-[11.5px] leading-[1.9] text-[#4D4D4D]">
            <div>▾ {m[1].split(' ')[0]} PDU</div>
            <div className="pl-4">▾ {m[1].split(' ').slice(1).join(' ')}</div>
            <div className="pl-8">ue : <span className="text-[#171717]">{s.ue}</span> <span className="text-[#8F8F8F]">(pseudonyme)</span></div>
            {m[3] && <><div className="pl-8">▾ NAS-PDU</div><div className="pl-12">message : <span className="text-[#171717]">{m[3]}</span></div>
              <div className="pl-12">identité : {role==='operator' ? <span className="text-[#A15C07]">{s.imsi}</span> : <span className="text-[#8F8F8F]">masquée</span>}</div></>}
            {m[4] && <div className="pl-8">{m[4]} : <span className="text-[#A15C07]">{m[5]}</span></div>}
          </div>
          {m[5] && <div className="rounded-md border border-[#EBEBEB] p-3">
            <div className="flex items-center gap-2 font-medium text-[#171717]"><I d={ic.lens} c="w-4 h-4 text-[#171717]"/>Lentille de clé</div>
            <div className="text-[#666666] mt-1"><span className="font-mono text-[#A15C07]">{m[5]}</span> apparaît dans {shared} message(s) de la session.</div>
            <button onClick={()=>setLens(lens===m[5]?null:m[5])} className={`mt-2 h-7 px-3 rounded-md text-[12px] font-medium ${lens===m[5]?'border border-[#EBEBEB] text-[#4D4D4D]':'bg-[#171717] text-white'}`}>{lens===m[5]?'Retirer le surlignage':'Surligner dans la session'}</button>
          </div>}
        </div>}
        {tab==='Preuves' && <div className="space-y-2">{d.links.map((l,k)=>(
          <div key={k} className="rounded-md border border-[#EBEBEB] p-3"><div className="flex items-center gap-2"><Tag i={l[2]}/><span className="text-[#8F8F8F]">→</span><Tag i={l[3]}/><span className="ml-auto"><Stat s={l[5]}/></span></div>
          <div className="font-mono text-[11.5px] mt-2 text-[#4D4D4D]">{l[4]}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">messages {l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun message N4'}</div></div>))}</div>}
        {tab==='Hex' && <pre className="font-mono text-[11px] leading-5 text-[#4D4D4D] whitespace-pre-wrap">{`0000  00 0f 40 4b 00 00 05 00 55 00 02 00 01 00 26 00
0010  1a 19 7e 00 41 79 00 0d 01 00 f1 10 00 00 00 00
0020  •• •• •• •• •• 2e 04 f0 f0 f0 f0 00 79 00 13 50
0030  00 f1 10 00 00 00 01 00 f1 10 00 00 01 00 5a 40`}<div className="mt-3 text-[#8F8F8F] font-sans">Octets d’identité masqués en rôle {role}.</div></pre>}
        {tab==='Identité' && (role==='operator' ? <div className="space-y-2">
          <div className="rounded-md border border-[#F1D9A8] bg-[#FDF6E7] p-3 text-[#7A4505]">Rôle operator · consultation journalisée · identités fictives (PLMN 001/01).</div>
          {[['IMSI / SUPI',s.imsi,'SBI Nausf · EXACT'],['5G-GUTI','00101-01-01-•••-0x1a2b','Registration Accept · EXACT']].map(([k,v,p])=><div key={k} className="rounded-md border border-[#EBEBEB] p-3"><div className="text-[11px] uppercase tracking-[0.06em] text-[#666666] font-semibold">{k}</div><div className="font-mono text-[#A15C07] mt-1">{v}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">rattaché par {p}</div></div>)}
        </div> : <div className="text-center py-10 text-[#666666]"><I d={ic.lock} c="w-5 h-5 mx-auto text-[#8F8F8F]"/><div className="mt-2 font-medium text-[#171717]">Identités masquées</div><div className="mt-1">Passe en rôle operator pour voir l’IMSI et sa chaîne de rattachement.</div></div>)}
      </div>
    </aside>
  );
}


/* ------------------------------ ACCUEIL ------------------------------ */
const NODES = [
  {n:'oiran-capture-01',role:'Capture',st:'ok',ver:'OIRAN 2.10.2',exp:'2.10.2',cpu:31,mem:[2.1,4],disk:76,seen:'il y a 2 s',info:'12/12 dumpcap · PID stables'},
  {n:'oiran-import-01',role:'Import et décodage',st:'ok',ver:'OIRAN 2.10.2',exp:'2.10.2',cpu:58,mem:[2.9,4],disk:76,seen:'il y a 2 s',info:'retard 4 s · 0 segment ignoré'},
  {n:'oiran-dataset',role:'Base / dataset',st:'warn',ver:'schéma 7',exp:'7',cpu:22,mem:[1.4,4],disk:76,seen:'il y a 5 s',info:'~1,5 M événements · disque en hausse'},
  {n:'analyzer-api',role:'API Analyzer',st:'ok',ver:'Analyzer 0.1.0',exp:'0.1.0',cpu:9,mem:[0.4,1],disk:41,seen:'il y a 1 s',info:'p95 requête 0,8 s'},
  {n:'polaris-control',role:'Orchestrateur',st:'ok',ver:'API 0.30.0 · sim 0.13.4',exp:'0.30.0',cpu:12,mem:[0.6,2],disk:41,seen:'il y a 3 s',info:'run 5G #482 terminé'},
  {n:'open5gs-core',role:'Cœur 5G / EPC (observé)',st:'ok',ver:'Open5GS 2.8.0',exp:'2.8.0',cpu:null,mem:null,disk:null,seen:'trafic vu il y a 1 s',info:'AMF, SMF, UPF, MME actifs'},
];
const IFACES = ['N2','N3','N4','SBI','N6','S1-MME','S1-U','S5-U','S11','S5-C','S6a','Sxa/Sxb'];
const Dot = ({st}) => <span className={`w-[8px] h-[8px] rounded-full ${st==='ok'?'bg-[#15803D]':st==='warn'?'bg-[#D97706]':'bg-[#B42318]'}`}/>;
const Bar = ({v,warn=70,crit=85}) => <div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden"><div className={`h-full ${v>=crit?'bg-[#B42318]':v>=warn?'bg-[#D97706]':'bg-[#171717]'}`} style={{width:`${v}%`}}/></div><span className="tabular-nums text-[12px] text-[#4D4D4D] w-9">{v} %</span></div>;
const Card = ({title,action,children,className=''}) => (
  <section className={`bg-white rounded-lg border border-[#EBEBEB] ${className}`}>
    <div className="h-11 px-4 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{title}</h3>{action && <span className="ml-auto text-[12px] text-[#171717] font-medium cursor-pointer">{action}</span>}</div>
    {children}
  </section>
);

function Home({setPage}) {
  const [node,setNode] = useState(null);
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
        <div className="flex items-end gap-6">
          <div>
            <div className="text-[12px] text-[#666666]">Mardi 10 novembre · labo POLARIS</div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#171717] mt-1">Plateforme opérationnelle</h1>
            <div className="text-[13px] text-[#666666] mt-1">6 nœuds sur 6 joignables · 1 point de vigilance : disque à 76 % et en hausse.</div>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={()=>setPage('sessions')} className="h-9 px-4 rounded-md bg-[#171717] hover:bg-[#383838] text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.search} c="w-4 h-4"/>Nouvelle recherche</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Ouvrir le dernier run</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Trace live</button>
          </div>
        </div>

        <div className="rounded-lg border border-[#F1D9A8] bg-[#FDF6E7] px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-[#7A4505]">
          <span className="font-semibold">Maintenance planifiée</span>
          <span>Déploiement OIRAN 2.10.2 en cours par ANR1 · la capture n’est pas interrompue · rollback prêt.</span>
          <span className="ml-auto underline cursor-pointer">Détails</span>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {[['Sessions · 24 h','48 112','+6,2 % vs veille','ok'],['Taux de succès','97,4 %','5G SA et LTE','ok'],['Liens EXACT','14 / 18','4 à prouver (SBI)','warn'],['Retard d’import','4 s','seuil 60 s','ok'],['Segments ignorés','0','compteur typé','ok']].map(([l,v,s,t]) => (
            <div key={l} className="bg-white rounded-lg border border-[#EBEBEB] px-4 py-3.5">
              <div className="flex items-center gap-2 text-[12px] text-[#666666]"><Dot st={t}/>{l}</div>
              <div className="text-[24px] font-semibold tracking-tight tabular-nums text-[#171717] mt-1.5">{v}</div>
              <div className="text-[11.5px] text-[#8F8F8F] mt-0.5">{s}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['sessions','POLARIS Analyzer','Rechercher, inspecter et prouver les sessions UE sur toutes les interfaces.','Analyzer 0.1.0 · OIRAN 2.10.2',[['312','sessions dans le dernier run'],['14 / 18','liens EXACT']],ic.search,true],
                ['nodes','POLARIS Nœuds','Installer, superviser et mettre à jour les nœuds de capture, d’import et de base.','6 nœuds · 1 vigilance',[['6 / 6','joignables'],['76 %','disque, en hausse']],ic.cols,true],
              ].map(([k,t,d,v,st,ico]) => (
                <button key={k} onClick={()=>setPage(k)} className="group text-left bg-white rounded-xl border border-[#EBEBEB] hover:border-[#171717] hover:shadow-[0_6px_24px_-12px_rgba(0,0,0,.18)] transition p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-lg bg-[#171717] text-white grid place-items-center"><I d={ico} c="w-5 h-5"/></div>
                    <div className="flex-1">
                      <div className="text-[16px] font-semibold tracking-tight text-[#171717]">{t}</div>
                      <div className="text-[12.5px] text-[#666666] mt-1 leading-relaxed">{d}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    {st.map(([a,b]) => <div key={b} className="rounded-md bg-[#FAFAFA] px-3 py-2"><div className="text-[18px] font-semibold tabular-nums text-[#171717]">{a}</div><div className="text-[11.5px] text-[#666666]">{b}</div></div>)}
                  </div>
                  <div className="flex items-center mt-4 pt-3 border-t border-[#F2F2F2] text-[12px]">
                    <span className="font-mono text-[#8F8F8F]">{v}</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-[#171717]">Lancer<I d={ic.chev} c="w-3.5 h-3.5 -rotate-90 transition group-hover:translate-x-0.5"/></span>
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[['KPI et anomalies','Dataviews, rapports, alertes'],['Live','Trace IMSI, trafic, RTP'],['POLARIS Control','Scénarios, runs, UE']].map(([t,d]) => (
                <div key={t} className="bg-white rounded-lg border border-[#EBEBEB] px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#F2F2F2] grid place-items-center text-[#666666]"><I d={ic.play} c="w-3.5 h-3.5"/></div>
                  <div className="flex-1"><div className="text-[13px] font-medium text-[#171717]">{t}</div><div className="text-[11.5px] text-[#8F8F8F]">{d}</div></div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8F8F8F] border border-[#EBEBEB] rounded px-1.5 py-0.5">Bientôt</span>
                </div>
              ))}
            </div>
            <Card title="Runs récents · POLARIS Control">
              <div className="divide-y divide-[#F2F2F2]">
                {[['run 5G #482','Registration + PDU + trafic','Terminé','ok'],['lte-run-976bd44b','Attach + bearer + trafic','Certifié','ok'],['run 5G #481','PDU Session DNN inconnu','Échec attendu','warn']].map(([r,x,st,t])=>(
                  <div key={r} onClick={()=>setPage('sessions')} className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#FAFAFA]"><Dot st={t}/><div className="flex-1"><div className="font-mono text-[12px] text-[#171717]">{r}</div><div className="text-[11.5px] text-[#8F8F8F]">{x}</div></div><span className="text-[12px] text-[#666666]">{st}</span><I d={ic.chev} c="w-3.5 h-3.5 -rotate-90 text-[#8F8F8F]"/></div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Informations">
              <div className="divide-y divide-[#F2F2F2]">
                {[['Incident','#B42318','Aucun incident en cours','—'],['Problème connu','#D97706','Liens SBI ↔ N2 et SBI ↔ N4 encore à prouver sur le run 5G','D-SBI · ouvert'],['Problème connu','#D97706','Publication du dataset : consommation mémoire à prouver en production','2.10.2 · ouvert'],['Info','#1D4ED8','Certification LTE validée sur run réel (attach, bearer, trafic)','10 nov.']].map(([t,c,x,m],k)=>(
                  <div key={k} className="px-4 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{color:c}}>{t}<span className="ml-auto normal-case tracking-normal font-normal text-[#8F8F8F]">{m}</span></div><div className="text-[12.5px] text-[#4D4D4D] mt-1">{x}</div></div>
                ))}
              </div>
            </Card>
            <Card title="Nouveautés · OIRAN 2.10.2" action="Toutes les notes">
              <ul className="p-4 space-y-2 text-[12.5px] text-[#4D4D4D]">
                <li className="flex gap-2"><span className="text-[#171717]">•</span>Publication du dataset bornée en mémoire</li>
                <li className="flex gap-2"><span className="text-[#171717]">•</span>Session Explorer : filtres message, cause et identité (operator)</li>
                <li className="flex gap-2"><span className="text-[#171717]">•</span>Corrélation LTE : liens S11 ↔ S1-U prouvés par TEID</li>
              </ul>
            </Card>
            <Card title="Activité récente">
              <div className="p-4 space-y-3 text-[12.5px]">
                {[['ANR1','déploiement OIRAN 2.10.2 démarré','13:50'],['ANR2','run 5G #482 terminé · BILAN en cours','13:31'],['Claude devmat','2.10.2 poussée sur #9','12:58'],['Sadok','requête « Échecs · run 482 » enregistrée','12:40']].map(([w,x,h],k)=>(
                  <div key={k} className="flex gap-3"><div className="w-7 h-7 shrink-0 rounded-full bg-[#F2F2F2] grid place-items-center text-[10.5px] font-semibold text-[#4D4D4D]">{w.split(' ').map(p=>p[0]).join('').slice(0,2)}</div><div className="flex-1"><div className="text-[#171717]"><span className="font-medium">{w}</span> · {x}</div><div className="text-[11.5px] text-[#8F8F8F]">{h}</div></div></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
        <div className="text-[11.5px] text-[#8F8F8F]">Données de démonstration. En production, chaque valeur affichée provient d’une mesure datée et s’ouvre sur sa requête.</div>
      </div>
    </div>
  );
}

function Nodes() {
  const [node,setNode] = useState(null);
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
        <div className="flex items-end gap-6">
          <div><div className="text-[12px] text-[#666666]">POLARIS Nœuds</div><h1 className="text-[24px] font-semibold tracking-tight text-[#171717] mt-1">Gestion des nœuds</h1>
            <div className="text-[13px] text-[#666666] mt-1">6 nœuds joignables · versions servies conformes · disque à surveiller.</div></div>
          <div className="ml-auto flex gap-2">
            <button className="h-9 px-4 rounded-md bg-[#171717] hover:bg-[#383838] text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.plus} c="w-4 h-4"/>Ajouter un nœud</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Déploiements</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Journal d’audit</button>
          </div>
        </div>
        <div className="space-y-5">
            <Card title="Nœuds de la plateforme">
              <table className="w-full text-[12.5px]">
                <thead><tr>{['Nœud','Rôle','État','Version servie','CPU','Mémoire','Disque','Dernier contact',''].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#F2F2F2]">{h}</th>)}</tr></thead>
                <tbody>
                  {NODES.map(n => (
                    <React.Fragment key={n.n}>
                      <tr onClick={()=>setNode(node===n.n?null:n.n)} className={`cursor-pointer ${node===n.n?'bg-[#FAFAFA]':'hover:bg-[#FAFAFA]'}`}>
                        <td className="h-11 px-4 border-b border-[#F2F2F2]"><div className="font-mono text-[12px] text-[#171717]">{n.n}</div><div className="text-[11.5px] text-[#8F8F8F]">{n.info}</div></td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#4D4D4D]">{n.role}</td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="inline-flex items-center gap-1.5"><Dot st={n.st}/>{n.st==='ok'?'Opérationnel':'Vigilance'}</span></td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="font-mono text-[11.5px]">{n.ver}</span>{n.ver.includes(n.exp) && <span className="ml-1.5 text-[11px] text-[#15803D]">✓ attendue</span>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.cpu===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.cpu}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.mem===null?<span className="text-[#D4D4D4]">—</span>:<div><Bar v={Math.round(n.mem[0]/n.mem[1]*100)}/><div className="text-[10.5px] text-[#8F8F8F] mt-0.5">{n.mem[0]} / {n.mem[1]} Go MemoryMax</div></div>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.disk===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.disk}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#666666]">{n.seen}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#8F8F8F]"><I d={ic.chev} c={`w-4 h-4 transition ${node===n.n?'rotate-180':''}`}/></td>
                      </tr>
                      {node===n.n && (
                        <tr><td colSpan="9" className="bg-[#FAFAFA] border-b border-[#F2F2F2] px-4 py-4">
                          <div className="grid grid-cols-3 gap-6 text-[12.5px]">
                            <div><Lbl>Services</Lbl>{(n.role==='Capture'?['dumpcap × 12','ring buffer','agent POLARIS']:n.role.startsWith('Import')?['oiran-import.service','décodeurs 5G/4G','corrélation']:['service principal','agent POLARIS']).map(x=><div key={x} className="flex items-center gap-2 h-6"><Dot st="ok"/>{x}</div>)}</div>
                            <div><Lbl>Dernier déploiement</Lbl><div>2.10.2 · ANR1 · sauvegarde SHA256 OK</div><div className="text-[#8F8F8F] mt-1">rollback disponible vers 0d1b0e9</div></div>
                            <div><Lbl>Actions</Lbl><div className="flex flex-wrap gap-2"><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Journal</button><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Configuration</button><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Historique</button></div><div className="text-[11.5px] text-[#8F8F8F] mt-2">Toute action sensible demande un motif et est journalisée.</div></div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-2 gap-5">
              <Card title="Capture · 12 interfaces" action="Détails">
                <div className="p-4 grid grid-cols-4 gap-2">
                  {IFACES.map(i => <div key={i} className="rounded-md border border-[#EBEBEB] px-2.5 py-2"><div className="flex items-center gap-1.5 text-[12px] font-medium"><Dot st="ok"/>{i}</div><div className="text-[10.5px] text-[#8F8F8F] mt-0.5 font-mono">PID stable</div></div>)}
                </div>
                <div className="px-4 pb-4 text-[11.5px] text-[#666666]">Aucun dumpcap arrêté depuis le dernier déploiement · paquets perdus noyau : 0</div>
              </Card>
              <Card title="Base de données et sauvegardes" action="Ouvrir">
                <div className="p-4 space-y-3 text-[12.5px]">
                  <div className="flex items-center"><span className="text-[#666666] w-40">Disque</span><Bar v={76}/><span className="ml-2 text-[11.5px] text-[#D97706]">en hausse</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Événements publiés</span><span className="tabular-nums font-medium">~1,5 M</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Intégrité</span><span>0 perte · 0 doublon</span><span className="ml-2 text-[11.5px] text-[#8F8F8F]">recette ANR2</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Dernière sauvegarde</span><span>aujourd’hui 13:48 · SHA256 vérifié</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Dernière restauration testée</span><span className="text-[#D97706]">jamais — à planifier</span></div>
                </div>
              </Card>
            </div>
          </div>

        <div className="text-[11.5px] text-[#8F8F8F]">Données de démonstration.</div>
      </div>
    </div>
  );
}

const SAVED = [
  {n:'Échecs · run 482',g:'Parcourir',p:'Run 5G #482',c:[['Résultat','Échec']],last:'il y a 12 min',r:3,fav:true},
  {n:'PDU Session 5G · toutes causes',g:'Parcourir',p:'Captures c41 → c43',c:[['Procédure','PDU Session'],['RAT','5G SA']],last:'il y a 1 h',r:1,fav:true},
  {n:'Attach LTE · certification',g:'Parcourir',p:'lte-run-976bd44b',c:[['Procédure','Attach'],['RAT','LTE']],last:'hier',r:2},
  {n:'Sessions passant par N4',g:'Inspecter',p:'Run 5G #482',c:[['Interface','N4']],last:'hier',r:4},
  {n:'Erreurs S6a',g:'Parcourir',p:'Captures c41 → c43',c:[['Cause','S6a 5001']],last:'il y a 3 j',r:1},
];
const STARTERS = [
  ['Échecs du dernier run','Toutes les sessions en échec, triées par capture',[['Résultat','Échec']]],
  ['PDU Session 5G','Établissements de session de données en 5G SA',[['Procédure','PDU Session'],['RAT','5G SA']]],
  ['Attach LTE','Attachements 4G et bearers par défaut',[['Procédure','Attach'],['RAT','LTE']]],
  ['Plan de contrôle N4','Sessions avec échanges PFCP',[['Interface','N4']]],
];

function AnalyzerHome({conds,setConds,run}) {
  const [tpl,setTpl] = useState('Parcourir');
  const [f,setF] = useState(FIELDS[0][0]);
  const [v,setV] = useState(FIELDS[0][1][0]);
  const vals = (FIELDS.find(x=>x[0]===f)||FIELDS[0])[1];
  const count = SESS.filter(s=>conds.every(c=>test(s,c))).length;
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1280px] mx-auto px-8 py-8 space-y-6">
        <div className="flex items-end">
          <div><div className="text-[12px] text-[#666666]">POLARIS Analyzer</div><h1 className="text-[24px] font-semibold tracking-tight text-[#171717] mt-1">Requêtes</h1>
            <div className="text-[13px] text-[#666666] mt-1">Lance une nouvelle requête ou reprends une requête enregistrée.</div></div>
        </div>

        <section className="bg-white rounded-lg border border-[#EBEBEB]">
          <div className="px-5 h-12 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[14px] font-semibold">Nouvelle requête</h3>
            <span className="ml-auto text-[12px] text-[#666666]">Aperçu : <b className="text-[#171717] tabular-nums">{count}</b> sessions correspondent</span></div>
          <div className="p-5 grid grid-cols-[220px_1fr] gap-x-8 gap-y-5 items-start">
            <div className="text-[13px] font-medium pt-1.5">Gabarit<div className="text-[11.5px] font-normal text-[#8F8F8F] mt-0.5">ce que la requête retourne</div></div>
            <div className="grid grid-cols-4 gap-2">
              {[['Trace','Toutes les sessions d’un UE'],['Parcourir','Une ligne par session'],['Inspecter','Une ligne par message'],['Capture','Extrait pcap d’une session']].map(([t,d]) => (
                <button key={t} onClick={()=>setTpl(t)} className={`text-left rounded-md border px-3 py-2.5 transition ${tpl===t?'border-[#171717] ring-1 ring-[#171717]':'border-[#EBEBEB] hover:border-[#D4D4D4]'}`}><div className="text-[13px] font-medium">{t}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">{d}</div></button>
              ))}
            </div>
            <div className="text-[13px] font-medium pt-1.5">Portée<div className="text-[11.5px] font-normal text-[#8F8F8F] mt-0.5">run, captures ou fenêtre</div></div>
            <div className="flex gap-2">
              {['Run 5G #482','lte-run-976bd44b','Captures c41 → c43','Fenêtre horaire'].map((p,k) => <button key={p} className={`h-8 px-3 rounded-md border text-[12.5px] ${k===0?'border-[#171717] bg-[#171717] text-white':'border-[#EBEBEB] text-[#4D4D4D] hover:border-[#D4D4D4]'}`}>{p}</button>)}
            </div>
            <div className="text-[13px] font-medium pt-1.5">Conditions<div className="text-[11.5px] font-normal text-[#8F8F8F] mt-0.5">combinées en ET</div></div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {conds.length===0 && <span className="text-[12.5px] text-[#8F8F8F] self-center">Aucune condition : toutes les sessions de la portée.</span>}
                {conds.map((c,i) => <span key={i} className="inline-flex items-center h-8 rounded-md border border-[#EBEBEB] text-[12.5px] overflow-hidden"><span className="px-2.5 h-full flex items-center bg-[#FAFAFA] border-r border-[#EBEBEB] text-[#666666]">{c[0]}</span><span className="px-2.5 font-medium">{c[1]}</span><button onClick={()=>setConds(conds.filter((_,j)=>j!==i))} className="w-7 h-full grid place-items-center text-[#8F8F8F] hover:text-[#B42318] border-l border-[#EBEBEB]"><I d={ic.x} c="w-3.5 h-3.5"/></button></span>)}
              </div>
              <div className="flex items-center gap-2">
                <select value={f} onChange={e=>{setF(e.target.value); setV(FIELDS.find(x=>x[0]===e.target.value)[1][0]);}} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white">{FIELDS.map(x=><option key={x[0]}>{x[0]}</option>)}</select>
                <span className="text-[12.5px] text-[#8F8F8F]">=</span>
                <select value={v} onChange={e=>setV(e.target.value)} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white min-w-[180px]">{vals.map(x=><option key={x}>{x}</option>)}</select>
                <button onClick={()=>setConds([...conds,[f,v]])} className="h-8 px-3 rounded-md border border-[#EBEBEB] text-[12.5px] hover:bg-[#FAFAFA] flex items-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter</button>
                <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-[#8F8F8F]"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator</span>
              </div>
            </div>
            <div className="text-[13px] font-medium pt-1.5">Regrouper par</div>
            <div className="flex gap-2">{['Aucun','Procédure','Résultat','Cause','Cellule','UE'].map((g,k)=><button key={g} className={`h-8 px-3 rounded-md border text-[12.5px] ${k===0?'border-[#171717] text-[#171717]':'border-[#EBEBEB] text-[#666666] hover:border-[#D4D4D4]'}`}>{g}</button>)}</div>
          </div>
          <div className="px-5 h-14 flex items-center gap-2 border-t border-[#F2F2F2] bg-[#FAFAFA] rounded-b-lg">
            <input placeholder="Nom de la requête (facultatif)" className="h-8 w-72 rounded-md border border-[#EBEBEB] px-3 text-[12.5px] bg-white outline-none focus:border-[#171717]"/>
            <button className="h-8 px-3 rounded-md border border-[#EBEBEB] bg-white text-[12.5px] text-[#4D4D4D] hover:bg-[#F2F2F2]">Enregistrer</button>
            <button onClick={run} className="ml-auto h-9 px-5 rounded-md bg-[#171717] hover:bg-[#383838] text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter la requête</button>
          </div>
        </section>

        <div>
          <div className="text-[13px] font-semibold mb-3">Démarrer depuis un modèle</div>
          <div className="grid grid-cols-4 gap-3">
            {STARTERS.map(([t,d,c]) => (
              <button key={t} onClick={()=>{setConds(c); run();}} className="group text-left bg-white rounded-lg border border-[#EBEBEB] hover:border-[#171717] p-4 transition">
                <div className="text-[13px] font-medium">{t}</div><div className="text-[12px] text-[#666666] mt-1 leading-relaxed">{d}</div>
                <div className="flex flex-wrap gap-1 mt-3">{c.map(x=><span key={x[1]} className="text-[11px] rounded border border-[#EBEBEB] px-1.5 py-0.5 text-[#4D4D4D]">{x[0]} = {x[1]}</span>)}</div>
              </button>
            ))}
          </div>
        </div>

        <section className="bg-white rounded-lg border border-[#EBEBEB] overflow-hidden">
          <div className="px-5 h-12 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[14px] font-semibold">Requêtes enregistrées</h3><span className="ml-auto text-[12px] text-[#666666]">{SAVED.length} requêtes</span></div>
          <table className="w-full text-[12.5px]">
            <thead><tr>{['','Nom','Gabarit','Portée','Conditions','Dernière exécution','Résultats',''].map((h,k)=><th key={k} className="h-9 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{h}</th>)}</tr></thead>
            <tbody>
              {SAVED.map(q => (
                <tr key={q.n} onClick={()=>{setConds(q.c); run();}} className="cursor-pointer hover:bg-[#FAFAFA] group">
                  <td className="h-11 pl-4 border-b border-[#F2F2F2] w-8"><I d={ic.star} c={`w-3.5 h-3.5 ${q.fav?'text-[#171717]':'text-[#D4D4D4]'}`}/></td>
                  <td className="px-4 border-b border-[#F2F2F2] font-medium text-[#171717]">{q.n}</td>
                  <td className="px-4 border-b border-[#F2F2F2] text-[#4D4D4D]">{q.g}</td>
                  <td className="px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666]">{q.p}</td>
                  <td className="px-4 border-b border-[#F2F2F2]"><span className="flex flex-wrap gap-1">{q.c.map(x=><span key={x[1]} className="text-[11px] rounded border border-[#EBEBEB] px-1.5 py-0.5 text-[#4D4D4D]">{x[0]} = {x[1]}</span>)}</span></td>
                  <td className="px-4 border-b border-[#F2F2F2] text-[#666666]">{q.last}</td>
                  <td className="px-4 border-b border-[#F2F2F2] tabular-nums">{q.r}</td>
                  <td className="px-4 border-b border-[#F2F2F2] text-right"><span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#171717] opacity-0 group-hover:opacity-100">Ouvrir<I d={ic.chev} c="w-3.5 h-3.5 -rotate-90"/></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="text-[11.5px] text-[#8F8F8F]">Données de démonstration.</div>
      </div>
    </div>
  );
}

const THEMES = [['blue','Bleu','#0062A1'],['black','Noir','#171717'],['green','Vert','#0F5B56']];
function Settings({theme,setTheme,onClose}) {
  const [cur,setCur]=useState(''),[nw,setNw]=useState(''),[cf,setCf]=useState(''),[pm,setPm]=useState(null);
  const accent = THEMES.find(t=>t[0]===theme)[2];
  const save = e => { e.preventDefault(); if(!cur||nw.length<8) return setPm(['err','Mot de passe actuel requis et 8 caractères minimum.']); if(nw!==cf) return setPm(['err','Les mots de passe ne correspondent pas.']); setPm(['ok','Mot de passe mis à jour (maquette).']); setCur('');setNw('');setCf(''); };
  const inp = "w-full h-8 rounded-md border border-[#EBEBEB] px-2.5 text-[13px] outline-none focus:border-[#8F8F8F]";
  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={onClose}>
      <div className="w-[420px] bg-white rounded-lg border border-[#EBEBEB] shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="h-12 px-4 flex items-center gap-3 border-b border-[#EBEBEB]">
          <div style={{background:accent}} className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold text-white">SD</div>
          <span className="text-[14px] font-semibold">Paramètres</span>
          <button onClick={onClose} className="ml-auto text-[#666666] hover:text-[#171717]"><I d={ic.x} c="w-4 h-4"/></button>
        </div>
        <div className="p-4 space-y-5">
          <div><Lbl>Version</Lbl>
            <div className="font-mono text-[12px] text-[#4D4D4D] space-y-0.5"><div>Analyzer 0.1.0</div><div>OIRAN 2.10.2</div></div></div>
          <div><Lbl>Couleur de l'application</Lbl>
            <div className="flex gap-2">{THEMES.map(([k,n,c])=>(
              <button key={k} onClick={()=>setTheme(k)} className={`flex-1 h-9 rounded-md border flex items-center justify-center gap-2 text-[12.5px] ${theme===k?'border-[#171717] font-semibold':'border-[#EBEBEB] text-[#666666]'}`}>
                <span className="w-3.5 h-3.5 rounded-full" style={{background:c}}/>{n}</button>))}</div></div>
          <form onSubmit={save} className="space-y-2"><Lbl>Mot de passe</Lbl>
            <input type="password" placeholder="Mot de passe actuel" value={cur} onChange={e=>setCur(e.target.value)} className={inp}/>
            <input type="password" placeholder="Nouveau mot de passe" value={nw} onChange={e=>setNw(e.target.value)} className={inp}/>
            <input type="password" placeholder="Confirmer" value={cf} onChange={e=>setCf(e.target.value)} className={inp}/>
            {pm && <div className={`text-[12px] ${pm[0]==='ok'?'text-[#15803D]':'text-[#B42318]'}`}>{pm[1]}</div>}
            <button type="submit" style={{background:accent}} className="h-8 px-3 rounded-md text-white text-[12.5px] font-medium">Changer le mot de passe</button>
          </form>
        </div>
      </div>
    </div>);
}

function App() {
  const [role,setRole] = useState('viewer');
  const [theme,setThemeS] = useState(()=>{ try { return localStorage.getItem('polaris-theme')||'blue'; } catch(e) { return 'blue'; } });
  const setTheme = t => { try { localStorage.setItem('polaris-theme',t); } catch(e) {} setThemeS(t); };
  const accent = THEMES.find(t=>t[0]===theme)?.[2] || '#0062A1';
  const [showSet,setShowSet] = useState(false);
  const readP = () => { const h=(location.hash||'').replace('#',''); return ['sessions','nodes'].includes(h) ? h : 'home'; };
  const [page,setPageS] = useState(readP);
  const setPage = p => { try { location.hash = p; } catch(e) {} setPageS(p); };
  useEffect(()=>{ const f=()=>setPageS(readP()); window.addEventListener('hashchange',f); return ()=>window.removeEventListener('hashchange',f); },[]);
  const [conds,setConds] = useState([['Résultat','Échec']]);
  const [aview,setAview] = useState('queries');
  const rows = useMemo(()=>SESS.filter(s=>conds.every(c=>test(s,c))),[conds]);
  const [sel,setSel] = useState(3);
  const s = rows.find(r=>r.id===sel) || rows[0] || SESS[0];
  const [msg,setMsg] = useState(4);
  const [lens,setLens] = useState(null);
  useEffect(()=>{ setMsg(s.d===KO5?4:Math.min(14,s.d.msgs.length-1)); setLens(null); },[s.id]);
  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA] text-[#171717] text-[13px]">
      <TopBar role={role} setRole={setRole} page={page} setPage={setPage} onAnalyzer={()=>setAview('queries')} accent={accent} onSettings={()=>setShowSet(true)}/>
      {showSet && <Settings theme={theme} setTheme={setTheme} onClose={()=>setShowSet(false)}/>}
      {role==='operator' && <div className="h-7 shrink-0 bg-[#FDF6E7] border-b border-[#F1D9A8] text-[#7A4505] text-[12px] flex items-center px-4">Rôle operator actif · les identités sont visibles · chaque consultation est journalisée</div>}
      {page==='home' ? <Home setPage={setPage}/> : page==='nodes' ? <Nodes/> : aview==='queries' ? <AnalyzerHome conds={conds} setConds={setConds} run={()=>setAview('results')}/> : <>
      <Tabs onHome={()=>setAview('queries')}/>
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 flex flex-col">
          <Grid rows={rows} sel={s.id} setSel={setSel} role={role} conds={conds} setConds={setConds} onEdit={()=>setAview('queries')}/>
          <Detail s={s} sel={msg} setSel={setMsg} lens={lens}/>
        </main>
        <Inspector s={s} sel={msg} role={role} lens={lens} setLens={setLens}/>
      </div></>}
      <footer className="h-7 shrink-0 bg-white border-t border-[#EBEBEB] flex items-center gap-5 px-4 text-[11.5px] text-[#666666]">
        <span className="flex items-center gap-1.5"><span className="w-[6px] h-[6px] rounded-full bg-[#15803D]"/>12/12 dumpcap</span><span>Import à jour</span><span>Segments ignorés : 0</span>
        <span>{rows.length} sessions · requête 0,8 s</span><span className="ml-auto font-mono">OIRAN 2.10.2 · Analyzer 0.1.0 · données fictives</span>
      </footer>
    </div>
  );
}
export default App;
