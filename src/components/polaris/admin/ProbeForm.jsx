import React, { useMemo, useState } from 'react';
import { available } from '@/lib/polaris-api';
import { PROBE_ROLES, isProbeRole, probeDraftErrors, probeFieldErrors, probeInterfaceErrors } from './probeRegistration';

/*
 * Shared shell for the two POLARIS probe forms (create + edit) and for the
 * management actions (software update, deletion). One dialog geometry, one
 * typography scale, one payload preview, one validation presentation: only the
 * data, the labels and the enabled actions differ per mode.
 */

const base = 'w-full rounded-md border bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-[var(--app-accent)]';
const cls = (error, extra = '') => `${base} ${error ? 'border-danger' : 'border-border'} ${extra}`;

export function Field({ label, required, error, help, className = '', children }) {
  return <label className={`block min-w-0 ${className}`}>
    <span className="mb-1.5 block text-[12.5px] text-ink-2">{label}{required && <span className="ml-0.5 text-danger">*</span>}</span>
    {children}
    {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : help ? <span className="mt-1 block text-[12px] text-subtle">{help}</span> : null}
  </label>;
}

export function Section({ title, help, action, children, className = '' }) {
  return <section className={`rounded-lg border border-border ${className}`}>
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {help && <p className="mt-0.5 text-[12px] text-muted-foreground">{help}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </header>
    <div className="p-4">{children}</div>
  </section>;
}

export function TypeChoice({ value, onChange, labels = [['virtual', 'vProbe'], ['physical', 'Sonde physique']] }) {
  return <div role="group" aria-label="Type de sonde" className="grid grid-cols-2 gap-3">
    {labels.map(([key, label]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
      className={`h-11 rounded-md border text-[13px] transition ${value === key ? 'border-[var(--app-accent)] bg-brand-soft font-semibold text-foreground' : 'border-border text-ink-2 hover:border-border-strong hover:bg-surface-2'}`}>
      {label}
    </button>)}
  </div>;
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

// VS Code-style colouring without an external dependency: strings are tokenised,
// never evaluated, so nothing from the payload can reach the DOM as markup.
function highlightJson(text) {
  const out = [];
  let last = 0, key = 0, match;
  JSON_TOKEN.lastIndex = 0;
  while ((match = JSON_TOKEN.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [full, str, colon, literal, number] = match;
    if (str && colon) { out.push(<span key={key++} className="text-code-key">{str}</span>); out.push(colon); }
    else if (str) out.push(<span key={key++} className="text-code-string">{full}</span>);
    else if (literal) out.push(<span key={key++} className="text-code-literal">{full}</span>);
    else out.push(<span key={key++} className="text-code-number">{full}</span>);
    last = match.index + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function PayloadPreview({ payload, endpoint }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const copy = () => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <section aria-label="Payload Preview" className="overflow-hidden rounded-lg border border-code-border bg-code-bg">
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-code-border px-4 py-2.5">
      <h3 className="text-[12.5px] font-semibold text-code-fg">Payload Preview <span className="font-normal opacity-70">— JSON</span></h3>
      <span className="ml-auto font-mono text-[11.5px] text-code-fg opacity-70">{endpoint}</span>
      <button type="button" onClick={copy} className="h-7 rounded-md border border-code-border px-2.5 text-[12px] text-code-fg hover:bg-white/10">{copied ? 'Copié' : 'Copier JSON'}</button>
    </header>
    <pre className="min-h-[220px] max-h-[350px] overflow-auto scroll-thin px-4 py-3 font-mono text-[12.5px] leading-[1.55] text-code-fg">{highlightJson(text)}</pre>
  </section>;
}

// `show(key, message)` reveals a message only once the control was left or the
// operator tried to submit: a form that opens must not open covered in errors.
export function InterfaceTable({ interfaces, onPatch, onRemove, protocols = {}, errors = [], show = (key, message) => message }) {
  const th = 'h-8 px-3 text-left text-[12px] font-medium text-muted-foreground bg-surface-2 border-b border-border-subtle';
  const td = 'px-3 py-2 border-b border-border-subtle align-top';
  return <table className="w-full text-[13px]">
    <thead><tr>{['Interface', 'Rôle de capture', 'Protocole', 'Filtre BPF', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
    <tbody>{interfaces.map((item, index) => {
      const error = errors[index] ?? {};
      return <tr key={index}>
        <td className={td}>
          <input aria-label={`Interface ${index + 1}`} value={item.interface} onChange={event => onPatch(index, { interface: event.target.value })} onBlur={() => show(`i${index}-interface`, true)} placeholder="ens3" className={cls(show(`i${index}-interface`, error.interface), 'h-9 font-mono')}/>
          {show(`i${index}-interface`, error.interface) && <span className="mt-1 block text-[12px] text-danger">{error.interface}</span>}
        </td>
        <td className={td}>
          <select aria-label={`Rôle ${index + 1}`} value={item.role} onChange={event => onPatch(index, { role: event.target.value })} onBlur={() => show(`i${index}-role`, true)} className={cls(show(`i${index}-role`, error.role), 'h-9')}>
            {!isProbeRole(item.role) && <option value={item.role}>{item.role || '— choisir —'}</option>}
            {PROBE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          {show(`i${index}-role`, error.role) && <span className="mt-1 block text-[12px] text-danger">{error.role}</span>}
          {item.role && !isProbeRole(item.role) && <span className="mt-1 block text-[11.5px] text-subtle">Valeur renvoyée par le serveur · conservée telle quelle</span>}
        </td>
        <td className={`${td} font-mono text-[12px] text-muted-foreground`}>{available(item.protocol ?? protocols[item.interface])}</td>
        <td className={td}>
          <input aria-label={`Filtre BPF ${index + 1}`} value={item.bpf_filter} onChange={event => onPatch(index, { bpf_filter: event.target.value })} onBlur={() => show(`i${index}-bpf`, true)} placeholder="sctp port 38412" className={cls(show(`i${index}-bpf`, error.bpf_filter), 'h-9 font-mono')}/>
          {show(`i${index}-bpf`, error.bpf_filter) && <span className="mt-1 block text-[12px] text-danger">{error.bpf_filter}</span>}
        </td>
        <td className={`${td} text-right`}>
          <button type="button" aria-label={`Retirer l'interface ${index + 1}`} disabled={interfaces.length === 1} onClick={() => onRemove(index)}
            className="h-9 rounded-md border border-border px-2.5 text-[12.5px] text-danger hover:bg-danger-soft disabled:opacity-40 disabled:hover:bg-white">Retirer</button>
        </td>
      </tr>;
    })}</tbody>
  </table>;
}

export function ProbeDialog({ label, title, subtitle, identifier, onClose, onSubmit, footer, children }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/20 p-4" role="dialog" aria-modal="true" aria-label={label}>
    <form onSubmit={onSubmit} className="flex max-h-[90vh] w-[min(1040px,95vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
      <header className="flex shrink-0 items-start gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>
          {identifier && <p className="mt-1 truncate font-mono text-[12px] text-subtle">{identifier}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto h-8 w-8 shrink-0 rounded-md border border-border text-[16px] leading-none text-muted-foreground hover:bg-surface-2">×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scroll-thin px-6 py-5">{children}</div>
      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-6 py-4">{footer}</footer>
    </form>
  </div>;
}

const FooterButton = ({ primary, danger, ...p }) => <button type="button" {...p}
  className={`h-9 rounded-md px-4 text-[13px] font-medium disabled:opacity-40 ${danger ? 'bg-danger text-white' : primary ? 'bg-[var(--app-accent)] text-white' : 'border border-border text-ink-2 hover:bg-surface-2'}`}/>;

export default function ProbeForm({
  mode, draft, patch, payload, endpoint, probeId, protocols = {},
  canSubmit, permissionNote, busy, serverError, submitLabel,
  title, subtitle, dialogLabel, onClose, onSubmit, footerNote,
}) {
  const fieldErrors = useMemo(() => probeFieldErrors(draft), [draft]);
  const ifaceErrors = useMemo(() => probeInterfaceErrors(draft), [draft]);
  const errors = useMemo(() => probeDraftErrors(draft), [draft]);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const show = (key, message) => {
    if (message === true) { setTouched(current => current[key] ? current : { ...current, [key]: true }); return undefined; }
    return (submitted || touched[key]) ? message : undefined;
  };
  const submit = event => { setSubmitted(true); onSubmit(event); };
  const patchInterface = (index, values) => patch({ interfaces: draft.interfaces.map((item, i) => i === index ? { ...item, ...values } : item) });
  const addInterface = () => patch({ interfaces: [...draft.interfaces, { interface: '', role: '', bpf_filter: '' }] });
  const removeInterface = index => patch({ interfaces: draft.interfaces.filter((_, i) => i !== index) });
  const blocking = errors.length > 0 ? `${errors.length} champ${errors.length > 1 ? 's' : ''} à corriger` : null;
  const engaged = submitted || Object.keys(touched).length > 0;

  return <ProbeDialog label={dialogLabel} title={title} subtitle={subtitle} identifier={probeId} onClose={onClose} onSubmit={submit}
    footer={<>
      <span className="text-[12px] text-subtle">{footerNote}</span>
      {blocking && <span className="text-[12px] text-warning">{blocking}</span>}
      <span className="ml-auto flex items-center gap-2">
        <FooterButton onClick={onClose}>Annuler</FooterButton>
        <FooterButton type="submit" primary danger={mode === 'delete'} disabled={!canSubmit || busy}>{busy ? 'En cours…' : submitLabel}</FooterButton>
      </span>
    </>}>
    <section aria-label="Type de sonde">
      <h3 className="text-[14px] font-semibold text-foreground">Type de sonde</h3>
      <p className="mt-0.5 mb-3 text-[12px] text-muted-foreground">Détermine le préfixe de l'identifiant et la façon dont OIRAN déclare la sonde.</p>
      <TypeChoice value={draft.probe_type} onChange={probe_type => patch({ probe_type })}/>
    </section>

    <Section title="Informations générales" help="Les champs marqués * sont exigés par le registre OIRAN.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom de la sonde" required error={show('name', fieldErrors.name)}>
          <input autoFocus aria-label="Nom de la sonde" value={draft.name} onChange={event => patch({ name: event.target.value })} onBlur={() => show('name', true)} placeholder="Lab vProbe · site-A" className={cls(show('name', fieldErrors.name))}/>
        </Field>
        <Field label="Identifiant (probe_id)" help={mode === 'create' ? 'Généré depuis le nom et le type.' : 'Fixe : il identifie la sonde côté serveur.'}>
          <input aria-label="Identifiant de la sonde" readOnly value={mode === 'create' ? payload.probe_id : probeId} className={cls(undefined, 'bg-surface-2 font-mono text-muted-foreground')}/>
        </Field>
        <Field label="Serveur / namespace" required error={show('host', fieldErrors.host)}>
          <input aria-label="Serveur ou namespace" value={draft.host} onChange={event => patch({ host: event.target.value })} onBlur={() => show('host', true)} placeholder="namespace.container.local" className={cls(show('host', fieldErrors.host))}/>
        </Field>
        <Field label="Adresse de gestion" required error={show('mgmt_ip', fieldErrors.mgmt_ip)}>
          <input aria-label="Adresse de gestion" value={draft.mgmt_ip} onChange={event => patch({ mgmt_ip: event.target.value })} onBlur={() => show('mgmt_ip', true)} placeholder="10.77.0.1" className={cls(show('mgmt_ip', fieldErrors.mgmt_ip))}/>
        </Field>
        <Field label="Site" required error={show('site', fieldErrors.site)} className="md:col-span-2">
          <input aria-label="Site de la sonde" value={draft.site} onChange={event => patch({ site: event.target.value })} onBlur={() => show('site', true)} placeholder="Lab A · rack 03" className={cls(show('site', fieldErrors.site))}/>
        </Field>
      </div>
    </Section>

    <Section title="Interfaces de capture" help="Le rôle et le filtre sont envoyés tels quels ; rien n'est remplacé."
      action={<button type="button" onClick={addInterface} className="h-8 rounded-md border border-border px-3 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2">+ Ajouter une interface</button>}>
      <InterfaceTable interfaces={draft.interfaces} onPatch={patchInterface} onRemove={removeInterface} protocols={protocols} errors={ifaceErrors} show={show}/>
      {engaged && fieldErrors.interfaces && <p className="mt-3 text-[12px] text-danger">{fieldErrors.interfaces}</p>}
      <p className="mt-3 text-[11.5px] text-subtle">Le protocole reste affiché à titre indicatif : il provient de /interfaces et ne fait pas partie de la charge utile envoyée au registre.</p>
    </Section>

    <PayloadPreview payload={payload} endpoint={endpoint}/>

    {(engaged || serverError || permissionNote) && <div className="space-y-1.5" aria-live="polite">
      {engaged && errors.length > 1 && <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-[12px] text-warning">
        <span className="font-semibold">{errors.length} champs à corriger</span>
        <ul className="mt-1 list-disc pl-4">{errors.map(error => <li key={error}>{error}</li>)}</ul>
      </div>}
      {engaged && errors.length === 1 && <p className="text-[12px] text-danger">{errors[0]}</p>}
      {permissionNote && <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-[12px] text-warning">{permissionNote}</div>}
      {serverError && <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[12px] text-danger">{serverError}</div>}
    </div>}
  </ProbeDialog>;
}

export { FooterButton };
