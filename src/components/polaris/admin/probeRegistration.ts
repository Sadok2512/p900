export type ProbeKind = 'virtual' | 'physical';

// The registry only ever writes back the role it was given. POLARIS_ROLES is the
// enumeration the UI offers when the server is silent; a server value outside it
// (S6a, S1-MME, S11, S5-C …) is kept verbatim instead of being rewritten to N2.
export const PROBE_ROLES = ['N2', 'N3', 'N4', 'S1', 'N6'] as const;
export const isProbeRole = (role: string): boolean => (PROBE_ROLES as readonly string[]).includes(role);

export type ProbeInterfaceInput = {
  interface: string;
  role: string;
  bpf_filter: string;
  protocol?: string;
};

export type ProbeRegistrationDraft = {
  probe_type: ProbeKind;
  name: string;
  host: string;
  mgmt_ip: string;
  site: string;
  interfaces: ProbeInterfaceInput[];
};

export const emptyProbeDraft = (): ProbeRegistrationDraft => ({
  probe_type: 'virtual',
  name: '',
  host: '',
  mgmt_ip: '',
  site: '',
  interfaces: [{ interface: 'ens3', role: 'N2', bpf_filter: 'sctp port 38412' }],
});

export function probeDraftFromRecord(record: Record<string, unknown> = {}, interfaces: Array<Record<string, unknown>> = []): ProbeRegistrationDraft {
  const sourceInterfaces = interfaces.length ? interfaces : Array.isArray(record['interfaces']) ? record['interfaces'] as Array<Record<string, unknown>> : [];
  const type = String(record['probe_type'] ?? '').toLowerCase();
  return {
    probe_type: type === 'physical' ? 'physical' : 'virtual',
    name: String(record['name'] ?? ''),
    host: String(record['host'] ?? ''),
    mgmt_ip: String(record['mgmt_ip'] ?? ''),
    site: String(record['site'] ?? ''),
    interfaces: sourceInterfaces.map(item => ({
      interface: String(item['interface'] ?? item['name'] ?? item['device'] ?? ''),
      role: String(item['role'] ?? ''),
      bpf_filter: String(item['bpf_filter'] ?? item['filter'] ?? ''),
      protocol: item['protocol'] == null ? undefined : String(item['protocol']),
    })),
  };
}

export function probeIdFor(draft: Pick<ProbeRegistrationDraft, 'probe_type' | 'name'>): string {
  const stem = draft.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const prefix = draft.probe_type === 'virtual' ? 'vprobe' : 'probe';
  return stem ? `${prefix}-${stem}`.slice(0, 48).replace(/-+$/g, '') : prefix;
}

export function probePayload(draft: ProbeRegistrationDraft) {
  return {
    probe_id: probeIdFor(draft),
    probe_type: draft.probe_type,
    name: draft.name.trim(),
    host: draft.host.trim(),
    mgmt_ip: draft.mgmt_ip.trim(),
    site: draft.site.trim(),
    interfaces: draft.interfaces.map(item => ({
      interface: item.interface.trim(),
      role: item.role,
      bpf_filter: item.bpf_filter.trim(),
    })),
  };
}

export function probeUpdatePayload(probeId: string, draft: ProbeRegistrationDraft) {
  return { ...probePayload(draft), probe_id: probeId };
}

const IP = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

// Per-field messages so the dialog can mark the affected control instead of
// pushing every problem to the bottom of the form.
export function probeFieldErrors(draft: ProbeRegistrationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Le nom de la sonde est obligatoire.';
  if (!draft.host.trim()) errors.host = 'Le serveur / namespace est obligatoire.';
  if (!draft.site.trim()) errors.site = 'Le site est exigé par OIRAN.';
  if (!draft.mgmt_ip.trim()) errors.mgmt_ip = "L'adresse de gestion est exigée par OIRAN.";
  else if (!IP.test(draft.mgmt_ip.trim())) errors.mgmt_ip = "L'adresse de gestion doit être une adresse IP.";
  if (!draft.interfaces.length) errors.interfaces = 'Au moins une interface est requise.';
  return errors;
}

export function probeInterfaceErrors(draft: ProbeRegistrationDraft): Array<Record<string, string>> {
  return draft.interfaces.map(item => {
    const errors: Record<string, string> = {};
    if (!item.interface.trim()) errors.interface = 'Nom de l’interface requis.';
    if (!item.role.trim()) errors.role = 'Rôle de capture requis.';
    if (!item.bpf_filter.trim()) errors.bpf_filter = 'Filtre BPF requis.';
    return errors;
  });
}

export function probeDraftErrors(draft: ProbeRegistrationDraft): string[] {
  const fields = probeFieldErrors(draft);
  const errors = Object.values(fields);
  const incomplete = draft.interfaces.some(item => !item.interface.trim() || !item.role.trim() || !item.bpf_filter.trim());
  if (incomplete) errors.push('Chaque interface doit avoir un nom, un rôle de capture et un filtre BPF.');
  return [...new Set(errors)];
}
