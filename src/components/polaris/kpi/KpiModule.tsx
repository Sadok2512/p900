// @ts-nocheck
import { usePolarisMode, useMetrics, useStorageSafety, healthKpi, useKpiCatalogue, useKpiDemo } from '@/lib/polaris-api';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ===== Persistence ===== */
const useStore = (key, init) => {
  const [v, setV] = useState(init);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch {} }, [key]);
  const set = (x) => setV(prev => { const n = typeof x === 'function' ? x(prev) : x; try { localStorage.setItem(key, JSON.stringify(n)); } catch {} return n; });
  return [v, set];
};

/* ===== SYSTEM tree (maps existing catalogue ids) ===== */
const SYS_TREE = [
  ['5G SA', [['Accessibility', ['kpi.5g.registration','kpi.5g.pdu','kpi.5g.servicereq']], ['Session Management', ['kpi.lat.proc']], ['SBI', ['kpi.err.sbi']], ['N4 / PFCP', ['kpi.n4.session']]]],
  ['LTE', [['Attach', ['kpi.4g.attach']], ['E-RAB', ['kpi.4g.erab']], ['Diameter', ['kpi.err.s6a']]]],
  ['User Plane', [['TCP', ['kpi.tcp.setup','kpi.tcp.rtt','kpi.tcp.retrans','kpi.tcp.congested']]]],
  ['Probe Health', [['Sonde', ['kpi.probe.dumpcap','kpi.probe.lag','kpi.probe.segments','kpi.probe.disk','kpi.corr.exact']]]],
];
const TECH = (id) => id.includes('.5g.') || id.includes('.n4.') || id.includes('sbi') ? '5G' : id.includes('.4g.') || id.includes('s6a') ? '4G' : 'Both';
const DIMS = ['RAT','Site','gNB / eNB','Cellule','TAC','AMF / MME','SMF / UPF','DNN / APN','S-NSSAI','Scénario','Run','Interface'];
const AGGS = ['COUNT','SUM','AVG','MIN','MAX','p50','p95','p99'];
const PROTOS = { 'NAS 5GMM':['Registration Request','Registration Accept','Registration Reject','Service Request','Service Accept'], 'NAS 5GSM':['PDU Session Establishment Request','PDU Session Establishment Accept','PDU Session Establishment Reject'], 'NGAP':['Initial UE Message','PDU Session Resource Setup Request','PDU Session Resource Setup Response'], 'PFCP':['Session Establishment Request','Session Establishment Response'], 'NAS EMM':['Attach Request','Attach Accept','Attach Reject'], 'Diameter S6a':['ULR','ULA','AIR','AIA'], 'HTTP/2 SBI':['request','response'], 'GTPv2-C':['Create Session Request','Create Session Response'] };
const UNITS = ['%','ms','s','Mbps','count','bytes'];
const WTYPES = [['card','KPI Card'],['series','Time Series'],['line','Line Chart'],['bar','Bar Chart'],['stack','Stacked Bar'],['hist','Histogram'],['cdf','CDF'],['pct','Percentile Curve'],['heat','Heatmap'],['top','Top-N'],['donut','Pie / Donut'],['table','Table'],['sankey','Sankey']];
const wCompat = (type, unit) => {
  if (['hist','cdf','pct'].includes(type) && unit === '%') return 'Nécessite une mesure continue (ms, Mbps…), pas un ratio.';
  if (type === 'sankey') return 'Nécessite un flux entre dimensions (lot non disponible).';
  if (type === 'donut' && unit !== 'count' && unit !== 'err/min') return 'Réservé aux répartitions de comptage.';
  return null;
};
/* ===== UI atoms ===== */
const card = 'bg-white rounded-xl border border-border';
const Btn = ({ primary, children, className = '', ...p }) => <button {...p} className={`h-8 px-3 rounded-md text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${primary ? 'bg-[var(--app-accent)] text-white hover:opacity-90' : 'border border-border bg-white text-foreground hover:bg-surface-2'} ${className}`}>{children}</button>;
const Field = ({ label, children }) => <label className="block"><span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-1.5">{label}</span>{children}</label>;
const inp = 'w-full h-9 px-3 rounded-md border border-border bg-white text-[13px] outline-none focus:border-[var(--app-accent)]';
const Tag = ({ c = '#666666', children }) => <span className="text-[11px] font-medium rounded px-1.5 py-[1px] border" style={{ color: c, borderColor: c + '33', background: c + '0D' }}>{children}</span>;
const LIBC = { SYSTEM: '#171717', PUBLIC: '#0062A1', PRIVATE: '#A15C07' };
const Empty = ({ title, sub }) => <div className="h-full min-h-[220px] grid place-items-center text-center px-6"><div><div className="mx-auto w-9 h-9 rounded-full bg-muted grid place-items-center text-subtle">∅</div><div className="mt-3 text-[13px] font-medium text-foreground">{title}</div><div className="mt-1 text-[12.5px] text-muted-foreground max-w-[360px]">{sub}</div></div></div>;

/* ===== Main ===== */
export default function KpiModule({ t, role, setPage, KPIS, mockSeries, MockChart, fmtV }) {
  const [tab, setTab] = useStore('polaris-kpi-tab', 'catalog');
  const { demo, setDemo } = usePolarisMode();
  const metrics = useMetrics(); const safety = useStorageSafety();
  const measurement = id => healthKpi(id, metrics.data?.data, safety.data?.data);
  const [custom, setCustom] = useStore('polaris-kpi-custom', []);
  const [favs, setFavs] = useStore('polaris-kpi-favs', []);
  const [dashes, setDashes] = useStore('polaris-dashboards', []);
  const [audit, setAudit] = useStore('polaris-kpi-audit', []);
  const [editKpi, setEditKpi] = useState(null);
  const [openDash, setOpenDash] = useState(null);
  const [bk, setBk] = useState(0);
  const canWrite = true;
  const log = (a) => setAudit(x => [{ ts: new Date().toLocaleString('fr-FR'), who: 'SD', role, a }, ...x].slice(0, 100));
  const all = useMemo(() => [...KPIS.filter(k => demo || k.id.startsWith('kpi.probe.')).map(k => ({ ...k, lib: 'SYSTEM', owner: 'system', tech: TECH(k.id) })), ...(demo ? custom : [])], [KPIS, custom, demo]);
  const byId = (id) => all.find(k => k.id === id);
  const metricEvidence = metrics.data?.data; const storageEvidence = safety.data?.data;
  const ctx = { metricEvidence, storageEvidence, measurement, t, role, canWrite, demo, all, byId, custom, setCustom, favs, setFavs, dashes, setDashes, log, audit, mockSeries, MockChart, fmtV, setPage, setTab, setEditKpi, setOpenDash };
  const TABS = demo ? [['catalog', 'Catalogue KPI'], ['builder', 'KPI Builder'], ['dash', 'Dashboards'], ['anom', 'Anomalies']] : [['catalog', 'Catalogue KPI']];
  useEffect(() => { if (!demo && tab !== 'catalog') setTab('catalog'); }, [demo, tab, setTab]);
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-surface-2">
      <div className="bg-white border-b border-border">
        <div className="w-full px-6 pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div><div className="text-[12px] text-muted-foreground">POLARIS KPI</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-1">{t('KPI & Anomalies')}</h1></div>
            <div className="ml-auto flex items-center gap-3 pb-1">
              <button onClick={() => setDemo(!demo)} className={`h-7 px-2.5 rounded-full text-[11.5px] font-medium border flex items-center gap-1.5 ${demo ? 'bg-warning-soft border-warning-line text-warning' : 'border-border text-muted-foreground'}`}><span className={`w-6 h-3.5 rounded-full relative ${demo ? 'bg-warning' : 'bg-track'}`}><span className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white transition-all ${demo ? 'left-[12px]' : 'left-[2px]'}`} /></span>{t('Démo')}</button>
            </div>
          </div>
          <div className="flex gap-6 mt-3">{TABS.map(([k, n]) => <button key={k} onClick={() => { setTab(k); setOpenDash(null); }} className={`h-9 text-[13px] border-b-2 ${tab === k ? 'border-[var(--app-accent)] font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t(n)}</button>)}</div>
        </div>
      </div>
      {!demo && (metrics.isError || safety.isError) && <div className="w-full px-6 pt-3"><div className="text-[12px] text-subtle flex items-center gap-2"><span className="w-[7px] h-[7px] rounded-full bg-track" />{t('POLARIS non connecté : aucune donnée en direct.')} {t('Activez « Démo » pour un aperçu.')}</div></div>}
      <div className="w-full px-6 py-4">
        {tab === 'catalog' && <Catalog {...ctx} />}
        {!demo && tab!=='catalog' && <Empty title={t('Non disponible : backend à venir')} sub={t('Source POLARIS indisponible pour cette fonction.')} />}
        {demo && tab === 'builder' && <Builder key={(editKpi?.id || 'new') + bk} {...ctx} initial={editKpi} onNew={() => { setEditKpi(null); setBk(b => b + 1); }} />}
        {demo && tab === 'dash' && (openDash ? <DashEditor {...ctx} dash={openDash} /> : <DashLib {...ctx} />)}
        {demo && tab === 'anom' && <Anomalies {...ctx} />}
      </div>
    </div>
  );
}

