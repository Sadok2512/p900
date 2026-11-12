import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInterfaces, useInterfaceRuntime, useLiveMetrics, usePolarisLab, usePolarisNodes, usePolarisUes, useProbes, records, available } from '@/lib/polaris-api';
import { INTERFACE_FAMILY_HEX, interfaceFamilyOf, AVAILABILITY_LABEL, CAPTURE_LABEL } from '@/lib/polaris-ui/interfaceColors';
import { InterfaceBadge } from '../ui/InterfaceBadge';
import { SLOTS, slotById, buildLinks, nodeStateOf, route, SBI_Y, CORE_5G, CORE_LTE } from './topologyModel';

const textState = value => String(value ?? '').toLowerCase();
const itemList = value => records(value?.items ?? value, 'items');

/* Kept for compatibility: capture-link tone from capture rows and ingestion counters. */
export function captureLinkTone(name, interfaces, metrics) {
  const aliases = {N2:['N2','NG-C'],N3:['N3','NG-U'],'S1-MME':['S1-MME','S1-C'],'S1-U':['S1-U']};
  const names=(aliases[name]??[name]).map(value=>value.toUpperCase());
  const matches=x=>[x.interface,x.name,x.capture_interface].some(value=>names.includes(String(value??'').toUpperCase()));
  const row = interfaces.find(matches);
  const live = (metrics?.interfaces ?? []).find(matches);
  const active = ['capturing','ingesting','active','running','available'].includes(textState(live?.state ?? row?.status));
  if (!active) return 'error';
  const pending = Number(live?.pending_segments ?? row?.pending_segments ?? metrics?.pending_segments ?? 0);
  const ingested = Number(live?.segments_ingested ?? row?.segments_ingested ?? metrics?.segments_ingested ?? 0);
  return pending > 0 || ingested <= 0 ? 'warn' : 'ok';
}

const STATE = { operational:['var(--success)','opérationnel'], degraded:['var(--warning)','dégradé'], failed:['var(--danger)','en échec / hors ligne'], unknown:['var(--topo-muted)','inconnu / non observé'] };
const AVAIL_TO_STATE = { available:'operational', degraded:'degraded', unavailable:'failed', unknown:'unknown' };
const CAPTURE_TO_STATE = { active:'operational', starting:'degraded', stopping:'degraded', inactive:'failed', unknown:'unknown' };
const ZONES = [
  { id:'ran', label:'Radio Access Network', x:20, y:40, w:290, h:600 },
  { id:'5gc', label:'5G Core', x:370, y:40, w:760, h:300 },
  { id:'epc', label:'LTE EPC', x:370, y:380, w:760, h:260 },
  { id:'dn', label:'Data Network', x:1150, y:40, w:190, h:600 },
  { id:'probes', label:'Sondes POLARIS', x:20, y:680, w:1320, h:120 },
];
const VIEW = { x:0, y:0, k:1 };
const norm = s => String(s ?? '').toUpperCase().replace(/[-_\s]/g,'');

function useTopologyTheme() {
  const [mode,setMode] = useState('light');
  useEffect(()=>{ try { const v=sessionStorage.getItem('polaris-topology-theme'); if(v==='dark'||v==='light') setMode(v); } catch { /* ignore */ } },[]);
  const set = v => { setMode(v); try { sessionStorage.setItem('polaris-topology-theme',v); } catch { /* ignore */ } };
  return [mode,set];
}

const Seg = ({value,onChange,options,label}) => <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">{options.map(([k,l])=><button key={k} type="button" role="radio" aria-checked={value===k} onClick={()=>onChange(k)} className={`h-6 px-2.5 rounded text-[11.5px] ${value===k?'bg-white shadow-sm text-foreground font-medium':'text-muted-foreground'}`}>{l}</button>)}</div>;
const ToolBtn = ({children,label,onClick}) => <button type="button" aria-label={label} title={label} onClick={onClick} className="h-7 min-w-7 px-1.5 rounded-md border border-border bg-white text-[12px] text-ink-2 hover:bg-surface-2">{children}</button>;

