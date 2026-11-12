import React, { useMemo, useState } from 'react';
import { useCreateProbe } from '@/lib/polaris-api';
import ProbeForm from './ProbeForm';
import { emptyProbeDraft, probePayload } from './probeRegistration';

export default function ProbeRegistration({ auth, backendVersion, onClose }) {
  const [draft, setDraft] = useState(emptyProbeDraft);
  const mutation = useCreateProbe();
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  const canRegister = ['operator', 'administrator'].includes(auth?.role) && permissions.includes('probes.create');
  const payload = useMemo(() => probePayload(draft), [draft]);
  const patch = values => setDraft(current => ({ ...current, ...values }));
  const submit = event => {
    event.preventDefault();
    if (!canRegister) return;
    mutation.mutate(payload, { onSuccess: onClose });
  };
  const permissionNote = canRegister ? null : 'Enregistrement verrouillé : `/auth/me` doit exposer le rôle operator ou administrator avec `probes.create`.';
  const serverError = mutation.isError ? `POST /api/v1/probes → ${mutation.error?.status ? `HTTP ${mutation.error.status}` : mutation.error?.message}` : null;
  return <ProbeForm mode="create" draft={draft} patch={patch} payload={payload} endpoint="POST /api/v1/probes"
    canSubmit={canRegister} permissionNote={permissionNote} busy={mutation.isPending} serverError={serverError}
    submitLabel="Enregistrer la sonde" title="Enregistrer une sonde" dialogLabel="Enregistrer une sonde"
    subtitle={`Registre OIRAN persistant · réservé operator ou administrator · API ${backendVersion ?? '—'}`}
    onClose={onClose} onSubmit={submit}
    footerNote="Aucun processus de capture n'est démarré par l'enregistrement."/>;
}
