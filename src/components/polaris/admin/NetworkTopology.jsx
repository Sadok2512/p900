import React, { useMemo, useState } from 'react';
import { useInterfaces, useLiveMetrics, usePolarisLab, usePolarisNodes, usePolarisUes, records, available } from '@/lib/polaris-api';

const CORE_5G = ['AMF','SMF','UPF','NRF','AUSF','UDM','UDR','PCF','NSSF','BSF'];
const CORE_LTE = ['MME','SGWC','SGWU','PGW-C','PGW-U','HSS','PCRF'];
const tones = { ok: 'bg-success', warn: 'bg-warning', error: 'bg-danger', unknown: 'bg-subtle' };
const Dot = ({tone='unknown'}) => <span className={`inline-block w-2 h-2 rounded-full ${tones[tone] ?? tones.unknown}`}/>;

const itemList = value => records(value?.items ?? value, 'items');
const textState = value => String(value ?? '').toLowerCase();
const processTone = value => ['running','healthy','active','connected','ready','up'].includes(textState(value)) ? 'ok' : ['starting','degraded','warning'].includes(textState(value)) ? 'warn' : value == null ? 'unknown' : 'error';

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

function Core({title, catalogue, observed, onSelect, selected}) {
  const nfs = Object.fromEntries((Array.isArray(observed?.nfs)?observed.nfs:Object.values(observed?.nfs??{})).map(nf=>[String(nf?.nf??nf?.name??'').toUpperCase(),nf]));
  return <section className="rounded-xl border border-border bg-card p-3">
    <div className="flex justify-between gap-3 mb-2"><strong className="text-[13px]">{title}</strong><span className="text-[11px] text-subtle">source /lab</span></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">{catalogue.map(name=>{ const nf=nfs[name.toUpperCase()], state=nf?.process_state ?? nf?.health ?? observed?.open5gs?.process_state; const tone=processTone(state); return <button type="button" key={name} onClick={()=>onSelect({kind:'NF',name,state,...nf})} className={`text-left rounded-md border p-2 ${selected?.name===name?'border-[var(--app-accent)]':'border-border-subtle'}`}><span className="flex items-center gap-1.5 font-mono text-[12px]"><Dot tone={tone}/>{name}</span><span className="block text-[11px] text-subtle mt-0.5">{available(state)}</span></button>; })}</div>
  </section>;
}