function NodeBox({slot,state,sub,selected,onSelect,dashed}) {
  const [color] = STATE[state] ?? STATE.unknown;
  return <g role="button" tabIndex={0} aria-label={`${slot.label} · ${STATE[state]?.[1]}`} onClick={e=>{e.stopPropagation(); onSelect();}} onKeyDown={e=>e.key==='Enter'&&onSelect()} className="cursor-pointer" style={{outline:'none'}}>
    <title>{`${slot.label} — ${STATE[state]?.[1]}${sub?` · ${sub}`:''}`}</title>
    <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} rx="7" fill="var(--topo-node)" stroke={selected?'var(--topo-select)':'var(--topo-node-line)'} strokeWidth={selected?2:1} strokeDasharray={dashed?'4 3':undefined} style={{transition:'fill .25s, stroke .25s'}}/>
    <circle cx={slot.x+11} cy={slot.y+(sub?14:slot.h/2)} r="3.5" fill={color}/>
    <text x={slot.x+20} y={slot.y+(sub?18:slot.h/2+4)} fontSize="12" fontWeight="600" fontFamily="var(--font-mono, ui-monospace)" fill="var(--topo-text)">{slot.label}</text>
    {sub && <text x={slot.x+10} y={slot.y+32} fontSize="10" fill="var(--topo-muted)">{String(sub).slice(0,Math.floor(slot.w/6))}</text>}
  </g>;
}