/* ===== Catalogue ===== */
function Tree({ t, all, favs, sel, setSel, q, tech, owner }) {
  const [open, setOpen] = useState({ SYSTEM: true, '5G SA': true, Accessibility: true, PUBLIC: true, PRIVATE: true });
  const ok = (k) => k && (!q || (k.name + ' ' + k.id).toLowerCase().includes(q.toLowerCase())) && (tech === 'all' || k.tech === tech || k.tech === 'Both') && (owner === 'all' || (owner === 'me' ? k.owner === 'SD' : k.owner === 'system'));
  const pub = all.filter(k => k.lib === 'PUBLIC'), priv = all.filter(k => k.lib === 'PRIVATE');
  const lib = [
    ['SYSTEM', SYS_TREE.map(([f, subs]) => [f, subs.map(([s, ids]) => [s, ids.map(id => all.find(k => k.id === id)).filter(ok)])])],
    ['PUBLIC', [['Shared KPI', [['Shared', pub.filter(k => k.folder !== 'Team KPI').filter(ok)]]], ['Team KPI', [['Team', pub.filter(k => k.folder === 'Team KPI').filter(ok)]]]]],
    ['PRIVATE', [['My KPI', [['Publiés', priv.filter(k => k.status !== 'draft').filter(ok)]]], ['Drafts', [['Brouillons', all.filter(k => k.status === 'draft').filter(ok)]]], ['Favorites', [['★', all.filter(k => favs.includes(k.id)).filter(ok)]]]]],
  ];
  const cnt = (subs) => subs.reduce((a, [, ks]) => a + ks.length, 0);
  const Row = ({ k, depth }) => <button onClick={() => setSel(k.id)} style={{ paddingLeft: 12 + depth * 14 }} className={`w-full text-left pr-3 py-1.5 flex items-center gap-2 text-[12.5px] ${sel === k.id ? 'bg-muted font-semibold text-foreground shadow-[inset_2px_0_0_var(--app-accent)]' : 'text-ink-2 hover:bg-surface-2'}`}><span className="truncate">{t(k.name)}</span>{favs.includes(k.id) && <span className="text-warning">★</span>}<span className="ml-auto font-mono text-[11px] text-subtle">v{k.ver}</span></button>;
  const Fold = ({ id, label, n, depth, children, c }) => <div><button onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))} style={{ paddingLeft: 8 + depth * 14 }} className="w-full text-left pr-3 py-1.5 flex items-center gap-1.5 text-[12.5px] hover:bg-surface-2"><span className={`text-[11px] text-subtle transition ${open[id] ? 'rotate-90' : ''}`}>▶</span><span className={depth === 0 ? 'text-[11px] font-bold tracking-[0.06em]' : 'font-medium text-foreground'} style={c ? { color: c } : {}}>{label}</span><span className="ml-auto text-[11px] tabular-nums text-subtle">{n}</span></button>{open[id] && children}</div>;
  return <div className="py-1">{lib.map(([L, folders]) => <Fold key={L} id={L} label={L} c={LIBC[L]} depth={0} n={folders.reduce((a, [, s]) => a + cnt(s), 0)}>
    {folders.map(([f, subs]) => <Fold key={f} id={L + f} label={f} depth={1} n={cnt(subs)}>
      {subs.length === 1 ? subs[0][1].map(k => <Row key={k.id + f} k={k} depth={2} />) : subs.map(([s, ks]) => <Fold key={s} id={L + f + s} label={s} depth={2} n={ks.length}>{ks.map(k => <Row key={k.id} k={k} depth={3} />)}</Fold>)}
      {cnt(subs) === 0 && <div className="pl-12 py-1.5 text-[11.5px] text-subtle">{t('Vide')}</div>}
    </Fold>)}
  </Fold>)}</div>;
}

