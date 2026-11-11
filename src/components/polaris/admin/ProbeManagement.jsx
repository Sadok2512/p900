import React, { useEffect, useMemo, useRef, useState } from 'react';
import { records, useManageProbe, useProbe, useProbeInterfaces } from '@/lib/polaris-api';
import { emptyProbeDraft, probeDraftErrors, probeDraftFromRecord, probeUpdatePayload } from './probeRegistration';

const roles=['N2','N3','N4','S1','N6'];
const field='h-9 w-full rounded-md border border-[#DADADA] bg-white px-3 text-[12.5px] text-[#171717] outline-none focus:border-[var(--app-accent)]';
const permissionFor={edit:'probes.update',delete:'probes.delete',software:'probes.software_update'};

export default function ProbeManagement({ mode, node, auth, onClose }) {
  const id=String(node.id ?? node.raw?.probe_id ?? node.n);
  const probe=useProbe(id), probeInterfaces=useProbeInterfaces(id);
  const mutation=useManageProbe();
  const initialized=useRef(false);
  const [draft,setDraft]=useState(emptyProbeDraft);
  const [confirmation,setConfirmation]=useState('');
  const [targetVersion,setTargetVersion]=useState('');
  const permissions=Array.isArray(auth?.permissions)?auth.permissions:[];
  const required=permissionFor[mode];
  const canManage=['operator','administrator'].includes(auth?.role) && (permissions.includes(required)||permissions.includes('probes.manage'));
  useEffect(()=>{
    if(initialized.current || probe.isPending || probeInterfaces.isPending) return;
    const record={...(node.raw??{}),...(probe.data?.data??{})};
    const items=records(probeInterfaces.data?.data,'interfaces');
    setDraft(probeDraftFromRecord(record,items)); initialized.current=true;
  },[node,probe.isPending,probe.data,probeInterfaces.isPending,probeInterfaces.data]);
  const errors=useMemo(()=>probeDraftErrors(draft),[draft]);
  const patch=values=>setDraft(current=>({...current,...values}));
  const patchInterface=(index,values)=>patch({interfaces:draft.interfaces.map((item,itemIndex)=>itemIndex===index?{...item,...values}:item)});
  const endpoint=mode==='edit'?`PUT /api/v1/probes/${id}`:mode==='delete'?`DELETE /api/v1/probes/${id}`:`POST /api/v1/probes/${id}/software-update`;
  const ready=mode==='edit'?errors.length===0:confirmation===id && (mode!=='software'||targetVersion.trim().length>0);
  const submit=event=>{
    event.preventDefault(); if(!canManage||!ready) return;
    const body=mode==='edit'?probeUpdatePayload(id,draft):mode==='delete'?{confirmation:id,preserve_segments:true}:{target_version:targetVersion.trim(),confirmation:id,strategy:'rolling',preserve_capture:true};
    mutation.mutate({action:mode,id,body},{onSuccess:onClose});
  };
  return <div className="fixed inset-0 z-[80] bg-black/20 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={mode==='edit'?'Modifier la sonde':mode==='delete'?'Supprimer la sonde':'Mettre à jour le logiciel'}>
    <form onSubmit={submit} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-[#E5E5E5] bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-[#EBEBEB] bg-white px-5 py-4"><div><h2 className="text-[15px] font-semibold">{mode==='edit'?'Modifier la sonde':mode==='delete'?'Supprimer la sonde':'Mettre à jour le logiciel'}</h2><p className="mt-1 font-mono text-[11.5px] text-[#666666]">{id}</p></div><button type="button" onClick={onClose} className="ml-auto h-8 px-3 rounded-md border border-[#EBEBEB] text-[12px]">Annuler</button></header>
      <div className="space-y-5 p-5">
        {mode==='edit' && <>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de sonde">{[['virtual','vProbe'],['physical','Sonde physique']].map(([value,label])=><button key={value} type="button" onClick={()=>patch({probe_type:value})} className={`h-10 rounded-md border text-[12.5px] ${draft.probe_type===value?'border-[var(--app-accent)] bg-[#F7F7F7] font-semibold':'border-[#E5E5E5]'}`}>{label}</button>)}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-[12px] text-[#4D4D4D]">Nom*<input aria-label="Nom de la sonde" value={draft.name} onChange={event=>patch({name:event.target.value})} className={field}/></label>
            <label className="text-[12px] text-[#4D4D4D]">probe_id<input aria-label="Identifiant de la sonde" readOnly value={id} className={`${field} bg-[#F7F7F7] font-mono`}/></label>
            <label className="text-[12px] text-[#4D4D4D]">Serveur / namespace*<input aria-label="Serveur ou namespace" value={draft.host} onChange={event=>patch({host:event.target.value})} className={field}/></label>
            <label className="text-[12px] text-[#4D4D4D]">Adresse de gestion*<input aria-label="Adresse de gestion" value={draft.mgmt_ip} onChange={event=>patch({mgmt_ip:event.target.value})} className={field}/></label>
            <label className="text-[12px] text-[#4D4D4D] md:col-span-2">Site*<input aria-label="Site de la sonde" value={draft.site} onChange={event=>patch({site:event.target.value})} className={field}/></label>
          </div>
          <section className="rounded-lg border border-[#EBEBEB]"><header className="flex items-center border-b border-[#EBEBEB] px-4 py-3"><h3 className="text-[12.5px] font-semibold">Interfaces · {draft.interfaces.length}</h3><button type="button" onClick={()=>patch({interfaces:[...draft.interfaces,{interface:'',role:'N2',bpf_filter:''}]})} className="ml-auto text-[12px] font-medium">+ Ajouter</button></header><div className="space-y-3 p-4">{draft.interfaces.map((item,index)=><div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_1.5fr_auto]"><input aria-label={`Interface ${index+1}`} value={item.interface} onChange={event=>patchInterface(index,{interface:event.target.value})} className={field}/><select aria-label={`Rôle ${index+1}`} value={item.role} onChange={event=>patchInterface(index,{role:event.target.value})} className={field}>{roles.map(role=><option key={role}>{role}</option>)}</select><input aria-label={`Filtre BPF ${index+1}`} value={item.bpf_filter} onChange={event=>patchInterface(index,{bpf_filter:event.target.value})} className={field}/><button type="button" onClick={()=>patch({interfaces:draft.interfaces.filter((_,itemIndex)=>itemIndex!==index)})} className="h-9 px-2 text-[12px] text-[#B42318]">− Retirer</button></div>)}</div></section>
          {errors.map(error=><div key={error} className="text-[12px] text-[#A15C07]">· {error}</div>)}
        </>}
        {mode==='software' && <><div className="rounded-lg border border-[#EBEBEB] p-4 text-[12.5px]"><div className="flex justify-between"><span className="text-[#666666]">Version servie</span><span className="font-mono">{node.ver??'—'}</span></div><div className="mt-2 flex justify-between"><span className="text-[#666666]">Capture</span><span>préservée pendant une mise à jour rolling</span></div></div><label className="block text-[12px] text-[#4D4D4D]">Version cible*<input aria-label="Version cible" value={targetVersion} onChange={event=>setTargetVersion(event.target.value)} placeholder="2.12.0" className={field}/></label></>}
        {mode==='delete' && <div className="rounded-lg border border-[#F5C6C2] bg-[#FDEFEE] p-4 text-[12.5px] text-[#7A271A]">La sonde sera retirée du registre. Ses segments déjà capturés ne seront pas supprimés.</div>}
        {mode!=='edit' && <label className="block text-[12px] text-[#4D4D4D]">Tapez <span className="font-mono font-semibold">{id}</span> pour confirmer<input aria-label={`Tapez ${id}`} value={confirmation} onChange={event=>setConfirmation(event.target.value)} className={field}/></label>}
        {!canManage && <div className="rounded-lg bg-[#FDF6E7] p-3 text-[12px] text-[#A15C07]">Action verrouillée : `/auth/me` doit exposer `{required}`. Contrat attendu : {endpoint}.</div>}
        {mutation.isError && <div role="alert" className="text-[12px] text-[#B42318]">{endpoint} → {mutation.error?.status?`HTTP ${mutation.error.status}`:mutation.error?.message}</div>}
      </div>
      <footer className="sticky bottom-0 flex items-center border-t border-[#EBEBEB] bg-white px-5 py-4"><span className="text-[11.5px] text-[#8F8F8F]">Toute réussite vient du serveur et rafraîchit `/probes`.</span><button type="button" onClick={onClose} className="ml-auto h-9 px-4 text-[12.5px]">Annuler</button><button type="submit" disabled={!canManage||!ready||mutation.isPending} className={`h-9 px-4 rounded-md text-white text-[12.5px] font-medium disabled:opacity-40 ${mode==='delete'?'bg-[#B42318]':'bg-[var(--app-accent)]'}`}>{mutation.isPending?'En cours…':mode==='edit'?'Enregistrer':mode==='delete'?'Supprimer':'Mettre à jour'}</button></footer>
    </form>
  </div>;
}