export default function NetworkTopology({ onOpenProbe }) {
  const lab=usePolarisLab(), nodesQ=usePolarisNodes(), uesQ=usePolarisUes(), interfacesQ=useInterfaces(), runtimeQ=useInterfaceRuntime(), metricsQ=useLiveMetrics(), probesQ=useProbes();
  const [mode,setMode] = useTopologyTheme();
  const [view,setView] = useState(VIEW), [selected,setSelected] = useState(null), [panel,setPanel] = useState(true), [showRef,setShowRef] = useState(false);
  const svgRef = useRef(null), drag = useRef(null);
  const dark = mode==='dark';

  const observed = lab.data?.data?.observed ?? lab.data?.data ?? {};
  const nfRows = Array.isArray(observed?.nfs) ? observed.nfs : Object.entries(observed?.nfs ?? {}).map(([k,v])=>({name:k,...(typeof v==='object'?v:{state:v})}));
  const nfByName = Object.fromEntries(nfRows.map(r=>[norm(r?.nf ?? r?.name),r]));
  const ran = itemList(nodesQ.data?.data), ues = itemList(uesQ.data?.data);
  const interfaces = records(interfacesQ.data?.data,'interfaces'), runtime = records(runtimeQ.data?.data,'interfaces');
  const observedLinks = records(observed?.links ?? observed?.interfaces, 'items');
  const dataNetworks = records(observed?.data_networks ?? observed?.dnns ?? observed?.dnn, 'items').map(d=>typeof d==='string'?{name:d}:d);
  const allProbes = useMemo(()=>records(probesQ.data?.data,'probes').map((p,i)=>{
    const name=String(p.n ?? p.name ?? p.probe_id ?? p.id ?? `probe-${i+1}`);
    const health=textState(p.st ?? p.health ?? p.status ?? p.probe_state);
    return { id:String(p.probe_id ?? p.id ?? name), name, type:p.probe_type ?? p.type ?? null, role:p.role ?? null,
      online: ['ok','healthy','online','operational'].includes(health) || p.online===true ? 'operational' : ['warn','degraded','warning'].includes(health) ? 'degraded' : health ? 'failed' : 'unknown',
      interfaces:(p.connected_interfaces ?? p.interfaces ?? []).map(String), raw:p };
  }),[probesQ.data]);
  // Only probes with capture points belong on the architecture; others are counted in the panel.
  const probes = useMemo(()=>allProbes.filter(p=>p.interfaces.length).slice(0,5),[allProbes]);
  const links = useMemo(()=>buildLinks({interfaces,runtime,observedLinks,probes:allProbes}),[interfaces,runtime,observedLinks,allProbes]);
  const linkNames = new Set(links.map(l=>l.name));
  const refOnly = showRef ? buildLinks({interfaces:[{name:'N2'},{name:'N3'},{name:'N4'},{name:'N6'},{name:'SBI'},{name:'S1-MME'},{name:'S1-U'},{name:'S11'},{name:'S5-C'},{name:'S5-U'},{name:'S6a'},{name:'SGi'}]}).filter(l=>!linkNames.has(l.name)) : [];

  const g5 = ran.filter(n=>!/LTE|4G/i.test(String(n.technology))), g4 = ran.filter(n=>/LTE|4G/i.test(String(n.technology)));
  const uesOf = node => node ? ues.filter(u=>String(u.serving_node ?? u.node_id)===String(node.id ?? node.name)) : [];
  const ue5 = uesOf(g5[0]), ue4 = uesOf(g4[0]);
  const nfState = id => { const r = nfByName[norm(id)]; return r ? nodeStateOf(r.process_state ?? r.health ?? r.state ?? r.status) : 'unknown'; };
  const ranState = n => n ? nodeStateOf(n.process_state ?? n.state ?? n.status) : 'unknown';

  const ink = name => { const hex = INTERFACE_FAMILY_HEX[interfaceFamilyOf(name)].fg; return dark ? `color-mix(in oklab, ${hex} 62%, white)` : hex; };
  const geom = l => {
    if (l.name==='SBI') return { d:`M400,${SBI_Y} H1080`, lx:1090, ly:SBI_Y };
    if (l.name==='N1') { const a=slotById.gNB, b=slotById.AMF; return { d:`M${a.x+20},${a.y+a.h+60} C ${a.x+20},${a.y-40} ${b.x-60},${b.y-40} ${b.x},${b.y+10}`, lx:300, ly:150 }; }
    const lane = ['N2','S1-MME'].includes(l.name)?-1:['N3','S1-U'].includes(l.name)?1:0; return route(slotById[l.from], slotById[l.to], lane);
  };
  const probeSlot = i => ({ x:40+i*232, y:712, w:212, h:72 });

  // Wheel zoom (non-passive so the page does not scroll).
  useEffect(()=>{ const el=svgRef.current; if(!el) return; const onWheel=e=>{ e.preventDefault(); setView(v=>({...v,k:Math.min(2.5,Math.max(0.5,v.k*(e.deltaY<0?1.1:0.9)))})); }; el.addEventListener('wheel',onWheel,{passive:false}); return ()=>el.removeEventListener('wheel',onWheel); },[]);
  const zoom = f => setView(v=>({...v,k:Math.min(2.5,Math.max(0.5,v.k*f))}));
  const onDown = e => { drag.current={sx:e.clientX,sy:e.clientY,v:view,moved:false}; };
  const onMove = e => { const d=drag.current; if(!d) return; const r=svgRef.current.getBoundingClientRect(); const s=1360/r.width; if(Math.abs(e.clientX-d.sx)+Math.abs(e.clientY-d.sy)>3) d.moved=true; if(!d.moved) return; setView({...d.v,x:d.v.x+(e.clientX-d.sx)*s,y:d.v.y+(e.clientY-d.sy)*s}); };
  const onUp = () => { drag.current=null; };
  const refresh = () => [lab,nodesQ,uesQ,interfacesQ,runtimeQ,metricsQ,probesQ].forEach(q=>q.refetch?.());

  const sel = selected;
  const isSel = (kind,id) => sel?.kind===kind && sel?.id===id;
  const labDown = lab.isError || nodesQ.isError;
  const observedNfs = [...CORE_5G,...CORE_LTE].filter(id=>nfByName[norm(id)]).length;

  const drawLink = (l, ghost=false) => { const g=geom(l); const c=ghost?'var(--topo-muted)':ink(l.name); const [stc]=STATE[AVAIL_TO_STATE[l.network]]; const on=isSel('link',l.name);
    return <g key={(ghost?'ref-':'')+l.name} role="button" aria-label={`Interface ${l.name}`} className="cursor-pointer" onClick={e=>{e.stopPropagation(); if(!ghost) setSelected({kind:'link',id:l.name});}}>
      <title>{ghost?`${l.name} · référence 3GPP, non configurée dans le lab`:`${l.name} · ${l.from} ↔ ${l.to} · ${l.protocol} · réseau ${AVAILABILITY_LABEL[l.network].toLowerCase()} · capture ${CAPTURE_LABEL[l.capture]}`}</title>
      <path d={g.d} fill="none" stroke="transparent" strokeWidth="12"/>
      <path d={g.d} fill="none" stroke={c} strokeWidth={on?3:l.plane==='sbi'?2.2:1.6} strokeDasharray={ghost?'2 4':l.plane==='logical'?'6 4':l.plane==='user'?undefined:undefined} opacity={ghost?0.5:1} strokeLinecap="round"/>
      {l.plane==='sbi' && !ghost && ['NRF','AUSF','UDM','UDR','PCF','NSSF','BSF'].map(id=>{const s=slotById[id]; return <line key={id} x1={s.x+s.w/2} y1={s.y+s.h} x2={s.x+s.w/2} y2={SBI_Y} stroke={c} strokeWidth="1.2"/>;})}
      {l.plane==='sbi' && !ghost && ['AMF','SMF'].map(id=>{const s=slotById[id]; return <line key={id} x1={s.x+s.w/2} y1={SBI_Y} x2={s.x+s.w/2} y2={s.y} stroke={c} strokeWidth="1.2"/>;})}
      <g transform={`translate(${g.lx},${g.ly})`}>
        <rect x={-l.name.length*3.6-13} y="-9" width={l.name.length*7.2+(ghost?14:26)} height="18" rx="9" fill="var(--topo-node)" stroke={c} strokeWidth={on?1.6:1} opacity={ghost?0.7:1}/>
        <text x={ghost?-l.name.length*3.6-6:-l.name.length*3.6-6} y="4" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono, ui-monospace)" fill={c}>{l.name}</text>
        {!ghost && <circle cx={l.name.length*3.6+5} cy="0" r="3" fill={stc}/>}
      </g>
    </g>; };

  const probeAnchors = (p) => p.interfaces.map(n=>links.find(l=>l.name===n || l.name===String(n).toUpperCase())).filter(Boolean).map(l=>({l,...geom(l)}));

  // ----- details -----
  const detail = (() => {
    if (!sel) return null;
    if (sel.kind==='link') { const l=links.find(x=>x.name===sel.id); if(!l) return null; return <div className="space-y-2">
      <InterfaceBadge name={l.name}/>
      {[['Source',l.from==='UE5G'?'UE':l.from==='SBI'?'NF 5GC':l.from],['Destination',l.to==='SBI'?'NF 5GC (bus SBI)':l.to],['Protocole',l.protocol],['État réseau',AVAILABILITY_LABEL[l.network]+(l.evidence.observed?'':' (aucune topologie observée)')],['Point de capture',AVAILABILITY_LABEL[l.capturePoint]],['Capture dumpcap',CAPTURE_LABEL[l.capture]],['Sondes associées',l.evidence.probes.join(', ')||'—'],['Source de la donnée',[l.evidence.configured&&'configuration',l.evidence.runtime&&'runtime',l.evidence.observed&&'topologie lab',l.evidence.probes.length&&'sonde'].filter(Boolean).join(' · ')]].map(([k,v])=><Row key={k} k={k} v={v}/>)}
    </div>; }
    if (sel.kind==='probe') { const p=probes.find(x=>x.id===sel.id); if(!p) return null; return <div className="space-y-2">
      {[['Nom',p.name],['ID',p.id],['Type',available(p.type)],['Rôle',available(p.role)],['Statut',STATE[p.online][1]],['Interfaces de capture',p.interfaces.join(', ')||'—']].map(([k,v])=><Row key={k} k={k} v={v}/>)}
      <div className="flex flex-wrap gap-1">{p.interfaces.map(n=><InterfaceBadge key={n} name={n}/>)}</div>
      {onOpenProbe && <button type="button" onClick={()=>onOpenProbe(p.name)} className="mt-2 h-8 w-full rounded-md bg-[var(--app-accent)] text-[12px] font-medium text-white">Ouvrir la fiche sonde →</button>}
    </div>; }
    const raw = sel.raw ?? {};
    return <div className="space-y-2"><Row k="Élément" v={sel.id}/><Row k="État" v={STATE[sel.state]?.[1]}/>
      {Object.entries(raw).filter(([k,v])=>!['subscriber_identity','imsi','supi','suci','imei','msisdn'].includes(k)&&['string','number','boolean'].includes(typeof v)).slice(0,12).map(([k,v])=><Row key={k} k={k} v={String(v)}/>)}
      {!Object.keys(raw).length && <p className="text-subtle">Aucune donnée observée pour cet élément.</p>}</div>;
  })();

  return <div className={`grid gap-4 ${panel?'grid-cols-[minmax(0,1fr)_300px]':'grid-cols-1'}`}>
    <section className="rounded-lg border border-border bg-white overflow-hidden">
      <header className="h-11 border-b border-border flex items-center px-3 gap-2 flex-wrap">
        <strong className="text-[13px]">Architecture réseau</strong>
        <span className="text-[11px] text-subtle hidden xl:inline">sources /lab, /nodes, /ues, /interfaces, /probes · 5 s</span>
        <div className="ml-auto flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[11.5px] text-muted-foreground mr-1"><input type="checkbox" checked={showRef} onChange={e=>setShowRef(e.target.checked)}/>Référence 3GPP</label>
          <Seg label="Thème de la topologie" value={mode} onChange={setMode} options={[['light','Light'],['dark','Dark']]}/>
          <ToolBtn label="Zoom arrière" onClick={()=>zoom(0.85)}>−</ToolBtn>
          <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">{Math.round(view.k*100)}%</span>
          <ToolBtn label="Zoom avant" onClick={()=>zoom(1.15)}>+</ToolBtn>
          <ToolBtn label="Ajuster à l'écran" onClick={()=>setView(VIEW)}>⤢</ToolBtn>
          <ToolBtn label="Réinitialiser la vue" onClick={()=>{setView(VIEW); setSelected(null);}}>↺</ToolBtn>
          <ToolBtn label="Actualiser" onClick={refresh}>⟳</ToolBtn>
          <ToolBtn label={panel?'Masquer le panneau':'Afficher le panneau'} onClick={()=>setPanel(p=>!p)}>{panel?'⇥':'⇤'}</ToolBtn>
        </div>
      </header>
      {labDown && <div className="px-3 py-1.5 text-[11.5px] text-muted-foreground bg-surface-2 border-b border-border-subtle">POLARIS Simulator non joignable (/lab, /nodes) : états des fonctions réseau inconnus, seuls les interfaces et sondes enregistrées sont tracées.</div>}
      <div className={`topo-canvas ${dark?'topo-dark':'topo-light'}`}>
        <svg ref={svgRef} viewBox="0 0 1360 820" style={{maxHeight:'calc(100vh - 260px)',minHeight:480}} className="block w-full h-auto select-none touch-none cursor-grab active:cursor-grabbing" role="img" aria-label="Topologie réseau" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={e=>{ if(e.target===e.currentTarget||e.target.dataset?.bg) setSelected(null); }}>
          <defs><pattern id="topo-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.9" fill="var(--topo-grid)"/></pattern></defs>
          <rect data-bg="1" width="1360" height="820" fill="url(#topo-grid)"/>
          <g style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin:'680px 410px', transformBox:'view-box', transition:drag.current?'none':'transform .15s ease'}}>
            {ZONES.map(z=><g key={z.id}><rect x={z.x} y={z.y} width={z.w} height={z.h} rx="12" fill="var(--topo-zone)" stroke="var(--topo-zone-line)"/><text x={z.x+14} y={z.y+20} fontSize="11" fontWeight="700" letterSpacing="0.08em" fill="var(--topo-muted)">{z.label.toUpperCase()}</text></g>)}
            {refOnly.map(l=>drawLink(l,true))}
            {links.map(l=>drawLink(l))}
            {/* probe monitoring links: dotted, never a 3GPP interface */}
            {probes.map((p,i)=>{ const s=probeSlot(i); return probeAnchors(p).map(a=><path key={p.id+a.l.name} d={`M${s.x+s.w/2},${s.y} C ${s.x+s.w/2},${s.y-80} ${a.lx},${a.ly+80} ${a.lx},${a.ly+10}`} fill="none" stroke="var(--topo-probe)" strokeWidth={isSel('probe',p.id)?1.8:1} strokeDasharray="1.5 4" strokeLinecap="round" opacity={sel&&!isSel('probe',p.id)?0.35:0.9}><title>{`${p.name} surveille ${a.l.name} (point de capture)`}</title></path>); })}
            {SLOTS.filter(s=>s.zone==='5gc'||s.zone==='epc').map(s=>{ const st=nfState(s.id); const r=nfByName[norm(s.id)]; return <NodeBox key={s.id} slot={s} state={st} dashed={!r} selected={isSel('node',s.id)} onSelect={()=>setSelected({kind:'node',id:s.id,state:st,raw:r})}/>; })}
            {[['gNB',g5,ue5],['eNB',g4,ue4]].map(([id,list,uel])=>{ const base=slotById[id]; const n=list[0]; const st=ranState(n); const name=n?String(n.id ?? n.name):`${id} non observé`;
              return <g key={id}><NodeBox slot={{...base,label:n?name:id}} state={st} dashed={!n} sub={n?`${available(n.technology)} · ${available(n.simulator)}`:'non observé'} selected={isSel('node',id)} onSelect={()=>setSelected({kind:'node',id:name,state:st,raw:n})}/>
                {list.length>1 && <text x={base.x+base.w-4} y={base.y-6} textAnchor="end" fontSize="10" fill="var(--topo-muted)">+{list.length-1} autre(s)</text>}
                {n && <text x={40} y={base.y+base.h+34} fontSize="10" fill="var(--topo-muted)">UE ({uel.length})</text>}
                {uel.slice(0,8).map((u,j)=>{ const label=String(u.id ?? u.ue_id ?? `UE ${j+1}`); const x=40+(j%4)*64, y=base.y+base.h+44+Math.floor(j/4)*26; const on=isSel('ue',label);
                  return <g key={label} className="cursor-pointer" onClick={e=>{e.stopPropagation(); setSelected({kind:'ue',id:label,state:nodeStateOf(u.state ?? u.status),raw:u});}}><title>{label}</title><rect x={x} y={y} width="58" height="20" rx="5" fill="var(--topo-node)" stroke={on?'var(--topo-select)':'var(--topo-node-line)'}/><text x={x+29} y={y+14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono, ui-monospace)" fill="var(--topo-text)">{label.slice(0,8)}</text></g>; })}
                {uel.length>8 && <text x={40} y={base.y+base.h+108} fontSize="10" fill="var(--topo-muted)">+{uel.length-8} UE</text>}
                {n && !uel.length && <text x={40} y={base.y+base.h+56} fontSize="10" fill="var(--topo-muted)">aucun UE rattaché</text>}
              </g>; })}
            {(()=>{ const s=slotById.DN; const names=dataNetworks.map(d=>String(d.name ?? d.dnn ?? d.apn ?? '')).filter(Boolean); return <NodeBox slot={s} state={names.length?'operational':'unknown'} dashed={!names.length} sub={names.length?names.join(', '):'non configuré'} selected={isSel('node','DN')} onSelect={()=>setSelected({kind:'node',id:'Data Network',state:names.length?'operational':'unknown',raw:names.length?{data_networks:names.join(', ')}:undefined})}/>; })()}
            {probes.map((p,i)=>{ const s=probeSlot(i); const on=isSel('probe',p.id); const [c]=STATE[p.online]; return <g key={p.id} role="button" aria-label={`Sonde ${p.name}`} className="cursor-pointer" onClick={e=>{e.stopPropagation(); setSelected({kind:'probe',id:p.id});}}>
              <title>{`${p.name} · ${STATE[p.online][1]}`}</title>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="9" fill="var(--topo-node)" stroke={on?'var(--topo-select)':'var(--topo-probe)'} strokeWidth={on?2:1}/>
              <circle cx={s.x+13} cy={s.y+16} r="3.5" fill={c}/>
              <text x={s.x+22} y={s.y+20} fontSize="12" fontWeight="600" fontFamily="var(--font-mono, ui-monospace)" fill="var(--topo-text)">{p.name.slice(0,24)}</text>
              <text x={s.x+12} y={s.y+37} fontSize="10" fill="var(--topo-muted)">{`${available(p.type)} · ${STATE[p.online][1]}`}</text>
              {p.interfaces.slice(0,5).map((n,j)=><g key={n} transform={`translate(${s.x+12+j*40},${s.y+48})`}><rect width="36" height="15" rx="4" fill="none" stroke={ink(n)}/><text x="18" y="11" textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="var(--font-mono, ui-monospace)" fill={ink(n)}>{n.slice(0,6)}</text></g>)}
              {!p.interfaces.length && <text x={s.x+12} y={s.y+60} fontSize="10" fill="var(--topo-muted)">aucun point de capture</text>}
            </g>; })}
            {allProbes.length>probes.length && <text x={1320} y={700} textAnchor="end" fontSize="10" fill="var(--topo-muted)">{allProbes.length-probes.length} sonde(s) sans point de capture · voir Node Manager</text>}
            {!probes.length && <text x={40} y={752} fontSize="11" fill="var(--topo-muted)">{probesQ.isError?'Sondes indisponibles (GET /api/v1/probes)':'Aucune sonde enregistrée'}</text>}
          </g>
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px]" style={{color:'var(--topo-muted)',borderTop:'1px solid var(--topo-zone-line)'}}>
          {Object.entries(STATE).map(([k,[c,l]])=><span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:c}}/>{l}</span>)}
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.6"/></svg>interface 3GPP</span>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--topo-probe)" strokeWidth="1.4" strokeDasharray="1.5 4" strokeLinecap="round"/></svg>surveillance sonde</span>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="10"><rect x="1" y="1" width="20" height="8" rx="2" fill="none" stroke="currentColor" strokeDasharray="3 2"/></svg>non observé</span>
          <span className="ml-auto">Glisser pour déplacer · molette pour zoomer</span>
        </div>
      </div>
    </section>
    {panel && <aside className="rounded-lg border border-border bg-white text-[12px] self-start">
      <div className="px-4 py-3 border-b border-border-subtle font-semibold">Vue d'ensemble</div>
      <dl className="px-4 py-3 grid grid-cols-2 gap-y-2 gap-x-3 border-b border-border-subtle">
        <Stat k="Fonctions observées" v={labDown?'—':`${observedNfs} / ${CORE_5G.length+CORE_LTE.length}`}/>
        <Stat k="Nœuds radio" v={nodesQ.isError?'—':ran.length}/>
        <Stat k="UE" v={uesQ.isError?'—':ues.length}/>
        <Stat k="Sondes (capture)" v={probesQ.isError?'—':`${probes.length} / ${allProbes.length}`}/>
        <Stat k="Interfaces tracées" v={links.length}/>
        <Stat k="Captures actives" v={runtimeQ.isError?'—':links.filter(l=>l.capture==='active').length}/>
      </dl>
      {links.length>0 && <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap gap-1">{links.map(l=><button key={l.name} type="button" onClick={()=>setSelected({kind:'link',id:l.name})} className="rounded focus:outline-none"><InterfaceBadge name={l.name}/></button>)}</div>}
      <div className="px-4 py-3"><div className="text-[11px] uppercase tracking-wider text-subtle mb-2">Sélection</div>{detail ?? <p className="text-subtle">Sélectionnez une fonction réseau, une interface, un UE ou une sonde.</p>}</div>
    </aside>}
  </div>;
}

function Row({k,v}) { return <div><dt className="text-[10.5px] uppercase tracking-wide text-subtle">{k}</dt><dd className="font-mono text-[12px] break-all text-foreground">{v ?? '—'}</dd></div>; }
function Stat({k,v}) { return <div><dt className="text-[10.5px] text-subtle">{k}</dt><dd className="font-mono text-[14px] font-semibold text-foreground tabular-nums">{v}</dd></div>; }