function Catalog(p) {
  const { t, all, byId, favs, setFavs, demo, mockSeries, MockChart, fmtV, canWrite, setCustom, log, setTab, setEditKpi, dashes, setDashes, setPage } = p;
  const [sel, setSel] = useStore('polaris-kpi-sel', 'kpi.probe.dumpcap');
  const [q, setQ] = useState(''); const [tech, setTech] = useState('all'); const [owner, setOwner] = useState('all');
  const [treeW, setTreeW] = useStore('polaris-kpi-treew', 300); const [sheet, setSheet] = useStore('polaris-kpi-sheet', true);
  const [treeOpen, setTreeOpen] = useStore('polaris-kpi-treeopen', true); const [sheetW, setSheetW] = useStore('polaris-kpi-sheetw', 320);
  const [gran, setGran] = useState('15 min'); const [drill, setDrill] = useState(0); const [addTo, setAddTo] = useState(false); const [qOpen, setQOpen] = useState(false);
  const k = byId(sel) || all[0];
  const series = demo && k ? mockSeries(k, gran) : null;
  const measured = !demo && k ? p.measurement(k.id) : null;
  const drag = (e) => { const x0 = e.clientX, w0 = treeW; const mv = (ev) => setTreeW(Math.max(220, Math.min(480, w0 + ev.clientX - x0))); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
  const dragR = (e) => { const x0 = e.clientX, w0 = sheetW; const mv = (ev) => setSheetW(Math.max(260, Math.min(560, w0 - (ev.clientX - x0)))); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
  const dup = () => { const id = 'kpi.my.' + k.id.split('.').pop() + '.' + Date.now().toString(36).slice(-4); setCustom(c => [...c, { ...k, id, name: k.name + ' (copie)', lib: 'PRIVATE', owner: 'SD', ver: '0.1.0', status: 'draft', folder: 'My KPI' }]); log('KPI dupliqué ' + k.id + ' → ' + id); setSel(id); };
  const DR = ['KPI', 'Sessions', 'Messages', 'Preuves', 'PCAP'];
  return (
    <div className="flex gap-0 items-start">
      {!treeOpen ? <button onClick={() => setTreeOpen(true)} title={t('Afficher le panneau')} className={card + ' w-8 shrink-0 self-stretch text-[11px] text-muted-foreground hover:text-foreground [writing-mode:vertical-rl] py-3'}>Catalogue</button> : <>
      <div className={card + ' overflow-hidden shrink-0 flex flex-col'} style={{ width: `min(${treeW}px, 26vw)`, minWidth: 200 }}>
        <div className="p-3 border-b border-border-subtle space-y-2">
          <div className="flex items-center gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher un KPI…')} className={inp + ' h-8 text-[12.5px]'} />
            <button onClick={() => setTreeOpen(false)} title={t('Masquer le panneau')} className="w-8 h-8 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-2 text-[13px]">⟨</button>
          </div>
          <div className="flex gap-1.5">
            <select value={tech} onChange={e => setTech(e.target.value)} className="flex-1 h-7 rounded-md border border-border text-[11.5px] px-1.5 bg-white"><option value="all">{t('Techno')}: {t('toutes')}</option><option>5G</option><option>4G</option></select>
            <select value={owner} onChange={e => setOwner(e.target.value)} className="flex-1 h-7 rounded-md border border-border text-[11.5px] px-1.5 bg-white"><option value="all">{t('Propriétaire')}: {t('tous')}</option><option value="system">system</option><option value="me">{t('moi')}</option></select>
          </div>
        </div>
        <div className="overflow-auto scroll-thin max-h-[calc(100vh-340px)]"><Tree t={t} all={all} favs={favs} sel={sel} setSel={setSel} q={q} tech={tech} owner={owner} /></div>
      </div>
      <div onPointerDown={drag} onDoubleClick={() => setTreeW(300)} className="w-3 self-stretch cursor-col-resize grid place-items-center group"><span className="w-1 h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)]" /></div>
      </>}
      <div className="flex-1 min-w-0 overflow-auto scroll-thin max-h-[calc(100vh-220px)]">
        {k && <div className={card}>
          <div className="px-5 pt-4 pb-3 border-b border-border-subtle flex flex-wrap items-center gap-3">
            <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold text-foreground truncate">{t(k.name)}</h2><Tag c={LIBC[k.lib]}>{k.lib}</Tag>{k.status === 'draft' && <Tag c="#A15C07">{t('Brouillon')}</Tag>}</div><div className="font-mono text-[11px] text-subtle mt-0.5">{k.id} · v{k.ver} · {k.tech} · {k.unit}</div></div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Btn onClick={() => setFavs(f => f.includes(k.id) ? f.filter(x => x !== k.id) : [...f, k.id])}>{favs.includes(k.id) ? '★' : '☆'} {t('Favori')}</Btn>
              <Btn disabled={!demo} onClick={dup}>{t('Dupliquer')}</Btn>
              {k.lib !== 'SYSTEM' && <Btn disabled={!canWrite || !demo} onClick={() => { setEditKpi(k); setTab('builder'); }}>{t('Modifier')}</Btn>}
              <div className="relative"><Btn disabled={!demo} title={!demo ? t('Non disponible : backend à venir') : ''} onClick={() => setAddTo(!addTo)}>+ Dashboard</Btn>{addTo && <div className="absolute right-0 top-9 z-20 w-56 bg-white rounded-lg border border-border shadow-lg py-1">{dashes.length === 0 && <div className="px-3 py-2 text-[12px] text-subtle">{t('Aucun dashboard personnel')}</div>}{dashes.map(d => <button key={d.id} onClick={() => { setDashes(ds => ds.map(x => x.id === d.id ? { ...x, widgets: [...x.widgets, { id: 'w' + Date.now(), kpi: k.id, type: 'series', title: '', x: 0, y: 99, w: 4, h: 3, inherit: true, color: '', thr: '' }] } : x)); log('KPI ' + k.id + ' ajouté à ' + d.name); setAddTo(false); }} className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-surface-2">{d.name}</button>)}</div>}</div>
              <Btn onClick={() => setSheet(!sheet)}>{sheet ? t('Masquer la fiche') : t('Fiche KPI')}</Btn>
            </div>
          </div>
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-border-subtle">
            <div className="flex rounded-md border border-border overflow-hidden">{['1 min', '15 min', '1 h', '1 j'].map(g => <button key={g} onClick={() => setGran(g)} className={`h-7 px-2.5 whitespace-nowrap text-[12px] ${gran === g ? 'bg-[var(--app-accent)] text-white' : 'text-ink-2 hover:bg-surface-2'}`}>{g}</button>)}</div>
            <span className="ml-auto whitespace-nowrap text-[11.5px] text-subtle">{t("Drill-down")}:</span>
            {DR.map((d, i) => <button key={d} onClick={() => { setDrill(i); if (i > 0 && demo) setPage('sessions'); }} disabled={!demo && i > 0} className={`text-[11.5px] px-2 h-6 whitespace-nowrap rounded ${drill === i ? 'bg-muted font-semibold' : 'text-muted-foreground'} disabled:opacity-40`}>{t(d)}{i < 4 ? ' →' : ''}</button>)}
          </div>
          <div className="h-[320px] p-5">{measured!=null ? <div><span title={`event_id=${(k.id==='kpi.probe.disk'?p.storageEvidence:p.metricEvidence)?.event_id ?? '—'} · seq=${(k.id==='kpi.probe.disk'?p.storageEvidence:p.metricEvidence)?.seq ?? '—'}`} className="text-[26px] font-semibold tabular-nums">{fmtV(measured,k.unit)}</span><div className="mt-2 text-[12px]">Santé sonde POLARIS</div></div> : series ? <div className="h-full flex flex-col"><div className="flex items-baseline gap-3"><span className="text-[26px] font-semibold tabular-nums text-foreground">{fmtV(series[series.length - 1], k.unit)}</span><span className="text-[12px] text-subtle">{t('moyenne')} {fmtV(series.reduce((a, b) => a + b, 0) / series.length, k.unit)}</span><Tag c="#A15C00">{t('Données de démo')}</Tag></div><div className="flex-1 min-h-0"><MockChart data={series} unit={k.unit} /></div></div> : <Empty title={t('Aucune donnée à afficher')} sub={t(k.id.startsWith('kpi.probe.') ? 'POLARIS non connecté.' : 'Non disponible : backend à venir')} />}</div>
          <div className="border-t border-border-subtle px-5 py-2.5"><button onClick={() => setQOpen(!qOpen)} className="w-full flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle hover:text-foreground"><span className={`text-[11px] transition ${qOpen ? 'rotate-90' : ''}`}>▶</span>{t('Requête générée')} · v{k.ver}</button>{qOpen && <pre className="mt-2 font-mono text-[11.5px] text-ink-2 bg-surface-2 border border-border-subtle rounded-md p-3 whitespace-pre-wrap">{k.q}</pre>}</div>
        </div>}
      </div>
      {sheet && k && <>
      <div onPointerDown={dragR} onDoubleClick={() => setSheetW(320)} className="w-3 self-stretch cursor-col-resize grid place-items-center group"><span className="w-1 h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)]" /></div>
      <div className={card + ' shrink-0 overflow-hidden flex flex-col'} style={{ width: `min(${sheetW}px, 28vw)`, minWidth: 220 }}>
        <div className="h-11 px-4 flex items-center border-b border-border-subtle"><h3 className="text-[13px] font-semibold">{t('Fiche KPI')}</h3><span className="ml-auto font-mono text-[11px] text-subtle">v{k.ver}</span><button onClick={() => setSheet(false)} title={t('Masquer la fiche')} className="ml-2 w-6 h-6 grid place-items-center rounded text-subtle hover:bg-surface-2 hover:text-foreground text-[12px]">✕</button></div>
        <div className="p-4 space-y-3.5 text-[12.5px] overflow-auto scroll-thin max-h-[calc(100vh-300px)]">{[['Formule', `${k.num} / ${k.den}`], ['Événements sources', k.src], ['Dimensions', k.dims], ['Unité', k.unit], ['Règle de dédup', k.dedup], ['Invariant', k.inv], ['Propriétaire', k.owner], ['Bibliothèque', k.lib]].map(([n, v]) => <div key={n}><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-0.5">{t(n)}</div><div className="text-ink-2 leading-snug">{v}</div></div>)}
          {k.changelog && <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-0.5">CHANGELOG</div>{k.changelog.map((c, i) => <div key={i} className="text-[11.5px] text-ink-2"><span className="font-mono">v{c.v}</span> · {c.by} · {c.date} — {c.msg}</div>)}</div>}
          {k.lib === 'SYSTEM' && <div className="text-[11.5px] text-subtle">{t('KPI SYSTEM non modifiable — dupliquez-le en PRIVATE.')}</div>}
        </div></div></>}
    </div>
  );
}

/* ===== Builder ===== */
const blankRule = () => ({ op: 'AND', proto: 'NAS 5GSM', msg: 'PDU Session Establishment Request', param: '', val: '', not: false });
function genQuery(f) {
  const cond = (rs) => rs.map((r, i) => `${i ? r.op + ' ' : ''}${r.not ? 'NOT ' : ''}(proto='${r.proto}' AND msg='${r.msg}'${r.param ? ` AND ${r.param}='${r.val}'` : ''})`).join(' ');
  const g = f.dims.length ? ', ' + f.dims.map(d => d.toLowerCase().replace(/[^a-z]/g, '_')).join(', ') : '';
  const agg = f.agg.startsWith('p') ? `percentile_cont(0.${f.agg.slice(1)}) WITHIN GROUP (ORDER BY value)` : f.agg + '(*)';
  return `SELECT minute${g},\n  ${agg} FILTER (WHERE ${cond(f.num)})\n  / NULLIF(${agg} FILTER (WHERE ${cond(f.den)}), 0)${f.unit === '%' ? ' * 100' : ''} AS value\nFROM msg\nWHERE run IN (:scope)\nGROUP BY 1${g ? ', ' + f.dims.map((_, i) => i + 2).join(', ') : ''}\n-- dedup: ${f.dedup}`;
}
function Builder(p) {
  const { t, canWrite, setCustom, log, initial, setEditKpi, setTab, demo, mockSeries, MockChart, fmtV } = p;
  const init = initial ? { ...initial, num: initial.rules?.num || [blankRule()], den: initial.rules?.den || [blankRule()], dims: initial.dimsArr || [], agg: initial.agg || 'COUNT' } : { name: '', id: 'kpi.my.', desc: '', tech: '5G', cat: 'Accessibility', folder: 'My KPI', lib: 'PRIVATE', unit: '%', ver: '0.1.0', num: [{ ...blankRule(), msg: 'PDU Session Establishment Accept' }], den: [blankRule()], agg: 'COUNT', dedup: '1ère tentative / UE / procédure', inv: 'succès + échec = total', dims: ['RAT', 'Cellule'], status: 'draft' };
  const [f, setF] = useState(init); const [step, setStep] = useState(0); const [tested, setTested] = useState(null); const [pub, setPub] = useState({ ver: init.ver, log: '' });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const q = genQuery(f);
  const errs = [!f.name && 'Nom requis', !/^kpi\.[a-z0-9._]+$/.test(f.id) && 'Identifiant invalide (kpi.xxx)', !f.num.length && 'Numérateur vide', !f.den.length && 'Dénominateur vide'].filter(Boolean);
  const STEPS = ['Informations', 'Formule', 'Dimensions', 'Prévisualisation', 'Publication'];
  const save = (status, extra = {}) => {
    const k = { ...f, ...extra, status, owner: 'SD', lib: f.lib, num: f.num.map(r => r.msg).join(' + '), den: f.den.map(r => r.msg).join(' + '), src: [...new Set([...f.num, ...f.den].map(r => r.proto))].join(', '), dims: f.dims.join(', '), dimsArr: f.dims, rules: { num: f.num, den: f.den }, q };
    setCustom(c => [...c.filter(x => x.id !== k.id), k]); log((status === 'draft' ? 'Brouillon enregistré ' : 'KPI publié ') + k.id + ' v' + k.ver); setEditKpi(k);
  };
  const Rules = ({ which }) => <div className="space-y-2">{f[which].map((r, i) => <div key={i} className="flex flex-wrap items-center gap-1.5 p-2 rounded-md border border-border-subtle bg-surface-2">
    {i > 0 ? <select value={r.op} onChange={e => set(which, f[which].map((x, j) => j === i ? { ...x, op: e.target.value } : x))} className="h-7 rounded border border-border text-[11.5px] px-1 bg-white font-semibold">{['AND', 'OR'].map(o => <option key={o}>{o === 'AND' ? 'ET' : 'OU'}</option>)}</select> : <span className="w-9 text-[11px] text-subtle">{t('SI')}</span>}
    <button onClick={() => set(which, f[which].map((x, j) => j === i ? { ...x, not: !x.not } : x))} className={`h-7 px-1.5 rounded text-[11px] font-semibold border ${r.not ? 'bg-danger text-white border-danger' : 'border-border text-subtle bg-white'}`}>NON</button>
    <select value={r.proto} onChange={e => set(which, f[which].map((x, j) => j === i ? { ...x, proto: e.target.value, msg: PROTOS[e.target.value][0] } : x))} className="h-7 rounded border border-border text-[11.5px] px-1 bg-white">{Object.keys(PROTOS).map(o => <option key={o}>{o}</option>)}</select>
    <select value={r.msg} onChange={e => set(which, f[which].map((x, j) => j === i ? { ...x, msg: e.target.value } : x))} className="h-7 rounded border border-border text-[11.5px] px-1 bg-white max-w-[260px]">{PROTOS[r.proto].map(o => <option key={o}>{o}</option>)}</select>
    <input value={r.param} placeholder={t('paramètre / cause / résultat')} onChange={e => set(which, f[which].map((x, j) => j === i ? { ...x, param: e.target.value } : x))} className="h-7 w-40 rounded border border-border text-[11.5px] px-2 bg-white" />
    <input value={r.val} placeholder={t('valeur')} onChange={e => set(which, f[which].map((x, j) => j === i ? { ...x, val: e.target.value } : x))} className="h-7 w-24 rounded border border-border text-[11.5px] px-2 bg-white" />
    <button onClick={() => set(which, f[which].filter((_, j) => j !== i))} className="ml-auto text-subtle hover:text-danger px-1">✕</button></div>)}
    <button onClick={() => set(which, [...f[which], blankRule()])} className="text-[12px] font-medium text-[var(--app-accent)]">+ {t('Condition')}</button></div>;
  const stage = f.status === 'published' ? 4 : f.status === 'validated' ? 3 : tested?.ok ? 2 : 1;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
      <div className={card + ' overflow-hidden'}>
        <div className="px-5 h-12 flex items-center gap-1 border-b border-border-subtle">{STEPS.map((s, i) => <button key={s} onClick={() => setStep(i)} className={`flex items-center gap-2 h-8 px-2.5 rounded-md text-[12.5px] ${step === i ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground'}`}><span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] ${step >= i ? 'bg-[var(--app-accent)] text-white' : 'bg-muted text-subtle'}`}>{i + 1}</span>{t(s)}</button>)}
          <button onClick={p.onNew} className="ml-auto text-[12px] text-muted-foreground hover:text-foreground">{t('Nouveau')}</button></div>
        {!canWrite && <div className="mx-5 mt-4 text-[12px] rounded-md bg-warning-soft text-warning px-3 py-2">{t('Rôle viewer : consultation uniquement. Passez en operator pour créer un KPI.')}</div>}
        <fieldset disabled={!canWrite || !demo} className="p-5 space-y-4 disabled:opacity-60">
          {step === 0 && <div className="grid grid-cols-2 gap-4">
            <Field label={t('Nom du KPI')}><input className={inp} value={f.name} onChange={e => set('name', e.target.value)} placeholder="PDU Session Establishment Success Rate" /></Field>
            <Field label={t('Identifiant unique')}><input className={inp + ' font-mono'} value={f.id} onChange={e => set('id', e.target.value)} /></Field>
            <div className="col-span-2"><Field label={t('Description')}><textarea className={inp + ' h-20 py-2'} value={f.desc} onChange={e => set('desc', e.target.value)} /></Field></div>
            <Field label={t('Technologie')}><div className="flex gap-1.5">{['4G', '5G', 'Both'].map(x => <button type="button" key={x} onClick={() => set('tech', x)} className={`flex-1 h-9 rounded-md border text-[12.5px] ${f.tech === x ? 'border-[var(--app-accent)] text-[var(--app-accent)] font-semibold' : 'border-border'}`}>{x}</button>)}</div></Field>
            <Field label={t('Catégorie')}><input className={inp} value={f.cat} onChange={e => set('cat', e.target.value)} /></Field>
            <Field label={t('Dossier de destination')}><select className={inp} value={f.folder} onChange={e => set('folder', e.target.value)}>{['My KPI', 'Shared KPI', 'Team KPI'].map(o => <option key={o}>{o}</option>)}</select></Field>
            <Field label={t('Visibilité')}><div className="flex gap-1.5">{['PRIVATE', 'PUBLIC'].map(x => <button type="button" key={x} onClick={() => set('lib', x)} className={`flex-1 h-9 rounded-md border text-[12.5px] ${f.lib === x ? 'font-semibold' : 'border-border'}`} style={f.lib === x ? { borderColor: LIBC[x], color: LIBC[x] } : {}}>{x}</button>)}</div></Field>
            <Field label={t('Unité')}><select className={inp} value={f.unit} onChange={e => set('unit', e.target.value)}>{UNITS.map(o => <option key={o}>{o}</option>)}</select></Field>
            <Field label="Version"><input className={inp + ' font-mono'} value={f.ver} onChange={e => set('ver', e.target.value)} /></Field>
          </div>}
          {step === 1 && <div className="space-y-5">
            <div><div className="text-[13px] font-semibold mb-2">{t('Numérateur')} <span className="font-normal text-subtle">— {t('succès')}</span></div><Rules which="num" /></div>
            <div className="text-center font-mono text-[13px] text-subtle">÷</div>
            <div><div className="text-[13px] font-semibold mb-2">{t('Dénominateur')} <span className="font-normal text-subtle">— {t('tentatives')}</span></div><Rules which="den" /></div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border-subtle">
              <Field label={t('Agrégation')}><select className={inp} value={f.agg} onChange={e => set('agg', e.target.value)}>{AGGS.map(o => <option key={o}>{o}</option>)}</select></Field>
              <Field label={t('Dédoublonnage')}><input className={inp} value={f.dedup} onChange={e => set('dedup', e.target.value)} /></Field>
              <Field label={t('Invariant')}><input className={inp} value={f.inv} onChange={e => set('inv', e.target.value)} /></Field>
            </div>
            <div className="text-[12px] text-muted-foreground font-mono bg-surface-2 rounded-md p-2.5">{t('Formule')} : ({f.num.map(r => r.msg).join(' + ')} / {f.den.map(r => r.msg).join(' + ')}){f.unit === '%' ? ' × 100' : ''}</div>
          </div>}
          {step === 2 && <div><div className="text-[12.5px] text-muted-foreground mb-3">{t('Ventiler le KPI par :')}</div><div className="flex flex-wrap gap-2">{DIMS.map(d => { const on = f.dims.includes(d); return <button type="button" key={d} onClick={() => set('dims', on ? f.dims.filter(x => x !== d) : [...f.dims, d])} className={`h-8 px-3 rounded-full border text-[12.5px] ${on ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white' : 'border-border text-ink-2 hover:border-border-strong'}`}>{on ? '✓ ' : '+ '}{t(d)}</button>; })}</div></div>}
          {step === 3 && <div className="space-y-4">
            <div className="flex items-end gap-3"><Field label={t('Portée des données')}><select className={inp + ' w-64'}><option>Run 5G #482</option><option>Run 4G #219</option><option>{t('Dernières 24 h')}</option></select></Field><Btn primary type="button" onClick={() => setTested(errs.length ? { ok: false } : demo ? { ok: true, v: mockSeries({ id: f.id, unit: f.unit }, '15 min') } : { ok: false, src: true })}>{t('Exécuter le KPI')}</Btn></div>
            {errs.length > 0 && <div className="rounded-md bg-danger-soft text-danger text-[12.5px] px-3 py-2">{errs.map(e => <div key={e}>• {t(e)}</div>)}</div>}
            {tested?.src && <div className="rounded-md bg-warning-soft text-warning text-[12.5px] px-3 py-2">{t('Source POLARIS indisponible : exécution impossible. Activez « Démo » pour un aperçu.')}</div>}
            {tested?.ok && <div className="space-y-2"><div className="flex items-center gap-3"><span className="text-[22px] font-semibold tabular-nums">{fmtV(tested.v[tested.v.length - 1], f.unit)}</span><Tag c="#15803D">{t('Invariant vérifié')}</Tag><Tag c="#A15C00">{t('Données de démo')}</Tag><button type="button" onClick={() => p.setPage('sessions')} className="ml-auto text-[12px] font-medium text-[var(--app-accent)]">{t('Ouvrir les sessions sources →')}</button></div><div className="h-[180px]"><MockChart data={tested.v} unit={f.unit} /></div></div>}
          </div>}
          {step === 4 && <div className="space-y-4">
            <div className="flex items-center gap-2">{['Brouillon', 'Testé', 'Validé', 'Publié'].map((s, i) => <React.Fragment key={s}><span className={`h-7 px-3 rounded-full grid place-items-center text-[12px] ${stage > i ? 'bg-[var(--app-accent)] text-white' : 'bg-muted text-subtle'}`}>{t(s)}</span>{i < 3 && <span className="text-faint">→</span>}</React.Fragment>)}</div>
            <div className="grid grid-cols-2 gap-4"><Field label={t('Version SemVer')}><input className={inp + ' font-mono'} value={pub.ver} onChange={e => setPub({ ...pub, ver: e.target.value })} /></Field><Field label={t('Auteur · Date')}><input className={inp} disabled value={'SD · ' + new Date().toLocaleDateString('fr-FR')} /></Field></div>
            <Field label={t('Entrée CHANGELOG')}><textarea className={inp + ' h-20 py-2'} value={pub.log} onChange={e => setPub({ ...pub, log: e.target.value })} /></Field>
            {!/^\d+\.\d+\.\d+$/.test(pub.ver) && <div className="text-[12px] text-danger">{t('Version SemVer invalide (x.y.z)')}</div>}
            <div className="flex gap-2">
              <Btn type="button" disabled={!tested?.ok} onClick={() => { set('status', 'validated'); log('KPI validé ' + f.id); }}>{t('Valider')}</Btn>
              <Btn primary type="button" disabled={f.status !== 'validated' || !pub.log || !/^\d+\.\d+\.\d+$/.test(pub.ver)} onClick={() => { const cl = [...(f.changelog || []), { v: pub.ver, by: 'SD', date: new Date().toLocaleDateString('fr-FR'), msg: pub.log }]; save('published', { ver: pub.ver, changelog: cl }); set('status', 'published'); set('ver', pub.ver); setTab('catalog'); }}>{t('Publier')}</Btn>
            </div>
            <div className="text-[11.5px] text-subtle">{t('Publication : test réussi + validation + SemVer + CHANGELOG. Requête reproductible jointe.')}</div>
          </div>}
        </fieldset>
        <div className="px-5 py-3 border-t border-border-subtle flex gap-2"><Btn type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>← {t('Précédent')}</Btn><Btn type="button" disabled={!canWrite || errs.length > 0} onClick={() => save('draft')}>{t('Enregistrer brouillon')}</Btn><Btn primary className="ml-auto" type="button" disabled={step === 4} onClick={() => setStep(step + 1)}>{t('Suivant')} →</Btn></div>
      </div>
      <div className={card + ' overflow-hidden sticky top-4'}>
        <div className="h-11 px-4 flex items-center border-b border-border-subtle"><h3 className="text-[13px] font-semibold">{t('Aperçu')}</h3><Tag c={LIBC[f.lib]} >{f.lib}</Tag><span className="ml-auto font-mono text-[11px] text-subtle">v{f.ver}</span></div>
        <div className="p-4 space-y-3 text-[12.5px]"><div><div className="text-[14px] font-semibold">{f.name || t('Sans titre')}</div><div className="font-mono text-[11px] text-subtle">{f.id} · {f.tech} · {f.unit}</div></div>
          <div className="flex flex-wrap gap-1">{f.dims.map(d => <Tag key={d}>{t(d)}</Tag>)}</div>
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-1.5">{t('Requête générée')}</div><pre className="font-mono text-[11px] leading-relaxed text-ink-2 bg-surface-2 border border-border-subtle rounded-md p-3 whitespace-pre-wrap">{q}</pre></div></div>
      </div>
    </div>
  );
}

/* ===== Dashboards ===== */
function DashLib(p) {
  const { dashboards: SYS_DASH } = useKpiDemo();
  const { t, dashes, setDashes, canWrite, log, setOpenDash } = p;
  const [confirm, setConfirm] = useState(null);
  const all = [...SYS_DASH, ...dashes];
  const nw = () => { const d = { id: 'd' + Date.now(), lib: 'PRIVATE', name: t('Nouveau dashboard'), widgets: [] }; setDashes(x => [...x, d]); log('Dashboard créé ' + d.name); setOpenDash(d); };
  const dup = (d) => { const n = { ...d, id: 'd' + Date.now(), lib: 'PRIVATE', name: d.name + ' (copie)', widgets: d.widgets.map(w => ({ ...w, id: w.id + 'c' + Date.now() })) }; setDashes(x => [...x, n]); log('Dashboard dupliqué ' + d.name); };
  const exp = (d) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = d.name + '.json'; a.click(); };
  return <div className="space-y-6">
    <div className="flex items-center"><div className="text-[13px] text-muted-foreground">{all.length} dashboards</div><Btn primary className="ml-auto" disabled={!canWrite || !demo} onClick={nw}>+ {t('Nouveau dashboard')}</Btn></div>
    {['SYSTEM', 'PUBLIC', 'PRIVATE'].map(L => { const ds = all.filter(d => d.lib === L); return <section key={L}><h2 className="text-[11px] font-bold tracking-[0.06em] mb-3" style={{ color: LIBC[L] }}>{L} <span className="text-subtle font-normal">{ds.length}</span></h2>
      {ds.length === 0 ? <div className="rounded-xl border border-dashed border-border px-5 py-6 text-[12.5px] text-subtle">{t('Aucun dashboard')}</div> :
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{ds.map(d => <div key={d.id} className={card + ' p-4 flex flex-col hover:border-border-strong transition'}>
          <button onClick={() => setOpenDash(d)} className="text-left"><div className="h-20 rounded-md bg-surface-2 border border-border-subtle grid grid-cols-3 gap-1 p-1.5">{d.widgets.slice(0, 6).map(w => <div key={w.id} className="rounded-sm bg-white border border-border" />)}</div><div className="mt-3 text-[14px] font-semibold text-foreground">{d.name}</div><div className="text-[12px] text-subtle">{d.widgets.length} widgets</div></button>
          <div className="mt-3 flex flex-wrap gap-1 text-[11.5px]">
            <button onClick={() => setOpenDash(d)} className="font-medium text-[var(--app-accent)]">{t('Ouvrir')}</button><span className="text-faint">·</span>
            <button disabled={!canWrite || !demo} onClick={() => dup(d)} className="text-muted-foreground disabled:opacity-40">{t('Dupliquer')}</button><span className="text-faint">·</span>
            <button onClick={() => exp(d)} className="text-muted-foreground">{t('Exporter')}</button>
            {d.lib !== 'SYSTEM' && <><span className="text-faint">·</span><button disabled={!canWrite || !demo} onClick={() => { const n = prompt(t('Renommer'), d.name); if (n) { setDashes(x => x.map(y => y.id === d.id ? { ...y, name: n } : y)); log('Dashboard renommé ' + n); } }} className="text-muted-foreground disabled:opacity-40">{t('Renommer')}</button><span className="text-faint">·</span>
              <button disabled={!canWrite || !demo} onClick={() => { setDashes(x => x.map(y => y.id === d.id ? { ...y, lib: y.lib === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' } : y)); log('Dashboard partagé ' + d.name); }} className="text-muted-foreground disabled:opacity-40">{d.lib === 'PUBLIC' ? t('Rendre privé') : t('Partager')}</button><span className="text-faint">·</span>
              <button disabled={!canWrite || !demo} onClick={() => setConfirm(d)} className="text-danger disabled:opacity-40">{t('Supprimer')}</button></>}
          </div></div>)}</div>}</section>; })}
    {confirm && <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={() => setConfirm(null)}><div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-5 w-[380px] shadow-xl"><div className="text-[15px] font-semibold">{t('Supprimer le dashboard ?')}</div><div className="mt-1 text-[13px] text-muted-foreground">« {confirm.name} » — {t('cette action est journalisée.')}</div><div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setConfirm(null)}>{t('Annuler')}</Btn><button onClick={() => { setDashes(x => x.filter(y => y.id !== confirm.id)); log('Dashboard supprimé ' + confirm.name); setConfirm(null); }} className="h-8 px-3 rounded-md bg-danger text-white text-[12.5px] font-medium">{t('Supprimer')}</button></div></div></div>}
  </div>;
}

function Widget({ w, k, p, filters }) {
  const { t, demo, mockSeries, MockChart, fmtV } = p;
  if (!k) return <Empty title={t('KPI introuvable')} sub={w.kpi} />;
  const data = demo ? mockSeries(k, filters.period) : null;
  if (!data) return <Empty title={t('Aucune donnée')} sub={t('POLARIS non connecté.')} />;
  const last = data[data.length - 1];
  if (w.type === 'card') return <div className="h-full flex flex-col justify-center px-2"><div className="text-[30px] font-semibold tabular-nums text-foreground">{fmtV(last, k.unit)}</div><div className="text-[12px] text-subtle">{t('moyenne')} {fmtV(data.reduce((a, b) => a + b, 0) / data.length, k.unit)}</div>{w.thr && <div className={`mt-1 text-[11.5px] ${last < +w.thr ? 'text-danger' : 'text-success'}`}>{t('seuil')} {w.thr}</div>}</div>;
  if (['bar', 'stack', 'hist'].includes(w.type)) { const vals = w.type === 'hist' ? Array.from({ length: 12 }, (_, i) => data.filter(v => { const mn = Math.min(...data), mx = Math.max(...data), s = (mx - mn) / 12 || 1; return v >= mn + i * s && v < mn + (i + 1) * s + (i === 11 ? 1 : 0); }).length) : data.slice(-16); const mx = Math.max(...vals) || 1; return <div className="h-full flex items-end gap-[3px] pt-2">{vals.map((v, i) => <div key={i} className="flex-1 rounded-t-sm" style={{ height: (v / mx * 100) + '%', background: w.color || 'var(--app-accent)', opacity: w.type === 'stack' ? 0.5 + (i % 2) * 0.5 : 1 }} title={String(v)} />)}</div>; }
  if (w.type === 'cdf' || w.type === 'pct') { const s = [...data].sort((a, b) => a - b); return <MockChart data={w.type === 'cdf' ? s.map((_, i) => (i + 1) / s.length * 100) : s} unit={w.type === 'cdf' ? '%' : k.unit} />; }
  if (w.type === 'top' || w.type === 'table') return <div className="text-[12px] divide-y divide-border-subtle">{['0A1F', '0B07', '0C12', '0D3E', '0E44'].map((c, i) => <div key={c} className="flex py-1.5"><span className="font-mono text-ink-2">{t('Cellule')} {c}</span><span className="ml-auto tabular-nums">{fmtV(data[data.length - 1 - i * 3], k.unit)}</span></div>)}</div>;
  if (w.type === 'heat') return <div className="grid grid-cols-12 gap-[2px] h-full content-start pt-1">{data.slice(0, 48).map((v, i) => <div key={i} className="h-4 rounded-[2px]" style={{ background: w.color || 'var(--app-accent)', opacity: 0.1 + (v - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1) * 0.9 }} />)}</div>;
  return <MockChart data={data} unit={k.unit} />;
}

function DashEditor(p) {
  const { t, dash, setDashes, canWrite, byId, all, log, setOpenDash, setPage } = p;
  const ro = dash.lib === 'SYSTEM' || !canWrite;
  const [d, setD] = useState(dash); const [sel, setSel] = useState(null); const [dirty, setDirty] = useState(false);
  const [filters, setFilters] = useState({ period: '15 min', run: 'Tous', rat: 'Tous', site: 'Tous', cell: 'Toutes', ifc: 'Toutes', dnn: 'Tous', nssai: 'Tous' });
  const grid = useRef(null); const ROW = 80;
  const upd = (id, ch) => { setD(x => ({ ...x, widgets: x.widgets.map(w => w.id === id ? { ...w, ...ch } : w) })); setDirty(true); };
  const start = (e, w, mode) => { if (ro) return; e.preventDefault(); e.stopPropagation(); setSel(w.id); const col = grid.current.clientWidth / 12; const x0 = e.clientX, y0 = e.clientY, s = { ...w };
    const mv = (ev) => { const dx = Math.round((ev.clientX - x0) / col), dy = Math.round((ev.clientY - y0) / ROW); if (mode === 'move') upd(w.id, { x: Math.max(0, Math.min(12 - s.w, s.x + dx)), y: Math.max(0, s.y + dy) }); else upd(w.id, { w: Math.max(2, Math.min(12 - s.x, s.w + dx)), h: Math.max(2, s.h + dy) }); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
  // compact vertical order to avoid overlaps
  const placed = useMemo(() => { const out = []; [...d.widgets].sort((a, b) => a.y - b.y || a.x - b.x).forEach(w => { let y = w.y; const hit = (yy) => out.some(o => o.x < w.x + w.w && w.x < o.x + o.w && o.y < yy + w.h && yy < o.y + o.h); while (hit(y)) y++; out.push({ ...w, y }); }); return out; }, [d.widgets]);
  const rows = Math.max(4, ...placed.map(w => w.y + w.h));
  const save = () => { setDashes(x => x.map(y => y.id === d.id ? { ...d, widgets: placed } : y)); setDirty(false); log('Dashboard enregistré ' + d.name); };
  const add = () => { const w = { id: 'w' + Date.now(), kpi: all[0].id, type: 'series', title: '', x: 0, y: rows, w: 4, h: 3, inherit: true, color: '', thr: '' }; setD(x => ({ ...x, widgets: [...x.widgets, w] })); setSel(w.id); setDirty(true); };
  const sw = d.widgets.find(w => w.id === sel); const sk = sw && byId(sw.kpi);
  const exportCsv = (w) => { const k = byId(w.kpi); const data = p.demo ? p.mockSeries(k, filters.period) : []; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['index,value\n' + data.map((v, i) => i + ',' + v).join('\n')], { type: 'text/csv' })); a.download = (w.title || k.name) + '.csv'; a.click(); };
  const FIL = [['run', 'Run', ['Tous', 'Run 5G #482', 'Run 4G #219']], ['rat', 'RAT', ['Tous', 'NR', 'LTE']], ['site', 'Site', ['Tous', 'Lab-Paris']], ['cell', 'Cellule', ['Toutes', '0A1F', '0B07']], ['ifc', 'Interface', ['Toutes', 'N1', 'N2', 'N4', 'SBI', 'S1-MME']], ['dnn', 'DNN', ['Tous', 'internet', 'ims']], ['nssai', 'S-NSSAI', ['Tous', '1-000001']]];
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => setOpenDash(null)} className="text-[12.5px] text-muted-foreground hover:text-foreground">← Dashboards</button>
      <input disabled={ro} value={d.name} onChange={e => { setD({ ...d, name: e.target.value }); setDirty(true); }} className="text-[18px] font-semibold bg-transparent outline-none border-b border-transparent focus:border-[var(--app-accent)] min-w-0" />
      <Tag c={LIBC[d.lib]}>{d.lib}</Tag>{ro && <span className="text-[11.5px] text-subtle">{dash.lib === 'SYSTEM' ? t('Lecture seule — dupliquez pour modifier') : t('Consultation uniquement')}</span>}
      <div className="ml-auto flex gap-1.5">{!ro && <><Btn onClick={add}>+ Widget</Btn><Btn primary disabled={!dirty} onClick={save}>{dirty ? t('Enregistrer') : t('Enregistré')}</Btn></>}</div>
    </div>
    <div className={card + ' px-3 py-2 flex flex-wrap items-center gap-2'}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mr-1">{t('Filtres globaux')}</span>
      <div className="flex rounded-md border border-border overflow-hidden">{['1 min', '15 min', '1 h', '1 j'].map(g => <button key={g} onClick={() => setFilters({ ...filters, period: g })} className={`h-7 px-2.5 whitespace-nowrap text-[12px] ${filters.period === g ? 'bg-[var(--app-accent)] text-white' : 'text-ink-2'}`}>{g}</button>)}</div>
      {FIL.map(([k, n, opts]) => <select key={k} value={filters[k]} onChange={e => setFilters({ ...filters, [k]: e.target.value })} className="h-7 rounded-md border border-border text-[12px] px-1.5 bg-white">{opts.map(o => <option key={o} value={o}>{t(n)}: {o}</option>)}</select>)}
    </div>
    <div className="flex gap-3 items-start">
      <div ref={grid} className="flex-1 min-w-0 relative rounded-xl" style={{ height: rows * ROW, backgroundImage: ro ? 'none' : 'linear-gradient(to right, #F0F0F0 1px, transparent 1px)', backgroundSize: 'calc(100% / 12) 100%' }}>
        {placed.length === 0 && <div className="absolute inset-0 rounded-xl border border-dashed border-border grid place-items-center text-[13px] text-subtle">{t('Ajoutez un widget pour commencer.')}</div>}
        {placed.map(w => { const k = byId(w.kpi); return <div key={w.id} onClick={() => setSel(w.id)} className={`absolute p-1.5`} style={{ left: `${w.x / 12 * 100}%`, top: w.y * ROW, width: `${w.w / 12 * 100}%`, height: w.h * ROW }}>
          <div className={`h-full ${card} flex flex-col overflow-hidden ${sel === w.id && !ro ? 'ring-2 ring-[var(--app-accent)]' : ''}`}>
            <div onPointerDown={e => start(e, w, 'move')} className={`h-9 px-3 flex items-center gap-2 border-b border-border-subtle ${ro ? '' : 'cursor-move'}`}><span className="text-[12.5px] font-semibold truncate">{w.title || (k ? t(k.name) : w.kpi)}</span>{!w.inherit && <Tag c="#7C3AED">{t('filtres propres')}</Tag>}<span className="ml-auto flex gap-1.5 text-[11px] text-subtle"><button onPointerDown={e => e.stopPropagation()} onClick={() => exportCsv(w)} title="CSV">CSV</button><button onPointerDown={e => e.stopPropagation()} onClick={() => setPage('sessions')} title="Drill-down">↘</button></span></div>
            <div className="flex-1 min-h-0 p-2"><Widget w={w} k={k} p={p} filters={filters} /></div>
          </div>
          {!ro && <div onPointerDown={e => start(e, w, 'resize')} className="absolute right-2 bottom-2 w-3 h-3 cursor-se-resize border-r-2 border-b-2 border-border-strong rounded-br" />}
        </div>; })}
      </div>
      {sw && !ro && <div className={card + ' w-[300px] shrink-0 overflow-hidden sticky top-4'}>
        <div className="h-11 px-4 flex items-center border-b border-border-subtle"><h3 className="text-[13px] font-semibold">{t('Configuration')}</h3><button onClick={() => { setD(x => ({ ...x, widgets: x.widgets.filter(y => y.id !== sw.id) })); setSel(null); setDirty(true); }} className="ml-auto text-[12px] text-danger">{t('Retirer')}</button></div>
        <div className="p-4 space-y-3">
          <Field label={t('Titre')}><input className={inp} value={sw.title} placeholder={sk && t(sk.name)} onChange={e => upd(sw.id, { title: e.target.value })} /></Field>
          <Field label="KPI"><select className={inp} value={sw.kpi} onChange={e => upd(sw.id, { kpi: e.target.value })}>{all.map(k => <option key={k.id} value={k.id}>{t(k.name)}</option>)}</select></Field>
          <Field label={t('Type de widget')}><div className="grid grid-cols-2 gap-1">{WTYPES.map(([id, n]) => { const why = sk && wCompat(id, sk.unit); return <button key={id} disabled={!!why} title={why ? t(why) : ''} onClick={() => upd(sw.id, { type: id })} className={`h-7 rounded-md border text-[11.5px] disabled:opacity-35 disabled:cursor-not-allowed ${sw.type === id ? 'border-[var(--app-accent)] text-[var(--app-accent)] font-semibold' : 'border-border'}`}>{n}</button>; })}</div></Field>
          <Field label={t('Couleur de série')}><div className="flex gap-1.5">{['', '#0062A1', '#0F5B56', '#7C3AED', '#A15C07', '#B42318'].map(c => <button key={c} onClick={() => upd(sw.id, { color: c })} className={`w-6 h-6 rounded-full border-2 ${sw.color === c ? 'border-foreground' : 'border-white'}`} style={{ background: c || 'var(--app-accent)' }} />)}</div></Field>
          <Field label={t('Seuil')}><input className={inp} value={sw.thr} onChange={e => upd(sw.id, { thr: e.target.value })} placeholder="ex. 95" /></Field>
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={sw.inherit} onChange={e => upd(sw.id, { inherit: e.target.checked })} />{t('Hérite des filtres globaux')}</label>
          <div className="text-[11px] text-subtle">{t('Glissez l’en-tête pour déplacer, le coin pour redimensionner.')}</div>
        </div></div>}
    </div>
  </div>;
}

/* ===== Anomalies ===== */
function Anomalies(p) {
  const { anomalies: ANOMS } = useKpiDemo();
  const { t, demo, byId, canWrite, log, setPage } = p;
  const [list, setList] = useStore('polaris-anoms', ANOMS);
  const [f, setF] = useState({ q: '', sev: 'all', st: 'all', kpi: 'all', per: '24 h' }); const [sel, setSel] = useState(null); const [just, setJust] = useState(''); const [proof, setProof] = useState('');
  const rows = demo ? list.filter(a => (f.sev === 'all' || a.sev === f.sev) && (f.st === 'all' || a.st === f.st) && (f.kpi === 'all' || a.kpi === f.kpi) && (!f.q || (a.id + a.rule + a.kpi).toLowerCase().includes(f.q.toLowerCase()))) : [];
  const a = rows.find(x => x.id === sel) || rows[0];
  const SEV = { Critique: '#B42318', Majeure: '#A15C07', Mineure: '#666666' };
  const close = () => { setList(l => l.map(x => x.id === a.id ? { ...x, st: 'FERMÉ', ev: [...x.ev, [new Date().toLocaleTimeString('fr-FR').slice(0, 5), `Fermée par SD — ${just} — preuve ${proof}`]] } : x)); log('Anomalie fermée ' + a.id); setJust(''); setProof(''); };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center">
      {[['N1', 'Règles et seuils', true], ['N2', 'Nouveautés protocolaires', true], ['N3', 'Détection statistique', false]].map(([l, n, on]) => <span key={l} className={`text-[12px] px-2.5 h-7 rounded-full border flex items-center gap-1.5 ${on ? 'border-border bg-white' : 'border-dashed border-border text-subtle'}`}><b>{l}</b> {t(n)}{!on && ' · ' + t('lot non disponible')}</span>)}
    </div>
    <div className={card + ' px-3 py-2 flex flex-wrap gap-2 items-center'}>
      <input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder={t('Rechercher…')} className={inp + ' h-8 w-56 text-[12.5px]'} />
      <select value={f.kpi} onChange={e => setF({ ...f, kpi: e.target.value })} className="h-8 rounded-md border border-border text-[12px] px-1.5 bg-white"><option value="all">KPI: {t('tous')}</option>{[...new Set(ANOMS.map(x => x.kpi))].map(k => <option key={k} value={k}>{t(byId(k)?.name || k)}</option>)}</select>
      <select value={f.sev} onChange={e => setF({ ...f, sev: e.target.value })} className="h-8 rounded-md border border-border text-[12px] px-1.5 bg-white"><option value="all">{t('Sévérité')}: {t('toutes')}</option>{Object.keys(SEV).map(s => <option key={s}>{s}</option>)}</select>
      <select value={f.st} onChange={e => setF({ ...f, st: e.target.value })} className="h-8 rounded-md border border-border text-[12px] px-1.5 bg-white"><option value="all">{t('Statut')}: {t('tous')}</option><option>OUVERT</option><option>FERMÉ</option></select>
      <select value={f.per} onChange={e => setF({ ...f, per: e.target.value })} className="h-8 rounded-md border border-border text-[12px] px-1.5 bg-white">{['1 h', '24 h', '7 j'].map(o => <option key={o}>{t('Période')}: {o}</option>)}</select>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
      <div className={card + ' overflow-hidden'}>{rows.length === 0 ? <Empty title={demo ? t('Aucune anomalie pour ces filtres') : t('Aucune anomalie')} sub={demo ? '' : t('Service POLARIS non connecté : aucune règle évaluée.')} /> :
        <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-subtle">{['ID', 'KPI', t('Règle'), t('Niveau'), t('Sévérité'), t('Statut'), t('Détectée')].map(h => <th key={h} className="px-4 py-2 font-medium border-b border-border-subtle">{h}</th>)}</tr></thead>
          <tbody>{rows.map(x => <tr key={x.id} onClick={() => setSel(x.id)} className={`cursor-pointer ${a?.id === x.id ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--app-accent)]' : 'hover:bg-surface-2'}`}><td className="px-4 py-2.5 font-mono">{x.id}</td><td className="px-4">{t(byId(x.kpi)?.name || x.kpi)}</td><td className="px-4">{t(x.rule)}</td><td className="px-4">{x.lvl}</td><td className="px-4" style={{ color: SEV[x.sev] }}>{x.sev}</td><td className="px-4"><Tag c={x.st === 'OUVERT' ? '#B42318' : '#15803D'}>{t(x.st)}</Tag></td><td className="px-4 text-subtle">{x.at}</td></tr>)}</tbody></table>}</div>
      {a && <div className={card + ' overflow-hidden'}>
        <div className="h-11 px-4 flex items-center gap-2 border-b border-border-subtle"><h3 className="text-[13px] font-semibold font-mono">{a.id}</h3><Tag c={a.st === 'OUVERT' ? '#B42318' : '#15803D'}>{t(a.st)}</Tag>{demo && <Tag c="#A15C00">{t('Données de démo')}</Tag>}</div>
        <div className="p-4 space-y-4 text-[12.5px]">
          <div><div className="text-[14px] font-semibold">{t(a.rule)}</div><div className="text-subtle">{a.lvl} · {t(byId(a.kpi)?.name || a.kpi)}</div></div>
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-1.5">{t('Historique')}</div>{a.ev.map(([h, m], i) => <div key={i} className="flex gap-3 py-1"><span className="font-mono text-[11px] text-subtle w-20 shrink-0">{h}</span><span className="text-ink-2">{m}</span></div>)}</div>
          <div className="text-[11.5px] text-subtle">{t('Constat factuel uniquement — aucune cause supposée sans preuve.')}</div>
          <div className="flex gap-2"><Btn onClick={() => setPage('sessions')}>{t('Sessions')} →</Btn><Btn onClick={() => setPage('sessions')}>{t('Preuves')} →</Btn></div>
          {a.st === 'OUVERT' && <div className="pt-3 border-t border-border-subtle space-y-2"><Field label={t('Justification')}><textarea disabled={!canWrite || !demo} className={inp + ' h-16 py-2'} value={just} onChange={e => setJust(e.target.value)} /></Field><Field label={t('Preuve (réf.)')}><input disabled={!canWrite || !demo} className={inp} value={proof} onChange={e => setProof(e.target.value)} placeholder="#312" /></Field><Btn primary disabled={!canWrite || !just.trim() || !proof.trim()} onClick={close}>{t('Fermer l’anomalie')}</Btn></div>}
        </div></div>}
    </div>
  </div>;
}
