import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { request, useAdminUsers, useAdminRoles, useAuditLog, useHealth, useVersion, useStorageSafety, available } from '@/lib/polaris-api';
import { Fail } from '../analyzer/SubscriberJourney';
import { NAV_MODULES, isVisible, toggleHidden, sanitizeHidden } from './modules';
import NetworkTopology from './NetworkTopology';
import LiveCapture from './LiveCapture';

const TABS = ['Node Manager','Network Topology','Users & Roles','Modules Visibility','System Settings','Audit Log'];
const PERMS = ['View','Create','Edit','Delete','Execute','Administer'];
const pending = 'Non disponible : backend à venir';
const th = 'h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#F2F2F2]';
const td = 'h-10 px-4 border-b border-[#F2F2F2]';
const recs = (d, k) => Array.isArray(d) ? d : Array.isArray(d?.[k]) ? d[k] : [];
const Btn = ({children,primary,...p}) => <button type="button" disabled title={pending} {...p} className={`h-8 px-3 rounded-md text-[12.5px] font-medium disabled:opacity-50 disabled:cursor-not-allowed ${primary?'bg-[var(--app-accent)] text-white':'border border-[#EBEBEB] bg-white text-[#4D4D4D]'}`}>{children}</button>;

function Switch({on,label,disabled,onClick}) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick} className={`w-9 h-5 rounded-full relative transition shrink-0 ${on?'bg-[var(--app-accent)]':'bg-[#D4D4D4]'} disabled:opacity-60`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on?'left-[18px]':'left-0.5'}`}/></button>;
}

// User creation: account fields + per-user module visibility, sent to the lab server which stores and enforces it.
function CreateUser({roles,onClose}) {
  const client = useQueryClient();
  const [f,setF] = useState({name:'',username:'',email:'',role:roles[0]?.name ?? 'viewer',password:''});
  const [hidden,setHidden] = useState([]); const [busy,setBusy] = useState(false); const [err,setErr] = useState(null);
  const set = k => e => setF(x=>({...x,[k]:e.target.value}));
  const roleNames = roles.length ? roles.map(r=>r.name).filter(Boolean) : ['viewer','operator','administrator'];
  const valid = f.username.trim().length>=2 && f.password.length>=8;
  const submit = async e => { e.preventDefault(); if(!valid) return; setBusy(true); setErr(null);
    try { await request('/users',{method:'POST',body:{...f,username:f.username.trim(),hidden_modules:sanitizeHidden(hidden),visible_modules:NAV_MODULES.filter(m=>isVisible(hidden,m.key)).map(m=>m.key)}}); client.invalidateQueries({queryKey:['polaris','api','/users']}); onClose(); }
    catch(x) { setErr(x); } finally { setBusy(false); } };
  const inp = 'h-9 w-full px-3 border border-[#EBEBEB] rounded-md text-[13px]';
  return <div role="dialog" aria-modal="true" aria-label="Créer un utilisateur" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
    <form onSubmit={submit} onClick={e=>e.stopPropagation()} className="w-full max-w-[720px] max-h-[90vh] overflow-auto rounded-xl bg-white shadow-xl">
      <div className="px-6 py-4 border-b border-[#F2F2F2] flex items-center justify-between"><h2 className="text-[16px] font-semibold">Créer un utilisateur</h2><button type="button" aria-label="Fermer" onClick={onClose} className="text-[#8F8F8F] text-[18px]">×</button></div>
      <div className="p-6 grid grid-cols-2 gap-6">
        <div className="space-y-3 text-[12.5px]">
          <div className="text-[11px] font-semibold tracking-wider text-[#8F8F8F] uppercase">Compte</div>
          {[['name','Nom complet','text'],['username','Identifiant','text'],['email','E-mail','email'],['password','Mot de passe (8 caractères min.)','password']].map(([k,l,ty])=><label key={k} className="block"><span className="text-[#666666]">{l}</span><input type={ty} value={f[k]} onChange={set(k)} autoComplete={ty==='password'?'new-password':'off'} className={inp}/></label>)}
          <label className="block"><span className="text-[#666666]">Rôle</span><select value={f.role} onChange={set('role')} className={inp}>{roleNames.map(r=><option key={r}>{r}</option>)}</select></label>
        </div>
        <div className="text-[12.5px]">
          <div className="text-[11px] font-semibold tracking-wider text-[#8F8F8F] uppercase mb-3">Visibilité des modules</div>
          <div className="rounded-lg border border-[#F2F2F2] divide-y divide-[#F2F2F2]">{NAV_MODULES.map(m=>{ const on=isVisible(hidden,m.key); return <div key={m.key} className="flex items-center justify-between px-3 h-10"><span>{m.label}{m.locked && <span className="ml-2 text-[11px] text-[#8F8F8F]">toujours visible</span>}</span><Switch on={on} label={`Visibilité ${m.label} pour cet utilisateur`} disabled={m.locked} onClick={()=>setHidden(h=>toggleHidden(h,m.key))}/></div>; })}</div>
          <div className="mt-2 text-[11.5px] text-[#8F8F8F]">Masque les modules dans la navigation de cet utilisateur ; les droits restent ceux du rôle.</div>
        </div>
      </div>
      {err && <div role="alert" className="mx-6 mb-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#64748B]">{[404,405,501].includes(err.status)?pending:'Échec'} · <span className="font-mono">POST /api/v1/users</span> → {err.status?`HTTP ${err.status}`:'réseau'}{err.status===403?' · Accès refusé (rôle)':''}</div>}
      <div className="px-6 py-4 border-t border-[#F2F2F2] flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-[#EBEBEB] text-[13px]">Annuler</button><button type="submit" disabled={!valid||busy} className="h-9 px-4 rounded-md bg-[var(--app-accent)] text-white text-[13px] font-medium disabled:opacity-50">{busy?'Création…':'Créer l\'utilisateur'}</button></div>
    </form>
  </div>;
}

function Users({Card}) {
  const users = useAdminUsers(), roles = useAdminRoles();
  const [q,setQ] = useState(''), [st,setSt] = useState(''), [creating,setCreating] = useState(false);
  const list = recs(users.data?.data,'users').filter(u => (!q || `${u.name??''} ${u.username??''} ${u.email??''}`.toLowerCase().includes(q.toLowerCase())) && (!st || (u.enabled===false?'disabled':'enabled')===st));
  const roleList = recs(roles.data?.data,'roles');
  return <div className="space-y-5">
    <Card title="Utilisateurs" action={<div className="flex gap-2"><button type="button" onClick={()=>setCreating(true)} className="h-8 px-3 rounded-md text-[12.5px] font-medium bg-[var(--app-accent)] text-white">Créer un utilisateur</button></div>}>
      {creating && <CreateUser roles={roleList} onClose={()=>setCreating(false)}/>}
      <div className="flex gap-2 px-4 py-3 border-b border-[#F2F2F2]"><input aria-label="Rechercher un utilisateur" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" className="h-8 px-3 border border-[#EBEBEB] rounded-md text-[12.5px] w-64"/>
        <select aria-label="Statut" value={st} onChange={e=>setSt(e.target.value)} className="h-8 px-2 border border-[#EBEBEB] rounded-md text-[12.5px]"><option value="">Tous</option><option value="enabled">Actifs</option><option value="disabled">Désactivés</option></select></div>
      {users.isError ? <div className="p-4"><Fail q={users} path="/users"/></div> : <table className="w-full text-[12.5px]"><thead><tr>{['Utilisateur','Rôle','Modules','Statut','Dernière connexion',''].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{list.map((u,i)=><tr key={u.id??i}><td className={td}>{available(u.name ?? u.username)}</td><td className={td}>{available(u.role)}</td><td className={td}>{Array.isArray(u.hidden_modules) ? `${NAV_MODULES.filter(m=>isVisible(sanitizeHidden(u.hidden_modules),m.key)).length}/${NAV_MODULES.length}` : '—'}</td><td className={td}>{u.enabled===false?'Désactivé':'Actif'}</td><td className={td}>{available(u.last_login)}</td><td className={`${td} text-right space-x-2`}><Btn>Modifier</Btn><Btn>{u.enabled===false?'Activer':'Désactiver'}</Btn></td></tr>)}
        {!list.length && <tr><td colSpan="6" className="p-4 text-[#8F8F8F]">{users.isPending ? 'Connexion POLARIS…' : 'Aucun utilisateur'}</td></tr>}</tbody></table>}
    </Card>
    <Card title="Rôles et permissions" action={<Btn primary>Créer un rôle</Btn>}>
      {roles.isError ? <div className="p-4"><Fail q={roles} path="/roles"/></div> : <table className="w-full text-[12.5px]"><thead><tr>{['Rôle',...PERMS,'Utilisateurs',''].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{roleList.map((r,i)=>{ const p = (r.permissions??[]).map(x=>String(x).toLowerCase()); return <tr key={r.id??i}><td className={td}>{available(r.name)}</td>{PERMS.map(x=><td key={x} className={td}>{p.includes(x.toLowerCase())?'✓':'—'}</td>)}<td className={td}>{available(r.user_count)}</td><td className={`${td} text-right`}><Btn>Modifier</Btn></td></tr>; })}
        {!roleList.length && <tr><td colSpan={PERMS.length+3} className="p-4 text-[#8F8F8F]">{roles.isPending ? 'Connexion POLARIS…' : 'Aucun rôle'}</td></tr>}</tbody></table>}
    </Card>
    <div className="text-[11.5px] text-[#8F8F8F]">Les droits sont appliqués par le serveur POLARIS ; cette page n'accorde aucun accès.</div>
  </div>;
}

function Modules({Card,hidden,onToggle}) {
  return <Card title="Visibilité des modules dans la navigation">
    <table className="w-full text-[12.5px]"><thead><tr>{['Module','Visible','État'].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{NAV_MODULES.map(m=>{ const on = isVisible(hidden,m.key); return <tr key={m.key}><td className={td}>{m.label}</td>
        <td className={td}><button type="button" role="switch" aria-checked={on} aria-label={`Visibilité ${m.label}`} disabled={m.locked} onClick={()=>onToggle(m.key)} className={`w-9 h-5 rounded-full relative transition ${on?'bg-[var(--app-accent)]':'bg-[#D4D4D4]'} disabled:opacity-60`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on?'left-[18px]':'left-0.5'}`}/></button></td>
        <td className={`${td} text-[#666666]`}>{m.locked ? 'Toujours visible (protection contre le verrouillage)' : on ? 'Affiché' : 'Masqué — module conservé'}</td></tr>; })}</tbody></table>
    <div className="px-4 py-3 text-[11.5px] text-[#8F8F8F]">Masquer un module ne retire pas l'accès. Réglage enregistré sur ce navigateur ; les modules masqués sur le compte (création d'utilisateur) s'y ajoutent.</div>
  </Card>;
}

