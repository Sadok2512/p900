import React, { useMemo, useState } from 'react';
import { useCreateProbe } from '@/lib/polaris-api';
import ProbeForm from './ProbeForm';
import { emptyProbeDraft, probePayload } from './probeRegistration';

export default function ProbeRegistration({ backendVersion, onClose }) {
  const [draft, setDraft] = useState(emptyProbeDraft);
  const mutation = useCreateProbe();
  const payload = useMemo(() => probePayload(draft), [draft]);
  const patch = values => setDraft(current => ({ ...current, ...values }));
  const submit = event => {
    event.preventDefault();
    mutation.mutate(payload, { onSuccess: onClose });
  };
  const serverError = mutation.isError ? `POST /api/v1/probes → ${mutation.error?.status ? `HTTP ${mutation.error.status}` : mutation.error?.message}` : null;
  return <ProbeForm mode="create" draft={draft} patch={patch} payload={payload} endpoint="POST /api/v1/probes"
    canSubmit permissionNote={null} busy={mutation.isPending} serverError={serverError}
    submitLabel="Enregistrer la sonde" title="Enregistrer une sonde" dialogLabel="Enregistrer une sonde"
    subtitle={`Registre OIRAN persistant · API ${backendVersion ?? '—'}`}
    onClose={onClose} onSubmit={submit}
    footerNote="Aucun processus de capture n'est démarré par l'enregistrement."/>;
}