function Link({name,tone}) { return <div className="flex flex-col items-center py-1" title={`${name} · capture ${tone}`}><span className="h-5 border-l border-border-strong"/><span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground"><Dot tone={tone}/>{name}</span><span className="h-5 border-l border-border-strong"/></div>; }

function AccessNode({node,ues,interfaces,metrics,onSelect,selected}) {
  const id=String(node.id ?? node.name ?? '—'); const lte=/LTE/i.test(String(node.technology)); const links=lte?['S1-MME','S1-U']:['N2','N3'];
  return <div className="flex flex-col items-center">
    <div className="grid grid-cols-2 gap-8">{links.map(name=><Link key={name} name={name} tone={captureLinkTone(name,interfaces,metrics)}/>)}</div>
    <button type="button" onClick={()=>onSelect({kind:lte?'eNB':'gNB',name:id,...node})} className={`min-w-52 rounded-lg border bg-card px-4 py-3 text-left ${selected?.name===id?'border-[var(--app-accent)]':'border-border'}`}><span className="flex items-center gap-2 font-mono text-[13px]"><Dot tone={processTone(node.process_state)}/>{id}</span><span className="block text-[11px] text-subtle mt-1">{available(node.technology)} · {available(node.simulator)}</span></button>
    <div className="h-6 border-l border-border-strong"/>
    <div className="flex flex-wrap justify-center gap-1.5 max-w-md">{ues.length?ues.map((ue,index)=>{ const name=String(ue.id ?? ue.ue_id ?? `UE ${index+1}`); return <button type="button" key={name} onClick={()=>onSelect({kind:'UE',name,...ue})} className={`rounded-md border px-2 py-1 font-mono text-[11px] ${selected?.name===name?'border-[var(--app-accent)]':'border-border'}`}>{name}</button>; }):<span className="text-[11px] text-subtle">Aucun UE rattaché</span>}</div>
  </div>;
}

export default function NetworkTopology() {
  const lab=usePolarisLab(), nodesQ=usePolarisNodes(), uesQ=usePolarisUes(), interfacesQ=useInterfaces(), metricsQ=useLiveMetrics();
  const [zoom,setZoom]=useState(100), [selected,setSelected]=useState(null);
  const nodes=itemList(nodesQ.data?.data), ues=itemList(uesQ.data?.data), interfaces=records(interfacesQ.data?.data,'interfaces'), metrics=metricsQ.data?.data ?? {};
  const byNode=useMemo(()=>{ const map=new Map(); for(const ue of ues){ const key=String(ue.serving_node ?? ue.node_id ?? 'UNASSIGNED'); map.set(key,[...(map.get(key)??[]),ue]); } return map; },[ues]);
  const observed=lab.data?.data?.observed ?? lab.data?.data ?? {};
  const error=lab.error||nodesQ.error||uesQ.error;
  if(error) return <div className="rounded-lg border border-border bg-surface-2 p-4 text-[12px] text-muted-foreground">POLARIS Simulator non connecté · GET /polaris-api/v1/lab, /nodes, /ues</div>;
  return <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4">
    <section className="rounded-lg border border-border bg-surface-2 overflow-auto min-h-[560px]">
      <header className="sticky top-0 z-10 h-11 bg-card border-b border-border flex items-center px-3 gap-2"><strong className="text-[13px]">Topologie Simulator</strong><span className="text-[11px] text-subtle">mêmes sources, actualisation 5 s</span><div className="ml-auto flex gap-1"><button onClick={()=>setZoom(z=>Math.max(60,z-10))} className="h-7 w-7 border rounded">−</button><button onClick={()=>setZoom(100)} className="h-7 px-2 border rounded text-[11px]">{zoom}%</button><button onClick={()=>setZoom(z=>Math.min(160,z+10))} className="h-7 w-7 border rounded">+</button></div></header>
      <div className="p-4 origin-top transition-transform" style={{transform:`scale(${zoom/100})`,width:`${10000/zoom}%`}}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="space-y-3"><h2 className="font-semibold text-[14px]">5G SA — UERANSIM</h2><Core title="Open5GS 5GC" catalogue={CORE_5G} observed={observed} onSelect={setSelected} selected={selected}/>{nodes.filter(n=>String(n.technology).includes('5G')).map(n=><AccessNode key={n.id} node={n} ues={byNode.get(String(n.id))??[]} interfaces={interfaces} metrics={metrics} onSelect={setSelected} selected={selected}/>)}</div>
          <div className="space-y-3"><h2 className="font-semibold text-[14px]">LTE 4G — srsRAN</h2><Core title="Open5GS EPC" catalogue={CORE_LTE} observed={observed} onSelect={setSelected} selected={selected}/>{nodes.filter(n=>/LTE/i.test(String(n.technology))).map(n=><AccessNode key={n.id} node={n} ues={byNode.get(String(n.id))??[]} interfaces={interfaces} metrics={metrics} onSelect={setSelected} selected={selected}/>)}</div>
        </div>
      </div>
    </section>
    <aside className="rounded-lg border border-border bg-card p-4 text-[12px]"><div className="font-semibold mb-3">Détails</div>{selected?<dl className="space-y-2">{Object.entries(selected).filter(([key,value])=>!['subscriber_identity','imsi','supi','suci','imei','msisdn'].includes(key)&&['string','number','boolean'].includes(typeof value)).map(([key,value])=><div key={key}><dt className="text-[11px] uppercase text-subtle">{key}</dt><dd className="font-mono break-all">{String(value)}</dd></div>)}</dl>:<p className="text-subtle">Sélectionnez un NF, un nœud radio ou un UE.</p>}<div className="mt-4 pt-3 border-t text-[11px] text-subtle"><div className="flex gap-3"><span><Dot tone="ok"/> actif + ingéré</span><span><Dot tone="warn"/> retard</span><span><Dot tone="error"/> arrêté</span></div></div></aside>
  </div>;
}
