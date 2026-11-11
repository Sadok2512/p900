import React, { useMemo, useState } from 'react';
import { useCreateProbe } from '@/lib/polaris-api';
import { emptyProbeDraft, probeDraftErrors, probeIdFor, probePayload } from './probeRegistration';

const roles = ['N2', 'N3', 'N4', 'S1', 'N6'];
const field = 'h-9 w-full rounded-md border border-border bg-white px-3 text-[12.5px] text-foreground outline-none focus:border-[var(--app-accent)]';

export default function ProbeRegistration({ auth, backendVersion, onClose }) {
  const [draft, setDraft] = useState(emptyProbeDraft);
  const mutation = useCreateProbe();
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  const canRegister = ['operator', 'administrator'].includes(auth?.role) && permissions.includes('probes.create');
  const errors = useMemo(() => probeDraftErrors(draft), [draft]);
  const payload = useMemo(() => probePayload(draft), [draft]);
  const patch = values => setDraft(current => ({ ...current, ...values }));
  const patchInterface = (index, values) => patch({ interfaces: draft.interfaces.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) });
  const submit = event => {
    event.preventDefault();
    if (!canRegister || errors.length) return;
    mutation.mutate(payload, { onSuccess: onClose });
  };
  return <div className="fixed inset-0 z-[80] bg-black/20 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Register probe">
    <form onSubmit={submit} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-border bg-white px-5 py-4">
        <div><h2 className="text-[15px] font-semibold text-foreground">Register probe</h2><p className="mt-1 text-[12px] text-muted-foreground">Persistent OIRAN registry · operator or administrator · API {backendVersion ?? '—'}</p></div>
        <button type="button" onClick={onClose} className="ml-auto h-8 px-3 rounded-md border border-border text-[12px]">Cancel</button>
      </header>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Probe type">
          {[['virtual','vProbe'],['physical','Physical probe']].map(([value,label]) => <button key={value} type="button" onClick={() => patch({ probe_type: value })} className={`h-10 rounded-md border text-[12.5px] ${draft.probe_type===value?'border-[var(--app-accent)] bg-surface-2 font-semibold':'border-border'}`}>{label}</button>)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[12px] text-ink-2">Name*<input autoFocus aria-label="Probe name" value={draft.name} onChange={event=>patch({name:event.target.value})} placeholder="Lab vProbe · site-A" className={field}/></label>
          <label className="text-[12px] text-ink-2">probe_id (auto)<input aria-label="Probe id" readOnly value={probeIdFor(draft)} className={`${field} bg-surface-2 font-mono`}/></label>
          <label className="text-[12px] text-ink-2">Lab host*<input aria-label="Lab host" value={draft.host} onChange={event=>patch({host:event.target.value})} placeholder="namespace.container.local" className={field}/></label>
          <label className="text-[12px] text-ink-2">Management address*<input aria-label="Management address" value={draft.mgmt_ip} onChange={event=>patch({mgmt_ip:event.target.value})} placeholder="10.77.0.1" className={field}/></label>
          <label className="text-[12px] text-ink-2 md:col-span-2">Site*<input aria-label="Site" value={draft.site} onChange={event=>patch({site:event.target.value})} placeholder="Lab A · rack 03" className={field}/></label>
        </div>
        <section className="rounded-lg border border-border">
          <header className="flex items-center border-b border-border px-4 py-3"><h3 className="text-[12.5px] font-semibold">Interfaces · {draft.interfaces.length}</h3><button type="button" onClick={()=>patch({interfaces:[...draft.interfaces,{interface:'',role:'N2',bpf_filter:''}]})} className="ml-auto text-[12px] font-medium">Add interface</button></header>
          <div className="space-y-3 p-4">{draft.interfaces.map((item,index)=><div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_1.5fr_auto]">
            <input aria-label={`Interface ${index+1}`} value={item.interface} onChange={event=>patchInterface(index,{interface:event.target.value})} placeholder="ens3" className={field}/>
            <select aria-label={`Role ${index+1}`} value={item.role} onChange={event=>patchInterface(index,{role:event.target.value})} className={field}>{roles.map(role=><option key={role}>{role}</option>)}</select>
            <input aria-label={`BPF filter ${index+1}`} value={item.bpf_filter} onChange={event=>patchInterface(index,{bpf_filter:event.target.value})} placeholder="sctp port 38412" className={field}/>
            <button type="button" disabled={draft.interfaces.length===1} onClick={()=>patch({interfaces:draft.interfaces.filter((_,itemIndex)=>itemIndex!==index)})} className="h-9 px-2 text-[12px] text-danger disabled:opacity-30">Remove</button>
          </div>)}</div>
        </section>
        <div className="rounded-lg bg-surface-2 p-4"><div className="mb-2 flex items-center"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payload preview (POST /probes)</span><button type="button" onClick={()=>navigator.clipboard?.writeText(JSON.stringify(payload,null,2))} className="ml-auto text-[11.5px]">Copy</button></div><pre className="overflow-x-auto text-[11.5px] leading-5 text-foreground">{JSON.stringify(payload,null,2)}</pre></div>
        <div aria-live="polite" className="text-[12px]">
          {errors.map(error=><div key={error} className="text-warning">· {error}</div>)}
          {!canRegister && <div className="mt-2 text-warning">Registration locked: `/auth/me` must expose operator/administrator with `probes.create`.</div>}
          {mutation.isError && <div role="alert" className="mt-2 text-danger">POST /api/v1/probes → {mutation.error?.status ? `HTTP ${mutation.error.status}` : mutation.error?.message}</div>}
        </div>
      </div>
      <footer className="sticky bottom-0 flex items-center border-t border-border bg-white px-5 py-4"><span className="text-[11.5px] text-subtle">No capture process is started by registration.</span><button type="button" onClick={onClose} className="ml-auto h-9 px-4 text-[12.5px]">Cancel</button><button type="submit" disabled={!canRegister || errors.length>0 || mutation.isPending} className="h-9 px-4 rounded-md bg-[var(--app-accent)] text-white text-[12.5px] font-medium disabled:opacity-40">{mutation.isPending?'Registering…':'Register'}</button></footer>
    </form>
  </div>;
}
