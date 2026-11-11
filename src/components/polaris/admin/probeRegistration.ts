export type ProbeKind = 'virtual' | 'physical';

export type ProbeInterfaceInput = {
  interface: string;
  role: 'N2' | 'N3' | 'N4' | 'S1' | 'N6';
  bpf_filter: string;
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
  const sourceInterfaces = interfaces.length ? interfaces : Array.isArray(record.interfaces) ? record.interfaces as Array<Record<string, unknown>> : [];
  const type = String(record.probe_type ?? '').toLowerCase();
  return {
    probe_type: type === 'physical' ? 'physical' : 'virtual',
    name: String(record.name ?? ''),
    host: String(record.host ?? ''),
    mgmt_ip: String(record.mgmt_ip ?? ''),
    site: String(record.site ?? ''),
    interfaces: sourceInterfaces.map(item => ({
      interface: String(item.interface ?? item.name ?? item.device ?? ''),
      role: (['N2','N3','N4','S1','N6'].includes(String(item.role)) ? String(item.role) : 'N2') as ProbeInterfaceInput['role'],
      bpf_filter: String(item.bpf_filter ?? item.filter ?? ''),
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

export function probeDraftErrors(draft: ProbeRegistrationDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('Name is required');
  if (!draft.host.trim()) errors.push('Host / namespace is required');
  if (!draft.site.trim()) errors.push('Site is required by OIRAN');
  if (!draft.mgmt_ip.trim()) errors.push('Management address is required by OIRAN');
  else if (!/^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(draft.mgmt_ip.trim())) errors.push('Management address must be an IP address');
  if (!draft.interfaces.length) errors.push('At least one interface is required');
  for (const item of draft.interfaces) {
    if (!item.interface.trim() || !item.bpf_filter.trim()) errors.push('Every interface needs a name and BPF filter');
  }
  return [...new Set(errors)];
}