function System({Card,onSettings}) {
  const health = useHealth(), version = useVersion(), safety = useStorageSafety();
  const v = version.data?.data ?? {}, h = health.data?.data ?? {};
  return <div className="space-y-5">
    <Card title="Plateforme"><div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[12.5px]">{[['État',h.status],['POLARIS',v.platform_core],['API',v.backend_api],['Disque disponible',safety.data?.data?.free_percent]].map(([l,x])=><div key={l} className="flex justify-between border-b border-[#F2F2F2] py-1.5"><span className="text-[#666666]">{l}</span><span className="font-mono">{available(x)}</span></div>)}</div>
      {(health.isError||version.isError) && <div className="px-4 pb-4"><Fail q={health.isError?health:version} path={health.isError?'/health':'/version'}/></div>}</Card>
    <Card title="Préférences de l'interface" action={<button type="button" onClick={onSettings} className="h-8 px-3 rounded-md border border-[#EBEBEB] bg-white text-[12.5px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Ouvrir les paramètres</button>}><div className="p-4 text-[12.5px] text-[#666666]">Langue, couleur et mot de passe.</div></Card>
  </div>;
}

function Audit({Card}) {
  const audit = useAuditLog(); const [q,setQ] = useState(''); const [open,setOpen] = useState(null);
  const list = recs(audit.data?.data,'events').filter(e=>!q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()));
  return <Card title="Journal d'audit">
    <div className="px-4 py-3 border-b border-[#F2F2F2]"><input aria-label="Filtrer le journal" value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrer…" className="h-8 px-3 border border-[#EBEBEB] rounded-md text-[12.5px] w-64"/></div>
    {audit.isError ? <div className="p-4"><Fail q={audit} path="/audit"/></div> : <table className="w-full text-[12.5px]"><thead><tr>{['Horodatage','Utilisateur','Action','Résultat'].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{list.map((e,i)=><React.Fragment key={e.id??i}><tr onClick={()=>setOpen(open===i?null:i)} className="cursor-pointer hover:bg-[#FAFAFA]"><td className={`${td} font-mono`}>{available(e.timestamp)}</td><td className={td}>{available(e.user)}</td><td className={td}>{available(e.action)}</td><td className={td}>{available(e.result)}</td></tr>
        {open===i && <tr><td colSpan="4" className="bg-[#FAFAFA] px-4 py-3"><pre className="text-[11.5px] whitespace-pre-wrap">{JSON.stringify(e,null,2)}</pre></td></tr>}</React.Fragment>)}
      {!list.length && <tr><td colSpan="4" className="p-4 text-[#8F8F8F]">{audit.isPending ? 'Connexion POLARIS…' : 'Aucun événement'}</td></tr>}</tbody></table>}
  </Card>;
}

export default function Administration({Card, nodeManager, hidden, onToggle, onSettings}) {
  const [tab,setTab] = useState(()=>{ try { return sessionStorage.getItem('polaris-admin-tab') || TABS[0]; } catch { return TABS[0]; } });
  const pick = x => { setTab(x); try { sessionStorage.setItem('polaris-admin-tab',x); } catch { /* ignore */ } };
  return <div className="flex-1 overflow-auto scroll-thin">
    <div className="polaris-content-shell px-8 pt-6 pb-7">
      <div className="text-[12px] text-[#666666]">POLARIS</div>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">Administration</h1>
      <div role="tablist" aria-label="Administration" className="flex gap-1 border-b border-[#EBEBEB] mt-4 mb-5 overflow-x-auto scroll-thin">
        {TABS.map(x=><button key={x} role="tab" aria-selected={tab===x} onClick={()=>pick(x)} className={`relative shrink-0 h-10 px-3 text-[13px] ${tab===x?'text-[#171717] font-semibold':'text-[#666666] hover:text-[#171717]'}`}>{x}{tab===x && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#0062A1]"/>}</button>)}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab==='Node Manager' ? <>{nodeManager}<LiveCapture/></> : tab==='Network Topology' ? <NetworkTopology/> : tab==='Users & Roles' ? <Users Card={Card}/> : tab==='Modules Visibility' ? <Modules Card={Card} hidden={hidden} onToggle={onToggle}/> : tab==='System Settings' ? <System Card={Card} onSettings={onSettings}/> : <Audit Card={Card}/>}
      </div>
    </div>
  </div>;
}
