import React, { useState } from 'react';
import { useAuditLog, useHealth, useVersion, useStorageSafety, available } from '@/lib/polaris-api';
import { Fail } from '../analyzer/SubscriberJourney';
import { NAV_MODULES, isVisible } from './modules';
import NetworkTopology from './NetworkTopology';
import CellReference from './CellReference';

const TABS = ['Node Manager','Network Topology','Référentiel cellules','Modules Visibility','System Settings','Audit Log'];
const th = 'h-8 px-4 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border-subtle';
const td = 'h-10 px-4 border-b border-border-subtle';
const recs = (d, k) => Array.isArray(d) ? d : Array.isArray(d?.[k]) ? d[k] : [];

function Modules({Card,hidden,onToggle}) {
  return <Card title="Visibilité des modules dans la navigation">
    <table className="w-full text-[12.5px]"><thead><tr>{['Module','Visible','État'].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{NAV_MODULES.map(m=>{ const on = isVisible(hidden,m.key); return <tr key={m.key}><td className={td}>{m.label}</td>
        <td className={td}><button type="button" role="switch" aria-checked={on} aria-label={`Visibilité ${m.label}`} disabled={m.locked} onClick={()=>onToggle(m.key)} className={`w-9 h-5 rounded-full relative transition ${on?'bg-[var(--app-accent)]':'bg-track'} disabled:opacity-60`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on?'left-[18px]':'left-0.5'}`}/></button></td>
        <td className={`${td} text-muted-foreground`}>{m.locked ? 'Toujours visible (protection contre le verrouillage)' : on ? 'Affiché' : 'Masqué — module conservé'}</td></tr>; })}</tbody></table>
    <div className="px-4 py-3 text-[11.5px] text-subtle">Masquer un module ne retire pas l'accès. Réglage enregistré sur ce navigateur ; les modules masqués sur le compte (création d'utilisateur) s'y ajoutent.</div>
  </Card>;
}

function System({Card,onSettings}) {
  const health = useHealth(), version = useVersion(), safety = useStorageSafety();
  const v = version.data?.data ?? {}, h = health.data?.data ?? {};
  const filesystem=safety.data?.data?.filesystem??{}, diskFree=typeof safety.data?.data?.free_percent==='number'?`${safety.data.data.free_percent} %`:typeof filesystem.usage_percent==='number'?`${Math.max(0,100-filesystem.usage_percent).toFixed(2)} % · ${available(filesystem.available_bytes)} octets libres`:'—';
  return <div className="space-y-5">
    <Card title="Plateforme"><div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[12.5px]">{[['État',h.status??h.mode??'connecté'],['POLARIS',v.platform_core],['API',v.backend_api],['Disque disponible',diskFree]].map(([l,x])=><div key={l} className="flex justify-between border-b border-border-subtle py-1.5"><span className="text-muted-foreground">{l}</span><span className="font-mono">{available(x)}</span></div>)}</div>
      {(health.isError||version.isError) && <div className="px-4 pb-4"><Fail q={health.isError?health:version} path={health.isError?'/health':'/version'}/></div>}</Card>
    <Card title="Préférences de l'interface" action={<button type="button" onClick={onSettings} className="h-8 px-3 rounded-md border border-border bg-white text-[12.5px] text-ink-2 hover:bg-surface-2">Ouvrir les paramètres</button>}><div className="p-4 text-[12.5px] text-muted-foreground">Langue et couleur.</div></Card>
  </div>;
}

function Audit({Card}) {
  const audit = useAuditLog(); const [q,setQ] = useState(''); const [open,setOpen] = useState(null);
  const list = recs(audit.data?.data,'events').filter(e=>!q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()));
  return <Card title="Audit Live Trace">
    <div className="px-4 py-3 border-b border-border-subtle"><input aria-label="Filtrer le journal" value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrer…" className="h-8 px-3 border border-border rounded-md text-[12.5px] w-64"/></div>
    {audit.isError ? <div className="p-4"><Fail q={audit} path="/audit"/></div> : <table className="w-full text-[12.5px]"><thead><tr>{['Horodatage','Utilisateur','Action','Résultat'].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{list.map((e,i)=><React.Fragment key={e.id??i}><tr onClick={()=>setOpen(open===i?null:i)} className="cursor-pointer hover:bg-surface-2"><td className={`${td} font-mono`}>{available(e.timestamp)}</td><td className={td}>{available(e.user)}</td><td className={td}>{available(e.action)}</td><td className={td}>{available(e.result)}</td></tr>
        {open===i && <tr><td colSpan="4" className="bg-surface-2 px-4 py-3"><pre className="text-[11.5px] whitespace-pre-wrap">{JSON.stringify(e,null,2)}</pre></td></tr>}</React.Fragment>)}
      {!list.length && <tr><td colSpan="4" className="p-4 text-subtle">{audit.isPending ? 'Connexion POLARIS…' : 'Aucun événement'}</td></tr>}</tbody></table>}
  </Card>;
}

export default function Administration({Card, nodeManager, hidden, onToggle, onSettings}) {
  const [tab,setTab] = useState(()=>{ try { return sessionStorage.getItem('polaris-admin-tab') || TABS[0]; } catch { return TABS[0]; } });
  const pick = x => { setTab(x); try { sessionStorage.setItem('polaris-admin-tab',x); } catch { /* ignore */ } };
  const [probeFocus,setProbeFocus] = useState(null);
  const openProbe = name => { setProbeFocus(name); pick('Node Manager'); };
  return <div className="flex-1 overflow-auto scroll-thin">
    <div className="polaris-content-shell px-8 pt-6 pb-7">
      <div className="text-[12px] text-muted-foreground">POLARIS</div>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-1">Administration</h1>
      <div role="tablist" aria-label="Administration" className="flex gap-1 border-b border-border mt-4 mb-5 overflow-x-auto scroll-thin">
        {TABS.map(x=><button key={x} role="tab" aria-selected={tab===x} onClick={()=>pick(x)} className={`relative shrink-0 h-10 px-3 text-[13px] ${tab===x?'text-foreground font-semibold':'text-muted-foreground hover:text-foreground'}`}>{x}{tab===x && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#0062A1]"/>}</button>)}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab==='Node Manager' ? (React.isValidElement(nodeManager) && probeFocus ? React.cloneElement(nodeManager,{key:probeFocus,initialOpen:probeFocus}) : nodeManager) : tab==='Network Topology' ? <NetworkTopology onOpenProbe={openProbe}/> : tab==='Référentiel cellules' ? <CellReference Card={Card}/> : tab==='Modules Visibility' ? <Modules Card={Card} hidden={hidden} onToggle={onToggle}/> : tab==='System Settings' ? <System Card={Card} onSettings={onSettings}/> : <Audit Card={Card}/>}
      </div>
    </div>
  </div>;
}
