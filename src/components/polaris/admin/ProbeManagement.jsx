import React, { useEffect, useMemo, useRef, useState } from 'react';
import { records, useManageProbe, useProbe, useProbeInterfaces } from '@/lib/polaris-api';
import ProbeForm, { Field, FooterButton, PayloadPreview, ProbeDialog, Section } from './ProbeForm';
import { emptyProbeDraft, probeDraftErrors, probeDraftFromRecord, probeUpdatePayload } from './probeRegistration';

const permissionFor = { edit: 'probes.update', delete: 'probes.delete', software: 'probes.software_update' };

export default function ProbeManagement({ mode, node, auth, onClose }) {
  const id = String(node.id ?? node.raw?.probe_id ?? node.n);
  const probe = useProbe(id), probeInterfaces = useProbeInterfaces(id);
  const mutation = useManageProbe();
  const initialized = useRef(false);
  const [draft, setDraft] = useState(emptyProbeDraft);
  const [confirmation, setConfirmation] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  const required = permissionFor[mode];
  const canManage = ['operator', 'administrator'].includes(auth?.role) && (permissions.includes(required) || permissions.includes('probes.manage'));
  useEffect(() => {
    if (initialized.current || probe.isPending || probeInterfaces.isPending) return;
    const record = { ...(node.raw ?? {}), ...(probe.data?.data ?? {}) };
    const items = records(probeInterfaces.data?.data, 'interfaces');
    setDraft(probeDraftFromRecord(record, items)); initialized.current = true;
  }, [node, probe.isPending, probe.data, probeInterfaces.isPending, probeInterfaces.data]);
  const errors = useMemo(() => probeDraftErrors(draft), [draft]);
  const patch = values => setDraft(current => ({ ...current, ...values }));
  const endpoint = mode === 'edit' ? `PUT /api/v1/probes/${id}` : mode === 'delete' ? `DELETE /api/v1/probes/${id}` : `POST /api/v1/probes/${id}/software-update`;
  const body = mode === 'edit' ? probeUpdatePayload(id, draft) : mode === 'delete' ? { confirmation: id, preserve_segments: true } : { target_version: targetVersion.trim(), confirmation: id, strategy: 'rolling', preserve_capture: true };
  const ready = mode === 'edit' ? errors.length === 0 : confirmation === id && (mode !== 'software' || targetVersion.trim().length > 0);
  const submit = event => {
    event.preventDefault();
    if (!canManage || !ready) return;
    mutation.mutate({ action: mode, id, body }, { onSuccess: onClose });
  };
  const permissionNote = canManage ? null : `Action verrouillée : \`/auth/me\` doit exposer \`${required}\`. Contrat attendu : ${endpoint}.`;
  const serverError = mutation.isError ? `${endpoint} → ${mutation.error?.status ? `HTTP ${mutation.error.status}` : mutation.error?.message}` : null;
  const footer = note => <>
    <span className="text-[12px] text-subtle">{note}</span>
    <span className="ml-auto flex items-center gap-2">
      <FooterButton onClick={onClose}>Annuler</FooterButton>
      <FooterButton type="submit" primary={mode !== 'delete'} danger={mode === 'delete'} disabled={!canManage || !ready || mutation.isPending}>
        {mutation.isPending ? 'En cours…' : mode === 'edit' ? 'Enregistrer' : mode === 'delete' ? 'Supprimer' : 'Mettre à jour'}
      </FooterButton>
    </span>
  </>;

  if (mode === 'edit') return <ProbeForm mode="edit" draft={draft} patch={patch} payload={body} endpoint={endpoint} probeId={id}
    canSubmit={canManage && ready} permissionNote={permissionNote} busy={mutation.isPending} serverError={serverError}
    submitLabel="Enregistrer" title="Modifier la sonde" dialogLabel="Modifier la sonde"
    subtitle="Registre OIRAN · les valeurs renvoyées par le serveur sont conservées telles quelles"
    onClose={onClose} onSubmit={submit} footerNote="Toute réussite vient du serveur et rafraîchit `/probes`."/>;

  return <ProbeDialog label={mode === 'delete' ? 'Supprimer la sonde' : 'Mettre à jour le logiciel'}
    height={mode === 'software' ? 'h-[min(720px,90vh)]' : 'h-[min(560px,90vh)]'}
    preview={<PayloadPreview payload={body} endpoint={endpoint}/>}
    title={mode === 'delete' ? 'Supprimer la sonde' : 'Mettre à jour le logiciel'}
    subtitle={mode === 'delete' ? 'Retrait du registre OIRAN · les segments déjà capturés sont conservés' : 'Stratégie rolling · la capture est préservée pendant la mise à jour'}
    identifier={id} onClose={onClose} onSubmit={submit}
    footer={footer(mode === 'delete' ? 'La confirmation tapée est exigée par le serveur.' : 'Aucune version n’est inventée : la cible est saisie par l’opérateur.')}>
    {mode === 'software' && <>
      <Section title="État servi par la sonde">
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between border-b border-border-subtle py-1.5"><span className="text-muted-foreground">Version servie</span><span className="font-mono text-[12.5px]">{node.ver ?? '—'}</span></div>
          <div className="flex justify-between border-b border-border-subtle py-1.5"><span className="text-muted-foreground">Capture</span><span>préservée pendant une mise à jour rolling</span></div>
        </div>
      </Section>
      <Field label="Version cible" required>
        <input aria-label="Version cible" value={targetVersion} onChange={event => setTargetVersion(event.target.value)} placeholder="2.12.0" className="h-10 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-[var(--app-accent)]"/>
      </Field>
    </>}
    <Field label="Confirmation" required help={`Tapez ${id} pour autoriser l'appel.`}>
      <input aria-label={`Tapez ${id}`} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 font-mono text-[13px] outline-none focus:border-[var(--app-accent)]"/>
    </Field>

    {permissionNote && <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-[12px] text-warning">{permissionNote}</div>}
    {serverError && <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[12px] text-danger">{serverError}</div>}
  </ProbeDialog>;
}
