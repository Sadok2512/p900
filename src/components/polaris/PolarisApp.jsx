import KpiModule from './kpi/KpiModule';
import LiveModule from './live/LiveModule';
import { useAuthMe, useHealth, useVersion, useMetrics, useLiveMetrics, useStorageSafety, useSessions, useSessionBundle, useProbes, useProbeResources, useDatasets, useAvailableCauses, useTrafficDemo, useKpiCatalogue, useDemoLibrary, usePolarisMode, useSessionFilter, useEvent, useProvenance, usePackets, useCorrelationRules, apiPath, redact, records, canCapture, useCaptureAction, TRAFFIC_ENABLED, UI_VERSION, toLegacySession, toLegacyProbe, available, querySupport, versionComponents, decoderVersions, topBarLiveIndicator } from '@/lib/polaris-api';
import { DataStatus } from '@/lib/polaris-api/status';
import React, { useState, useMemo, useEffect, useRef } from 'react';

/* Données fictives — PLMN de test 001/01. Tri canonique (capture_id, seq). */
const IFC = {
  'N2':['#1D4ED8','#EFF4FF'],'SBI':['#6D28D9','#F4F0FF'],'N4':['#A15C07','#FDF6E7'],'N3':['#15803D','#ECF8F0'],
  'S1-MME':['#1D4ED8','#EFF4FF'],'S6a':['#BE185D','#FDEEF5'],'S11':['#A15C07','#FDF6E7'],'S5-C':['#A15C07','#FDF6E7'],'S1-U':['#15803D','#ECF8F0'],
};
const nodeIdx = (nodes, n) => nodes.indexOf(n==='AUSF'||n==='UDM' ? 'AUSF/UDM' : n);
const fmtV = (v,u) => u==='%'?v.toFixed(1)+' %':u==='ms'?Math.round(v)+' ms':u==='s'?v.toFixed(1)+' s':String(Math.round(v));
const FIELDS = [
  ['Résultat',['Succès','Échec']],['RAT',['5G SA','LTE']],
  ['Procédure',['Registration','PDU Session','Service Request','Attach','Tracking Area Update','Detach','Deregistration','E-RAB Release']],
  ['Cause',['5GSM #27','5GMM #7','S6a 5001','S1AP radio #20']],
  ['Interface',['N2','SBI','N4','N3','S1-MME','S6a','S11','S1-U']],['Cellule',['gNB-1','eNB-1']],['UE',['UE-7f3a','UE-9b14','UE-2c90','UE-51de']],
];
const test = (s,[k,v]) => ({
  'Résultat':()=>s.res===v,'RAT':()=>s.rat===v,'Procédure':()=>String(s.proc ?? '').includes(v),'Cause':()=>String(s.cause ?? '').includes(v),
  'Interface':()=>s.d.msgs.some(m=>m[0]===v),'Cellule':()=>String(s.cell ?? '').includes(v),'UE':()=>s.ue===v,
}[k] || (()=>true))();

/* ------------------------------------------------------------------ */
const EN = {"Débit, santé TCP, applications, congestion": "Throughput, TCP health, applications, congestion", "Aucune charge utile, aucune URL complète stockée.": "No payload, no full URL stored.", "Volume": "Volume", "Débit DL": "DL throughput", "Flux actifs": "Active flows", "Établissement TCP": "TCP setup", "RTT médian": "Median RTT", "Flux congestionnés": "Congested flows", "Vue d'ensemble": "Overview", "Catégorie": "Category", "Application": "Application", "Cellule": "Cell", "Vidéo": "Video", "Transfert": "Transfer", "Messagerie": "Messaging", "Voix": "Voice", "Jeu": "Gaming", "Non identifié": "Unidentified", "Réseau réel : agrégé uniquement, sans historique par abonné.": "Live network: aggregated only, no per-subscriber history.", "Santé TCP": "TCP health", "Sans réponse": "No response", "Retransmissions": "Retransmissions", "ACK dupliqués": "Duplicate ACKs", "Fenêtre nulle": "Zero window", "RTT intra-capture et même interface uniquement.": "RTT intra-capture and same interface only.", "Congestion cellules × temps": "Cell congestion × time", "Radio": "Radio", "Cœur/Internet": "Core/Internet", "Limite QoS": "QoS limit", "Limite récepteur": "Receiver limit", "Limite application": "Application limit", "INDÉTERMINÉ": "UNDETERMINED", "Flux": "Flows", "Règle": "Rule", "Verdict": "Verdict", "Détail du flux": "Flow detail", "Règle appliquée": "Applied rule", "Ouvrir la session dans l'Analyzer →": "Open session in Analyzer →", "Taux d’établissement TCP": "TCP setup rate", "RTT TCP": "TCP RTT", "Retransmissions TCP": "TCP retransmissions", "Live delayed by": "Live delayed by", "flux pris après décodage — dumpcap jamais touchés": "stream taken after decoding — dumpcap never touched", "Cible": "Target", "Pause": "Pause", "Reprendre": "Resume", "Rôle viewer : cible par pseudonyme uniquement, identités masquées.": "Viewer role: pseudonym targets only, identities masked.", "Traces actives": "Active traces", "Expiration": "Expires in", "Messages reçus": "Messages received", "En tampon (pause)": "Buffered (paused)", "Signalisation live": "Live signalling", "en direct": "live", "en pause": "paused", "Ordre (capture_id, seq) — chaque message est retrouvable à l'identique dans l'Analyzer.": "Order (capture_id, seq) — every message is found identical in the Analyzer.", "Chaîne d'identité": "Identity chain", "masqué": "masked", "Débit live": "Live throughput", "Rapport d'usage PFCP": "PFCP usage report", "écart": "gap", "RTP live": "Live RTP", "Codec": "Codec", "Débit": "Bitrate", "Pertes": "Loss", "Gigue": "Jitter", "Déséquencement": "Reordering", "estimation G.107": "G.107 estimate", "En-têtes seulement — aucune charge audio lue ni stockée.": "Headers only — no audio payload read or stored.", "Journal des traces": "Trace log", "trace créée": "trace created", "recherche IMSI": "IMSI lookup", "consultation historique": "history viewed", "Données de démo": "Demo data", "Fraîcheur : 4 s": "Freshness: 4 s", "moyenne": "average", "échecs": "failures", "maintenant": "now", "il y a": "", "preuve": "evidence", "Analyse": "Analysis", "Template": "Template", "il y a 3 min": "3 min ago", "il y a 12 min": "12 min ago", "il y a 40 min": "40 min ago", "il y a 2 h": "2 h ago", "Données de démo — POLARIS non connecté.": "Demo data — POLARIS not connected.", "Accueil": "Home", "Administrateur": "Administrator", "Topologie et état des nœuds du réseau.": "Network node topology and status.", "Analyzer": "Analyzer", "Nœuds": "Nodes", "KPI": "KPI", "Live": "Live", "Trafic": "Traffic", "Templates": "Templates", "Paramètres": "Settings", "Compte": "Account", "Notifications": "Notifications", "Rechercher…": "Search…", "← Retour": "← Back", "Gérez votre compte et l'apparence de POLARIS": "Manage your account and the look of POLARIS", "Apparence": "Appearance", "Couleur et thème": "Color and theme", "Sécurité": "Security", "Mot de passe": "Password", "À propos": "About", "Version et build": "Version and build", "Langue": "Language", "Français ou English": "French or English", "Couleur de l'application": "App color", "Choisissez la couleur d'accent utilisée dans toute l'interface.": "Choose the accent color used across the interface.", "Bleu": "Blue", "Noir": "Black", "Vert": "Green", "Utilisez au moins 8 caractères, avec majuscules, chiffres et symboles.": "Use at least 8 characters, with uppercase letters, numbers and symbols.", "Mot de passe actuel": "Current password", "Nouveau mot de passe": "New password", "Confirmer le mot de passe": "Confirm password", "Mettre à jour le mot de passe": "Update password", "Versions des composants installés.": "Versions of installed components.", "Langue de l'interface": "Interface language", "Choisissez la langue utilisée dans POLARIS.": "Choose the language used in POLARIS.", "Mot de passe actuel requis et 8 caractères minimum.": "Current password required, 8 characters minimum.", "Les mots de passe ne correspondent pas.": "Passwords do not match.", "Mot de passe mis à jour.": "Password updated.", "Bienvenue sur POLARIS": "Welcome to POLARIS", "Analyse, diagnostic et supervision des sessions et du trafic réseau.": "Analysis, diagnostics and monitoring of network sessions and traffic.", "Nouvelle analyse": "New analysis", "Ouvrir un template": "Open a template", "Explorer un run": "Explore a run", "Trace live": "Live trace", "Bientôt": "Soon", "Modules": "Modules", "KPI & Anomalies": "KPI & Anomalies", "Plan usager": "User plane", "Requêtes, ladder et corrélation des sessions 4G/5G.": "Queries, ladder and correlation of 4G/5G sessions.", "Indicateurs par procédure et détection d'écarts.": "Per-procedure indicators and anomaly detection.", "Suivi en temps réel des sessions capturées.": "Real-time tracking of captured sessions.", "Débits et flux N3 / S1-U par session.": "N3 / S1-U throughput and flows per session.", "Requêtes enregistrées et modèles prêts à l'emploi.": "Saved queries and ready-to-use models.", "Ouvrir →": "Open →", "Activité récente": "Recent activity", "Voir tout": "View all", "Aucune activité pour l'instant": "No activity yet", "Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.": "Your analyses, KPI queries, templates and viewed runs will appear here.", "Lancer une analyse →": "Start an analysis →", "État de la plateforme": "Platform status", "Voir la supervision": "View monitoring", "Capture": "Capture", "dumpcap actifs / attendus": "active / expected dumpcap", "Fraîcheur des données": "Data freshness", "dernier import": "last import", "Alertes": "Alerts", "points de vigilance": "watch points", "Service POLARIS non connecté : aucune donnée en direct.": "POLARIS service not connected: no live data.", "Données à jour · retard 4 s": "Data up to date · 4 s delay", "Fraîcheur : — (POLARIS non connecté)": "Freshness: — (POLARIS not connected)", "Rechercher un KPI…": "Search a KPI…", "Santé sonde": "Probe health", "Procédures 5G": "5G procedures", "Procédures 4G": "4G procedures", "Session N4": "N4 session", "Erreurs": "Errors", "Latence": "Latency", "Corrélation": "Correlation", "Dumpcap actifs": "Active dumpcap", "Segments ignorés": "Dropped segments", "Retard d’import": "Import lag", "Disque disponible": "Disk available", "Succès Registration": "Registration success", "Succès PDU Session": "PDU Session success", "Succès Service Request": "Service Request success", "Succès Attach": "Attach success", "Succès E-RAB Setup": "E-RAB Setup success", "Succès établissement N4": "N4 establishment success", "Erreurs S6a": "S6a errors", "Erreurs SBI par NF": "SBI errors per NF", "Latence par procédure": "Latency per procedure", "Taux de liens EXACT": "EXACT link rate", "Séries": "Series", "Heatmap causes × temps": "Causes × time heatmap", "Top-N": "Top-N", "Granularité": "Granularity", "Aucune donnée à afficher": "No data to display", "Chaque point cliquable ouvrira l'Analyzer pré-filtré (fenêtre + dimension).": "Each clickable point will open the Analyzer pre-filtered (window + dimension).", "Requête générée": "Generated query", "Fiche KPI": "KPI sheet", "Formule": "Formula", "Événements sources": "Source events", "Dimensions": "Dimensions", "Unité": "Unit", "Règle de dédup": "Dedup rule", "Invariant": "Invariant", "Explorer dans l'Analyzer →": "Explore in Analyzer →", "Anomalies": "Anomalies", "Règles et invariants": "Rules and invariants", "Nouveauté": "Novelty", "Invariant de comptage": "Counting invariant", "succès + échec = total, par procédure et par minute": "success + failure = total, per procedure per minute", "Cause obligatoire": "Mandatory cause", "toute procédure en échec porte une cause (NAS, Diameter, HTTP…)": "every failed procedure carries a cause (NAS, Diameter, HTTP…)", "Ordre canonique": "Canonical order", "seq strictement croissant dans une capture (capture_id, seq)": "seq strictly increasing within a capture (capture_id, seq)", "Cause jamais vue": "Never-seen cause", "une cause d’échec absente du référentiel historique": "a failure cause absent from the historical reference", "Séquence hors flux 3GPP": "Out-of-flow 3GPP sequence", "enchaînement de messages incompatible avec la procédure": "message sequence incompatible with the procedure", "jamais déclenchée": "never triggered", "Une anomalie se ferme avec une preuve, ou reste OUVERTE.": "An anomaly closes with evidence, or stays OPEN.", "Requêtes": "Queries", "Requête": "Query", "Session": "Session", "Comparaison": "Comparison", "Trace": "Trace", "Fermer l'onglet": "Close tab", "Nouvel onglet": "New tab", "Vue partagée": "Shared view", "Toutes les sessions": "All sessions", "Nouvelle requête": "New query"};
let LANG = 'fr';
const t = s => LANG==='en' ? (EN[s] ?? s) : s;
const I = ({d,c='w-4 h-4'}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={c}><path d={d}/></svg>;
const ic = {
  search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35', x:'M18 6 6 18M6 6l12 12', plus:'M12 5v14M5 12h14',
  cols:'M4 5h16v14H4zM10 5v14M16 5v14', dl:'M12 4v11m0 0-4-4m4 4 4-4M5 20h14', lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  play:'M7 5l12 7-12 7z', star:'M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z', chev:'m6 9 6 6 6-6',
  lens:'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', pin:'M9 4h6l-1 6 4 3H6l4-3zM12 13v7',
  split:'M4 5h16v14H4zM12 5v14',
};
const Tag = ({i}) => <span className="inline-block font-mono text-[10.5px] font-semibold leading-none rounded-[3px] px-1.5 py-[3px]" style={{color:(IFC[i] || IFC.N2)[0],background:(IFC[i] || IFC.N2)[1]}}>{i}</span>;
const Res = ({r}) => <span className="inline-flex items-center gap-1.5"><span className={`w-[7px] h-[7px] rounded-full ${r==='Succès'||r==='success'?'bg-[#15803D]':r==='Échec'||r==='failed'?'bg-[#C2410C]':'bg-[#D4D4D4]'}`}/>{r}</span>;
const Stat = ({s}) => {
  const m = {'EXACT':'text-[#15803D] bg-[#ECF8F0] border-[#BFE5CC]','OUVERT':'text-[#A15C07] bg-[#FDF6E7] border-[#F1D9A8]','OUVERT':'text-[#B42318] bg-[#FDEFEE] border-[#F5C6C2]'}[s];
  return <span className={`inline-block text-[10.5px] font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px] ${m}`}>{s}</span>;
};
const Lbl = ({children}) => <div className="text-[11px] font-semibold text-[#666666] uppercase tracking-[0.06em] mb-1.5">{children}</div>;

function TopBarLive({metrics,demo,onOpen}) {
  const [pendingHistory,setPendingHistory] = useState([]);
  const lastSample = useRef(0);
  useEffect(()=>{
    if (demo) { lastSample.current=0; setPendingHistory([]); return; }
    const pending=metrics.data?.data?.pending_segments, sampledAt=metrics.dataUpdatedAt;
    if (!sampledAt || sampledAt===lastSample.current || typeof pending!=='number') return;
    lastSample.current=sampledAt;
    setPendingHistory(history=>[...history,pending].slice(-4));
  },[demo,metrics.dataUpdatedAt,metrics.data?.data?.pending_segments]);
  const data=metrics.data?.data;
  const indicator=topBarLiveIndicator({demo,apiReachable:!(metrics.isError||metrics.isRefetchError)&&!!data,captureState:data?.capture_state,pendingHistory});
  const sampledAt=metrics.dataUpdatedAt ? new Date(metrics.dataUpdatedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : '—';
  const title=`capture_state: ${available(data?.capture_state)}\nsegments ingérés: ${available(data?.segments_ingested)}\npending: ${available(data?.pending_segments)}\ndernier relevé: ${sampledAt}`;
  return <button type="button" onClick={onOpen} title={title} aria-label={`État capture : ${indicator.label}`} className="h-8 px-2 flex items-center gap-1.5 rounded-md hover:bg-[#F5F5F5] font-semibold text-[11.5px] tracking-wide" style={{color:indicator.color}}><span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${indicator.pulse?'polaris-live-pulse':''}`} style={{backgroundColor:indicator.color}}/><span>{indicator.label}</span></button>;
}

function TopBarVersion({version}) {
  const data=version.data?.data;
  const title=`backend_api: ${available(data?.backend_api)}\nsession_engine: ${available(data?.session_engine)}\ncorrelation_engine: ${available(data?.correlation_engine)}\nevent_schema: ${available(data?.event_schema)}\ndecoders: ${decoderVersions(data?.decoders)}`;
  return <div title={title} className="flex items-baseline gap-1.5 whitespace-nowrap"><span className="text-[14px] font-semibold tracking-tight text-[#171717]">POLARIS</span><span className="text-[11.5px] text-[#666666] font-mono">{available(data?.platform_core)} · UI {UI_VERSION}</span></div>;
}

function TopBar({role,page,setPage,onAnalyzer,accent,onSettings,metrics,version,demo}) {
  const [menu,setMenu] = useState(false);
  return (
    <header className="h-12 shrink-0 bg-white border-b border-[#EBEBEB] flex items-center px-4 gap-6">
      <div className="flex items-center gap-2">
        <div style={{background:accent}} className="w-6 h-6 rounded-[5px] grid place-items-center"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" fill="#fff"/></svg></div>
        <TopBarVersion version={version}/>
      </div>
      <nav className="flex h-full">
        {[['home','Accueil'],['templates','Dashboard'],['sessions','Analyzer'],['kpi','KPI'],['live','Live'],...(TRAFFIC_ENABLED ? [['trafic','Traffic']] : [])].map(([k,n]) => {
          const on = page===k, ok = ['home','sessions','nodes','templates','kpi','live','trafic'].includes(k);
          return <button key={k} type="button" onClick={()=>{ if(ok) { setPage(k); if((k==='sessions'||k==='templates') && onAnalyzer) onAnalyzer(); } }} className={`relative px-3 h-full flex items-center text-[13px] ${ok?'cursor-pointer':'cursor-default'} ${on?'text-[#171717] font-semibold':'text-[#666666] hover:text-[#171717]'}`}>{t(n)}{on && <span style={{background:accent}} className="absolute inset-x-3 bottom-0 h-[2px]"/>}</button>;
        })}
      </nav>
      <div className="ml-auto flex items-center gap-4 text-[12.5px]">
        <TopBarLive metrics={metrics} demo={demo} onOpen={()=>setPage('live')}/>
        <span className="text-[#666666]" aria-label="Rôle">{role || '—'}</span>
        <button type="button" title={t("Notifications")} className="w-8 h-8 rounded-md grid place-items-center text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717]"><I d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" c="w-4 h-4"/></button>
        <div className="relative">
          <button type="button" onClick={()=>setMenu(m=>!m)} title={t("Compte")} style={{background:accent}} className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold text-white hover:opacity-90">SD</button>
          {menu && <>
            <div className="fixed inset-0 z-40" onClick={()=>setMenu(false)}/>
            <div className="absolute right-0 top-9 z-50 w-48 bg-white border border-[#EBEBEB] rounded-md shadow-lg py-1 text-[13px]">
              <div className="px-3 py-2 border-b border-[#EBEBEB]"><div className="font-semibold text-[#171717]">SD</div><div className="text-[11.5px] text-[#8F8F8F]">{role}</div></div>
              <button type="button" onClick={()=>{setMenu(false);onSettings();}} className="w-full text-left px-3 py-2 hover:bg-[#FAFAFA] text-[#171717]">{t("Paramètres")}</button>
            </div></>}
        </div>
      </div>
    </header>
  );
}

function Tabs({tabs,active,home,onPick,onClose,onHome,onNew}) {
  return (
    <div className="h-10 shrink-0 bg-white border-b border-[#EBEBEB] flex items-end px-3 gap-px overflow-x-auto scroll-thin">
      <button onClick={onHome} title={t("Requêtes")} className={`shrink-0 h-8 px-3 flex items-center gap-1.5 text-[12.5px] rounded-t-md border border-b-0 ${home?'bg-white border-[#EBEBEB] text-[#171717] font-medium shadow-[inset_0_2px_0_var(--app-accent)]':'border-transparent text-[#666666] hover:text-[#171717] hover:bg-white/60'}`}><I d={ic.cols} c="w-3.5 h-3.5"/>{t("Requêtes")}</button>
      <span className="w-px h-4 bg-[#EBEBEB] mb-2 mx-1 shrink-0"/>
      {tabs.map(tb => (
        <div key={tb.id} onClick={()=>onPick(tb.id)} className={`group shrink-0 h-8 pl-3 pr-1.5 flex items-center gap-2 text-[12.5px] rounded-t-md border border-b-0 cursor-pointer max-w-[300px] ${tb.id===active?'bg-white border-[#EBEBEB] text-[#171717] shadow-[inset_0_2px_0_var(--app-accent)]':'border-transparent text-[#666666] hover:bg-white/60'}`}>
          {tb.live && <span className="w-[6px] h-[6px] rounded-full bg-[#15803D] shrink-0"/>}
          <span className="text-[11px] text-[#8F8F8F] shrink-0">{t(tb.k)}</span>
          <span className={`${tb.id===active?'font-medium':''} truncate`}>{tb.n}</span>{tb.dirty && <span title="Modifications non enregistrées" className="w-[7px] h-[7px] rounded-full bg-[#A15C07] shrink-0"/>}{tb.mode==='edit' && <span className="text-[10.5px] text-[#8F8F8F] shrink-0">édition</span>}
          <button onClick={e=>{e.stopPropagation(); onClose(tb.id);}} title={t("Fermer l'onglet")} aria-label={t("Fermer l'onglet")} className="w-5 h-5 shrink-0 grid place-items-center rounded text-[#8F8F8F] hover:text-[#B42318] hover:bg-[#F2F2F2]"><I d={ic.x} c="w-3 h-3"/></button>
        </div>
      ))}
      <button onClick={onNew} title={t("Nouvel onglet")} aria-label={t("Nouvel onglet")} className="shrink-0 h-8 w-8 grid place-items-center text-[#666666] hover:text-[#171717]"><I d={ic.plus}/></button>
      <button className="ml-auto mb-1 shrink-0 h-7 px-2 flex items-center gap-1.5 text-[12px] text-[#666666] hover:text-[#171717]"><I d={ic.split} c="w-3.5 h-3.5"/>{t("Vue partagée")}</button>
    </div>
  );
}

function QueryPanel({conds,setConds}) {
  const [tpl,setTpl] = useState('Parcourir');
  const [adding,setAdding] = useState(false);
  const [f,setF] = useState(FIELDS[0][0]);
  const [v,setV] = useState(FIELDS[0][1][0]);
  const vals = (FIELDS.find(x=>x[0]===f)||FIELDS[0])[1];
  return (
    <aside className="w-[264px] shrink-0 bg-white border-r border-[#EBEBEB] flex flex-col">
      <div className="p-4 space-y-5 overflow-auto scroll-thin flex-1">
        <div><Lbl>Gabarit</Lbl>
          <div className="grid grid-cols-4 rounded-md border border-[#EBEBEB] p-[2px] bg-[#FAFAFA]">
            {['Trace','Parcourir','Inspecter','Capture'].map(t => <button key={t} onClick={()=>setTpl(t)} className={`h-6 rounded-[4px] text-[11.5px] ${tpl===t?'bg-white text-[#171717] shadow-sm font-medium':'text-[#666666]'}`}>{t}</button>)}
          </div>
        </div>
        <div><Lbl>Portée</Lbl>
          <div className="h-8 rounded-md border border-[#EBEBEB] px-2.5 flex items-center text-[13px]">Run 5G #482<span className="ml-auto text-[#8F8F8F] font-mono text-[11.5px]">c41 → c43</span><I d={ic.chev} c="w-3.5 h-3.5 ml-1.5 text-[#8F8F8F]"/></div>
        </div>
        <div><Lbl>Conditions</Lbl>
          <div className="space-y-1.5">
            {conds.map((c,i) => (
              <div key={i} className="flex items-center h-8 rounded-md border border-[#EBEBEB] text-[12.5px] overflow-hidden">
                <span className="px-2 h-full flex items-center bg-[#FAFAFA] border-r border-[#EBEBEB] text-[#666666]">{c[0]}</span>
                <span className="px-2 text-[#8F8F8F]">=</span>
                <span className="flex-1 truncate font-medium">{c[1]}</span>
                <button onClick={()=>setConds(conds.filter((_,j)=>j!==i))} className="w-7 h-full grid place-items-center text-[#8F8F8F] hover:text-[#B42318]"><I d={ic.x} c="w-3.5 h-3.5"/></button>
              </div>
            ))}
            {adding ? (
              <div className="rounded-md border border-[#171717] p-2 space-y-1.5 bg-[#FAFAFA]">
                <select value={f} onChange={e=>{setF(e.target.value); setV(FIELDS.find(x=>x[0]===e.target.value)[1][0]);}} className="w-full h-7 rounded border border-[#EBEBEB] text-[12.5px] px-1.5 bg-white">{FIELDS.map(x=><option key={x[0]}>{x[0]}</option>)}</select>
                <select value={v} onChange={e=>setV(e.target.value)} className="w-full h-7 rounded border border-[#EBEBEB] text-[12.5px] px-1.5 bg-white">{vals.map(x=><option key={x}>{x}</option>)}</select>
                <div className="flex gap-1.5"><button onClick={()=>{setConds([...conds,[f,v]]); setAdding(false);}} className="flex-1 h-7 rounded bg-[var(--app-accent)] text-white text-[12px] font-medium">Ajouter</button><button onClick={()=>setAdding(false)} className="h-7 px-2 rounded border border-[#EBEBEB] text-[12px] bg-white">Annuler</button></div>
              </div>
            ) : <button onClick={()=>setAdding(true)} className="w-full h-8 rounded-md border border-dashed border-[#D4D4D4] text-[12.5px] text-[#666666] hover:border-[#171717] hover:text-[#171717] flex items-center justify-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter une condition</button>}
            <div className="flex items-center gap-1.5 pt-1 text-[11.5px] text-[#8F8F8F]"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator uniquement</div>
          </div>
        </div>
        <div><Lbl>Regrouper par</Lbl>
          <div className="h-8 rounded-md border border-[#EBEBEB] px-2.5 flex items-center text-[13px] text-[#8F8F8F]">Aucun<I d={ic.chev} c="w-3.5 h-3.5 ml-auto"/></div>
        </div>
        <button className="w-full h-8 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center justify-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter</button>
        <div className="border-t border-[#F2F2F2] pt-4"><Lbl>Requêtes enregistrées</Lbl>
          {['Échecs · run 482','PDU Session 5G · toutes causes','Attach LTE · certification','Liens à prouver SBI'].map((q,k) => (
            <div key={q} className="flex items-center gap-2 h-7 px-1 rounded text-[12.5px] text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.star} c={`w-3.5 h-3.5 ${k<2?'text-[#A15C07]':'text-[#D4D4D4]'}`}/>{q}</div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Grid({rows,sel,setSel,role,conds,setConds,onEdit,height}) {
  const { demo } = usePolarisMode(); const sessions = useSessions({ page:1, page_size:100, sort:'capture_id', order:'asc' },false);
  const [more,setMore] = useState(false);
  const [txt,setTxt] = useState('');
  const ko = rows.filter(r=>r.res==='Échec').length;
  const cols = ['capture · seq','UE','RAT','Procédure','Résultat','Cause','Interfaces','Liens EXACT','Compl.','Durée','Cellule','IMSI'];
  return (
    <section className="flex flex-col min-h-0 bg-white shrink-0 rounded-xl border border-[#EBEBEB] overflow-hidden" style={{height}}>
      <div className="h-11 shrink-0 flex items-center gap-3 px-3 border-b border-[#EBEBEB]">
        <div className="flex-1 h-8 rounded-md border border-[#EBEBEB] flex items-center gap-1.5 px-2 focus-within:border-[var(--app-accent)]">
          <I d={ic.search} c="w-[15px] h-[15px] text-[#8F8F8F]"/>
          {conds.map((c,i) => <span key={i} className="flex items-center gap-1 h-6 rounded-[4px] bg-[#F2F2F2] border border-[#E5E5E5] pl-1.5 pr-1 text-[12px] text-[#171717] whitespace-nowrap"><span className="text-[#8F8F8F]">{c[0]}</span>{c[1]}<button onClick={()=>setConds(conds.filter((_,j)=>j!==i))}><I d={ic.x} c="w-3 h-3"/></button></span>)}
          <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&txt){ const f=FIELDS.find(x=>x[1].some(v=>v.toLowerCase()===txt.toLowerCase())); if(f){ setConds([...conds,[f[0],f[1].find(v=>v.toLowerCase()===txt.toLowerCase())]]); setTxt(''); } } }}
            placeholder="Filtrer : tape Échec, LTE, N4, 5GSM #27… puis Entrée" className="flex-1 min-w-[160px] outline-none text-[13px] placeholder:text-[#8F8F8F]"/>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[#666666]">
          <span className="font-semibold text-[#171717] tabular-nums">{demo || sessions.data ? rows.length : '—'}</span> sessions
          <div className="w-16 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden flex"><div className="bg-[#15803D]" style={{width:`${rows.length?(rows.length-ko)/rows.length*100:0}%`}}/><div className="bg-[#C2410C]" style={{width:`${rows.length?ko/rows.length*100:0}%`}}/></div>
          <span className="tabular-nums">{demo || sessions.data ? ko : '—'} échecs</span>
        </div>
        <button onClick={onEdit} className="h-8 px-2.5 rounded-md border border-[#EBEBEB] text-[12.5px] flex items-center gap-1.5 text-[#4D4D4D] hover:bg-[#FAFAFA]"><I d={ic.search} c="w-3.5 h-3.5"/>Modifier la requête</button>
        <div className="relative">
          <button onClick={()=>setMore(m=>!m)} title="Plus d'actions" className="h-8 w-8 rounded-md border border-[#EBEBEB] grid place-items-center text-[#4D4D4D] hover:bg-[#FAFAFA]">⋯</button>
          {more && <><div className="fixed inset-0 z-30" onClick={()=>setMore(false)}/><div className="absolute right-0 top-9 z-40 w-44 bg-white border border-[#EBEBEB] rounded-lg shadow-lg py-1 text-[13px]">
            <button onClick={()=>setMore(false)} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-[#FAFAFA]"><I d={ic.cols} c="w-3.5 h-3.5 text-[#666666]"/>Colonnes</button>
            <button onClick={()=>setMore(false)} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-[#FAFAFA]"><I d={ic.dl} c="w-3.5 h-3.5 text-[#666666]"/>Exporter</button>
          </div></>}
        </div>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full text-[12.5px] whitespace-nowrap border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>{cols.map((c,k) => <th key={c} className="h-8 px-3 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{c==='IMSI' ? <span className="inline-flex items-center gap-1"><I d={ic.lock} c="w-3 h-3"/>IMSI</span> : c}{k===0 && <span className="ml-1 text-[#171717]">↑</span>}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,rowIndex) => {
              const on = sel===r.id;
              const clickable = r.id != null;
              return (
                <tr key={r.id ?? `missing-session-${rowIndex}`} onClick={()=>{if(clickable)setSel(r.id);}} aria-disabled={!clickable} className={`${clickable?'cursor-pointer':'cursor-default opacity-70'} ${on?'bg-[color-mix(in_oklab,var(--app-accent)_8%,white)]':clickable?'hover:bg-[#FAFAFA]':''}`}>
                  <td className={`h-8 px-3 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666] ${on?'shadow-[inset_3px_0_0_var(--app-accent)]':''}`}>{clickable?`c${r.cap} · ${r.seq}`:'identifiant absent'}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px] text-[#171717]">{r.ue}</td>
                  <td className="px-3 border-b border-[#F2F2F2]">{r.rat}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#171717]">{r.proc}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><Res r={r.res}/></td>
                  <td className={`px-3 border-b border-[#F2F2F2] ${r.res==='Échec'?'text-[#B42318]':'text-[#666666]'}`}>{r.cause || '—'}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><span className="flex gap-1">{[...new Set(r.interfaces ?? [])].map(i=><Tag key={i} i={i}/>)}</span></td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px]">{r.ex}</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums">{r.comp==='—'?'—':`${r.comp} %`}</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums text-[#666666]">{r.dur}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#666666]">{r.cell}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[11.5px]">{<span className="text-[#D4D4D4]">masqué</span>}</td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-[#666666]">{demo || sessions.data ? 'Aucune session' : 'POLARIS non connecté'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const demoMessageNumber = (d,k) => d.evidence ? null : k+1;
const isCause = m => !!(m && m[4] && /^cause|code|result/i.test(m[4]));
function useWidth() {
  const ref = useRef(null); const [w,setW] = useState(900);
  useEffect(()=>{ if(!ref.current) return; const ro = new ResizeObserver(e=>setW(Math.floor(e[0].contentRect.width))); ro.observe(ref.current); return ()=>ro.disconnect(); },[]);
  return [ref,w];
}
function Ladder({d,sel,setSel,lens,hidden,collapsed,width}) {
  const W = Math.max(720, width), LG = 170, n = Math.max(2,d.nodes.length), ROW = 30, TOP = 46;
  const x = k => LG + 50 + k*((W-LG-110)/(n-1));
  const inCollapsed = k => d.procs.some(p=>collapsed.includes(p[0]) && k>=p[1] && k<=p[2]);
  const vis = d.msgs.map((m,k)=>k).filter(k=>!hidden.includes(d.msgs[k][0]) && !inCollapsed(k));
  const H = TOP + Math.max(1,vis.length)*ROW + 16;
  const lensCause = lens && d.msgs.some(m=>m[5]===lens && isCause(m));
  return (
    <svg width={W} height={H} className="block select-none">
      {d.nodes.map((nd,k) => <g key={nd}><line x1={x(k)} x2={x(k)} y1="34" y2={H} stroke="#EDEDED" strokeDasharray="0"/><rect x={x(k)-48} y="8" width="96" height="24" rx="6" fill="#fff" stroke="#E5E5E5"/><text x={x(k)} y="24" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#171717">{nd}</text></g>)}
      {vis.length===0 && <text x={W/2} y={TOP+20} textAnchor="middle" fontSize="12" fill="#8F8F8F">Aucun message visible — réaffiche une interface ou déplie une procédure.</text>}
      {vis.map((k,row) => {
        const m = d.msgs[k];
        const [a,b] = m[2].split(' → ').map(s=>nodeIdx(d.nodes,s));
        const y = TOP + row*ROW + 18, x1 = x(a), x2 = x(b), dir = x2>x1?1:-1, c = (IFC[m[0]] || IFC.N2)[0];
        const on = sel===k, lit = lens && m[5]===lens, cause = isCause(m);
        const full = m[1] + (m[3] ? '  ·  '+m[3] : '');
        const maxc = Math.max(8, Math.floor((Math.abs(x2-x1)-14)/6.1));
        const label = full.length>maxc ? full.slice(0,maxc-1)+'…' : full;
        const pstart = d.procs.find(p=>p[1]===k);
        return (
          <g key={k} onClick={()=>setSel(k)} className="cursor-pointer">
            <title>{`${k+1}. ${m[0]} · ${full} · ${m[2]}${m[4]?` · ${m[4]} ${m[5]}`:''}`}</title>
            <rect x="0" y={y-18} width={W} height={ROW} fill={on?'color-mix(in oklab, var(--app-accent) 9%, white)':lit?(lensCause?'#FDEFEE':'#FDF6E7'):'transparent'}/>
            {on && <rect x="0" y={y-18} width="3" height={ROW} fill="var(--app-accent)"/>}
            <text x="16" y={y+4} fontSize="10.5" fill="#A3A3A3" fontFamily="Geist Mono">{String(k+1).padStart(2,'0')}</text>
            {pstart && <text x="44" y={y+4} fontSize="11" fill="#4D4D4D" fontWeight="600">{pstart[0]}</text>}
            <line x1={x1} x2={x2 - dir*7} y1={y} y2={y} stroke={c} strokeWidth={on?1.75:1.1}/>
            <path d={`M${x2},${y} l${-dir*7},-3.5 l0,7 z`} fill={c}/>
            <text x={Math.min(x1,x2)+7} y={y-5} fontSize="11.5" fill={on?'#171717':'#333'} fontWeight={on?600:450}>{label}</text>
            {cause && <g><rect x={Math.max(x1,x2)+8} y={y-9} width={(m[5].length+7)*6.4} height="17" rx="4" fill="#FDEFEE" stroke="#F5C6C2"/><text x={Math.max(x1,x2)+14} y={y+3} fontSize="10.5" fill="#B42318" fontWeight="600">{m[4].replace(/^cause /,'')} {m[5]}</text></g>}
          </g>
        );
      })}
    </svg>
  );
}

function Detail({s,sel,setSel,lens,ui}) {
  const { demo } = usePolarisMode(); const auth = useAuthMe();
  const [tab,setTab] = useState('Ladder');
  const [hidden,setHidden] = useState([]);
  const [collapsed,setCollapsed] = useState([]);
  const [ref,width] = useWidth();
  useEffect(()=>{ setHidden([]); setCollapsed([]); },[s.id]);
  const ifs = [...new Set(s.d.msgs.map(m=>m[0]))];
  const step = dir => { const n=s.d.msgs.length; let k=sel; for(let i=0;i<n;i++){ k=(k+dir+n)%n; if(!hidden.includes(s.d.msgs[k][0])) break; } setSel(k); };
  useEffect(()=>{ const f=e=>{ if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return; if(e.key==='ArrowDown'||e.key==='j'){e.preventDefault();step(1);} if(e.key==='ArrowUp'||e.key==='k'){e.preventDefault();step(-1);} if(e.key==='f'&&tab==='Ladder') ui.setFull(v=>!v); if(e.key==='Escape') ui.setFull(false); }; window.addEventListener('keydown',f); return ()=>window.removeEventListener('keydown',f); });
  const tb = "h-7 px-2 rounded-md text-[12px] flex items-center gap-1.5 border transition";
  const d = s.d, ex = d.links.filter(l=>l[5]==='EXACT').length;
  return (
    <section className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-[#EBEBEB]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[#666666]">c{s.cap} · {s.seq}</span>
          <span className="text-[14px] font-semibold text-[#171717]">{s.proc}</span>
          <span className="font-mono text-[12.5px] text-[#4D4D4D]">{s.ue}</span>
          <Res r={s.res}/>
          <span className="ml-auto flex items-center gap-4 text-[12px] text-[#666666]"><span><b className="text-[#171717] tabular-nums">{demo || d.msgs.length ? d.msgs.length : '—'}</b> messages</span><span><b className="text-[#171717] tabular-nums">{demo || d.links.length ? `${ex}/${d.links.length}` : '—'}</b> liens EXACT</span><span><b className="text-[#171717] tabular-nums">{s.comp==='—'?'—':`${s.comp} %`}</b> complétude</span></span>
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#4D4D4D]">{d.summary}{d.diverge && <span className="ml-2 text-[#B42318]">{d.diverge}</span>}</div>
        {s.detailErrors?.map(error => <div key={error.endpoint} role="alert" className="mt-1.5 text-[12px] text-[#B42318]">Détail indisponible · {error.endpoint} · HTTP {error.status}</div>)}
        <div className="flex gap-5 mt-2 -mb-2">
          {['Ladder','Messages','Corrélation','Plan usager','Comparer'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-8 text-[12.5px] border-b-2 ${tab===t?'border-[var(--app-accent)] text-[#171717] font-medium':'border-transparent text-[#666666] hover:text-[#171717]'}`}>{t}</button>)}
        </div>
      </div>
      {tab==='Ladder' && <div className="h-10 shrink-0 px-3 flex items-center gap-1.5 border-b border-[#F2F2F2] overflow-x-auto scroll-thin">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8F8F8F] mr-1">Interfaces</span>
        {ifs.map(i=>{const off=hidden.includes(i); return <button key={i} onClick={()=>setHidden(off?hidden.filter(x=>x!==i):[...hidden,i])} title={off?'Afficher':'Masquer'} className={`h-6 px-1 rounded-md border transition ${off?'opacity-35 border-transparent':'border-[#EBEBEB] bg-white'}`}><Tag i={i}/></button>;})}
        <span className="w-px h-4 bg-[#EBEBEB] mx-2"/>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8F8F8F] mr-1">Procédures</span>
        {d.procs.map(([p,a,b])=>{const c=collapsed.includes(p); return <button key={p} onClick={()=>setCollapsed(c?collapsed.filter(x=>x!==p):[...collapsed,p])} className={`${tb} ${c?'border-[#EBEBEB] bg-[#FAFAFA] text-[#8F8F8F]':'border-[#EBEBEB] bg-white text-[#171717]'}`}><span className="text-[10px]">{c?'▸':'▾'}</span>{p}<span className="text-[#A3A3A3] tabular-nums">{b-a+1}</span></button>;})}
        <div className="ml-auto flex items-center gap-1 shrink-0"><button disabled={demo} onClick={()=>{window.location.href=apiPath(`/exports/callflow/${encodeURIComponent(s.id)}`);}} className={tb+" border-[#EBEBEB]"}>Exporter</button>{auth.data?.data?.role==='operator' && <button disabled={demo || s.cap==='—'} onClick={()=>{if(window.confirm('Télécharger cet extrait pcap ?')) window.location.href=apiPath(`/captures/${encodeURIComponent(s.cap)}/download`);}} className={tb+" border-[#EBEBEB]"}>PCAP</button>}
          <button onClick={()=>step(-1)} title="Message précédent (↑)" className={`${tb} border-[#EBEBEB] text-[#4D4D4D] hover:bg-[#FAFAFA]`}>↑</button>
          <button onClick={()=>step(1)} title="Message suivant (↓)" className={`${tb} border-[#EBEBEB] text-[#4D4D4D] hover:bg-[#FAFAFA]`}>↓</button>
          {!ui.full && <button onClick={()=>ui.setGridHidden(v=>!v)} className={`${tb} border-[#EBEBEB] text-[#4D4D4D] hover:bg-[#FAFAFA]`}>{ui.gridHidden?'Afficher le tableau':'Masquer le tableau'}</button>}
          <button onClick={()=>ui.setFull(v=>!v)} title="Plein écran (F)" className={`${tb} ${ui.full?'border-transparent bg-[var(--app-accent)] text-white':'border-[#EBEBEB] text-[#4D4D4D] hover:bg-[#FAFAFA]'}`}><I d={ui.full?'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5':'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} c="w-3.5 h-3.5"/>{ui.full?'Quitter':'Plein écran'}</button>
        </div>
      </div>}
      <div ref={ref} className="flex-1 overflow-auto scroll-thin">
        {tab==='Ladder' && <Ladder d={d} sel={sel} setSel={setSel} lens={lens} hidden={hidden} collapsed={collapsed} width={width}/>}
        {tab==='Messages' && <table className="w-full text-[12.5px]"><tbody>{d.msgs.map((m,k)=>(
          <tr key={k} onClick={()=>setSel(k)} className={`cursor-pointer ${sel===k?'bg-[color-mix(in_oklab,var(--app-accent)_9%,white)]':'hover:bg-[#FAFAFA]'}`}>
            <td className="h-7 px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#8F8F8F] w-12">{available(d.evidence?.[k]?.seq ?? (demoMessageNumber(d,k)))}</td><td className="px-2 border-b border-[#F2F2F2] w-20"><Tag i={m[0]}/></td>
            <td className="px-2 border-b border-[#F2F2F2]">{m[1]}{m[3]&&<span className="text-[#666666]"> · {m[3]}</span>}</td><td className="px-2 border-b border-[#F2F2F2] text-[#666666]">{m[2]}</td>
            <td className="px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666]">{m[4]?`${m[4]} ${m[5]}`:''}</td></tr>))}</tbody></table>}
        {tab==='Corrélation' && <table className="w-full text-[12.5px]"><thead><tr>{['De','Vers','Clé','Messages','Statut'].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{h}</th>)}</tr></thead><tbody>{d.links.map((l,k)=>(
          <tr key={k}><td className="h-8 px-4 border-b border-[#F2F2F2]"><Tag i={l[2]}/></td><td className="px-4 border-b border-[#F2F2F2]"><Tag i={l[3]}/></td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px]">{l[4]}</td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px] text-[#666666]">{l[0]===null?'—':l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun'}</td><td className="px-4 border-b border-[#F2F2F2]"><Stat s={l[5]}/></td></tr>))}</tbody></table>}
        {(tab==='Plan usager'||tab==='Comparer') && <div className="p-8 text-[13px] text-[#666666]">{tab==='Plan usager' ? 'Volumes UL / DL par TEID, comparés aux règles N4 et aux rapports d’usage PFCP.' : 'Choisis une session réussie de même procédure pour aligner les deux flux et voir le point de bifurcation.'}</div>}
      </div>
    </section>
  );
}

function Inspector({s,sel,role,lens,setLens,width,onHide}) {
  const [tab,setTab] = useState(()=>{ try { return localStorage.getItem('polaris-insp-tab')||'Décodage'; } catch(e) { return 'Décodage'; } });
  useEffect(()=>{ try { localStorage.setItem('polaris-insp-tab',tab); } catch(e) {} },[tab]);
  const d = s.d, m = d.msgs[Math.min(sel,d.msgs.length-1)];
  const evidence = d.evidence?.[Math.min(sel,d.msgs.length-1)];
  const eventQuery = useEvent(evidence?.event_id ?? evidence?.id); const provenance = useProvenance(evidence?.event_id ?? evidence?.id); const packets = usePackets({capture_id:provenance.data?.data?.capture_id,packet_number:provenance.data?.data?.packet_number}, provenance.data?.data?.capture_id!=null && provenance.data?.data?.packet_number!=null); const rules = useCorrelationRules(); const versions = useVersion();
  const proof = provenance.data?.data ?? evidence ?? {};
  if (!m) return <aside className="p-4 text-[#666666]">Non disponible</aside>;
  const shared = m[5] ? d.msgs.filter(x=>x[5]===m[5]).length : 0;
  return (
    <aside style={{width}} className="shrink-0 bg-white flex flex-col min-w-0 rounded-xl border border-[#EBEBEB] overflow-hidden">
      <div className="h-10 shrink-0 flex items-end gap-5 px-4 border-b border-[#EBEBEB]">
        {['Décodage','Preuves','Hex','Identité'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-9 text-[12.5px] border-b-2 ${tab===t?'border-[var(--app-accent)] text-[#171717] font-medium':'border-transparent text-[#666666] hover:text-[#171717]'}`}>{t}</button>)}
        <button onClick={onHide} title="Masquer le panneau" className="ml-auto mb-2 w-7 h-7 rounded-md grid place-items-center text-[#8F8F8F] hover:bg-[#F5F5F5] hover:text-[#171717]"><I d="M15 4v16M4 4h16v16H4z" c="w-3.5 h-3.5"/></button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-4 text-[12.5px]">
        {tab==='Décodage' && <div className="space-y-4">
          <div><div className="flex items-center gap-2"><Tag i={m[0]}/><span className="font-mono text-[11.5px] text-[#8F8F8F]">message {Math.min(sel,d.msgs.length-1)+1}</span></div>
            <div className="mt-1.5 text-[14px] font-semibold text-[#171717] leading-snug">{m[1]}</div><div className="text-[#666666]">{m[2]}</div></div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 font-mono text-[11.5px]">
            <dt className="text-[#8F8F8F]">capture_id</dt><dd>{available(proof.capture_id)}</dd><dt className="text-[#8F8F8F]">seq</dt><dd>{available(proof.seq)}</dd>
            <dt className="text-[#8F8F8F]">packet_number</dt><dd>{available(proof.packet_number)}</dd><dt className="text-[#8F8F8F]">décodeurs</dt><dd>{decoderVersions(versions.data?.data?.decoders)}</dd>
          </dl>
          {eventQuery.data && <pre className="text-[11.5px] whitespace-pre-wrap">{JSON.stringify(eventQuery.data.data?.decoded_ie_tree ?? {},null,2)}</pre>}
          {eventQuery.isError && <div>{eventQuery.error.message}</div>}
          <div className="rounded-md border border-[#EBEBEB] bg-[#FAFAFA] p-3 font-mono text-[11.5px] leading-[1.9] text-[#4D4D4D]">
            <div>▾ {m[1].split(' ')[0]} PDU</div>
            <div className="pl-4">▾ {m[1].split(' ').slice(1).join(' ')}</div>
            <div className="pl-8">ue : <span className="text-[#171717]">{s.ue}</span> <span className="text-[#8F8F8F]">(pseudonyme)</span></div>
            {m[3] && <><div className="pl-8">▾ NAS-PDU</div><div className="pl-12">message : <span className="text-[#171717]">{m[3]}</span></div>
              <div className="pl-12">identité : {<span className="text-[#8F8F8F]">masquée</span>}</div></>}
            {m[4] && <div className="pl-8">{m[4]} : <span className="text-[#A15C07]">{m[5]}</span></div>}
          </div>
          {m[5] && (isCause(m) ? <div className="rounded-md border border-[#F5C6C2] bg-[#FFFBFA] p-3">
            <div className="flex items-center gap-2 font-medium text-[#B42318]"><I d="M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" c="w-4 h-4"/>Lentille de cause</div>
            <div className="text-[#666666] mt-1"><span className="font-mono text-[#B42318]">{m[4].replace(/^cause /,'')} {m[5]}</span> — cause d'échec, pas une clé de corrélation. Présente dans {shared} message(s).</div>
            <button onClick={()=>setLens(lens===m[5]?null:m[5])} className={`mt-2 h-7 px-3 rounded-md text-[12px] font-medium ${lens===m[5]?'border border-[#EBEBEB] text-[#4D4D4D]':'bg-[#B42318] text-white'}`}>{lens===m[5]?'Retirer le surlignage':'Surligner la cause'}</button>
          </div> : <div className="rounded-md border border-[#EBEBEB] p-3">
            <div className="flex items-center gap-2 font-medium text-[#171717]"><I d={ic.lens} c="w-4 h-4"/>Lentille de clé</div>
            <div className="text-[#666666] mt-1"><span className="font-mono text-[11.5px] text-[#8F8F8F]">{m[4]}</span> <span className="font-mono text-[#A15C07]">{m[5]}</span> apparaît dans {shared} message(s) de la session.</div>
            <button onClick={()=>setLens(lens===m[5]?null:m[5])} className={`mt-2 h-7 px-3 rounded-md text-[12px] font-medium ${lens===m[5]?'border border-[#EBEBEB] text-[#4D4D4D]':'bg-[var(--app-accent)] text-white'}`}>{lens===m[5]?'Retirer le surlignage':'Surligner dans la session'}</button>
          </div>)}
        </div>}
        {tab==='Preuves' && <div className="space-y-2"><div>event_id : {available(proof.event_id ?? evidence?.id)} · seq : {available(proof.seq)}</div>{provenance.isError && <div>{provenance.error.message}</div>}{packets.data && <div>Paquets : {records(packets.data.data,'packets').length}</div>}<div>Règles : {rules.isError ? rules.error.message : JSON.stringify(rules.data?.data ?? [])}</div>{d.links.map((l,k)=>(
          <div key={k} className="rounded-md border border-[#EBEBEB] p-3"><div className="flex items-center gap-2"><Tag i={l[2]}/><span className="text-[#8F8F8F]">→</span><Tag i={l[3]}/><span className="ml-auto"><Stat s={l[5]}/></span></div>
          <div className="font-mono text-[11.5px] mt-2 text-[#4D4D4D]">{l[4]}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">messages {l[0]===null?'—':l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun message N4'} · matched_rules : {JSON.stringify(l[6] ?? [])}</div></div>))}</div>}
        {tab==='Hex' && <div>Non disponible : backend à venir (octets masqués)</div>}
        {tab==='Identité' && <div><Lbl>Pseudonyme</Lbl><span className="font-mono">{s.ue}</span><div>Identités masquées</div></div>}
      </div>
    </aside>
  );
}


/* ------------------------------ ACCUEIL ------------------------------ */
const IFACES = ['N2','N3','N4','SBI','N6','S1-MME','S1-U','S5-U','S11','S5-C','S6a','Sxa/Sxb'];
const Dot = ({st}) => <span className={`w-[8px] h-[8px] rounded-full ${st==='ok'?'bg-[#15803D]':st==='warn'?'bg-[#D97706]':st==='error'?'bg-[#B42318]':'bg-[#D4D4D4]'}`}/>;
const Bar = ({v,warn=70,crit=85}) => <div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden"><div className={`h-full ${v>=crit?'bg-[#B42318]':v>=warn?'bg-[#D97706]':'bg-[var(--app-accent)]'}`} style={{width:`${v}%`}}/></div><span className="tabular-nums text-[12px] text-[#4D4D4D] w-9">{v} %</span></div>;
const Card = ({title,action,children,className=''}) => (
  <section className={`bg-white rounded-lg border border-[#EBEBEB] ${className}`}>
    <div className="h-11 px-4 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{title}</h3>{action && <span className="ml-auto text-[12px] text-[#171717] font-medium cursor-pointer">{action}</span>}</div>
    {children}
  </section>
);

const HOME_ACTIONS = [
  ['tpl','Ouvrir un template','M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z','templates'],
  ['run','Explorer un run','M4 6h16M4 12h16M4 18h10','sessions'],
  ['live','Trace live','M3 12h4l3-8 4 16 3-8h4','live'],
];
const MODULES = [
  ['POLARIS Analyzer','Requêtes, ladder et corrélation des sessions 4G/5G.','M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35','sessions'],
  ['Polaris Monitor','Indicateurs par procédure et détection d\'écarts.','M4 20V10M10 20V4M16 20v-7M22 20H2','kpi'],
  ['Polaris Live','Suivi en temps réel des sessions capturées.','M3 12h4l3-8 4 16 3-8h4','live'],
  ['Traffic','Débit, santé TCP, applications, congestion','M4 7h16M4 12h16M4 17h16','trafic'],
  ['Polaris Nodes','Topologie et état des nœuds du réseau.','M12 5v4M5 19l4-5M19 19l-4-5M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM4 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM20 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z','nodes',true],
];
const Soon = () => <span className="text-[10.5px] font-medium text-[#8F8F8F] border border-[#EBEBEB] rounded px-1.5 py-[1px]">{t("Bientôt")}</span>;

function Home({setPage,onNew}) {
  const { demo } = usePolarisMode();
  const health = useHealth(), metrics = useMetrics(), safety = useStorageSafety();
  const m = metrics.data?.data, h = health.data?.data;

  const go = t => t && setPage(t);
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-white">
      <div className="polaris-content-shell px-8 pt-14 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-[#171717]">{t("Bienvenue sur POLARIS")}</h1>
            <p className="mt-2 text-[15px] text-[#666666]">{t("Analyse, diagnostic et supervision des sessions et du trafic réseau.")}</p>
          </div>
          <button onClick={()=>onNew?onNew():setPage('sessions')} className="h-10 px-5 rounded-lg bg-[var(--app-accent)] text-white text-[14px] font-medium flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:opacity-90 transition"><I d={ic.plus} c="w-4 h-4"/>{t("Nouvelle analyse")}</button>
        </header>
        <div className="mt-6 flex flex-wrap gap-2">
          {HOME_ACTIONS.map(([k,n,d,tg])=>(
            <button key={k} disabled={!tg} onClick={()=>go(tg)} className="h-9 px-3.5 rounded-lg border border-[#EBEBEB] bg-white text-[13.5px] text-[#171717] flex items-center gap-2 hover:border-[#D4D4D4] hover:bg-[#FAFAFA] transition disabled:text-[#A3A3A3] disabled:hover:bg-white disabled:cursor-not-allowed">
              <I d={d} c="w-4 h-4 text-[#666666]"/>{t(n)}{!tg && <Soon/>}</button>))}
        </div>

        <section className="mt-14">
          <h2 className="text-[13px] font-semibold text-[#171717] mb-4">{t("Modules")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.filter(x=>x[3]!=='trafic'||TRAFFIC_ENABLED).map(([n,desc,d,tg,adm])=>(
              <button key={n} disabled={!tg} onClick={()=>go(tg)} className="group text-left h-full rounded-xl border border-[#EBEBEB] bg-white p-4 flex flex-col transition hover:border-[#D4D4D4] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:border-[#EBEBEB]">
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${tg?'bg-[var(--app-accent)] text-white':'bg-[#F2F2F2] text-[#8F8F8F]'}`}><I d={d} c="w-4 h-4"/></span>
                <span className={`mt-4 text-[14px] font-semibold flex items-center gap-1.5 flex-wrap ${tg?'text-[#171717]':'text-[#666666]'}`}>{t(n)}{adm && <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-[1px] bg-[var(--app-accent)] text-white">{t("Administrateur")}</span>}</span>
                <span className="mt-1 text-[12.5px] leading-[1.45] text-[#666666] flex-1">{t(desc)}</span>
                <span className="mt-4 text-[12.5px] font-medium flex items-center gap-1">{tg ? <span className="text-[#171717] group-hover:translate-x-0.5 transition">{t("Ouvrir →")}</span> : <Soon/>}</span>
              </button>))}
          </div>
        </section>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10">
          <section>
            <div className="flex items-center mb-4"><h2 className="text-[13px] font-semibold text-[#171717]">{t("Activité récente")}</h2><button disabled className="ml-auto text-[12.5px] text-[#A3A3A3] cursor-not-allowed">{t("Voir tout")}</button></div>
            <div className="rounded-xl border border-[#EBEBEB] bg-white divide-y divide-[#F2F2F2]">
              {(demo ? [['Analyse','Run 5G #482 · Registration','il y a 3 min','sessions'],['KPI','Succès PDU Session · 15 min','il y a 12 min','kpi'],['Template','Échecs Attach par cellule','il y a 40 min','templates'],['Analyse','Run 4G #219 · E-RAB Setup','il y a 2 h','sessions']] : []).map(([ty,n,w,tg])=>(
                <button key={n} onClick={()=>setPage(tg)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FAFAFA]"><span className="text-[11px] font-medium text-[#666666] bg-[#F5F5F5] rounded px-1.5 py-[1px] w-16 text-center">{t(ty)}</span><span className="text-[13px] text-[#171717] truncate">{n}</span><span className="ml-auto text-[12px] text-[#8F8F8F] shrink-0">{t(w)}</span></button>))}
            </div>
            <div className={demo ? "hidden" : "py-6 text-center"}>
              <div className="mx-auto w-9 h-9 rounded-full bg-[#F5F5F5] grid place-items-center text-[#8F8F8F]"><I d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" c="w-4 h-4"/></div>
              <div className="mt-3 text-[14px] font-medium text-[#171717]">{t("Aucune activité pour l'instant")}</div>
              <div className="mt-1 text-[13px] text-[#666666]">{t("Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.")}</div>
              <button onClick={()=>onNew?onNew():setPage('sessions')} className="mt-4 text-[13px] font-medium text-[#171717] hover:underline">{t("Lancer une analyse →")}</button>
            </div>
          </section>
          <section>
            <div className="flex items-center mb-4"><h2 className="text-[13px] font-semibold text-[#171717]">{t("État de la plateforme")}</h2><button onClick={()=>setPage('nodes')} className="ml-auto text-[12.5px] font-medium text-[#171717] hover:underline">{t("Voir la supervision")}</button></div>
            <div className="rounded-xl border border-[#EBEBEB] divide-y divide-[#F2F2F2]">
              {[['Capture','État de capture',available(m?.capture_state ?? h?.capture_state),'var(--muted-foreground)'],['Segments en attente','À importer',available(m?.pending_segments),'var(--muted-foreground)'],['Échecs ingestion','Import',available(m?.ingestion_failures),'var(--muted-foreground)'],['Segments ingérés','Importés',available(m?.segments_ingested),'var(--muted-foreground)'],['Segments ouverts','Capture en cours',available(m?.open_segments),'var(--muted-foreground)'],['Segments sans événement','Décodage',available(m?.zero_event_segments),'var(--muted-foreground)'],['Disque disponible','Stockage',available(safety.data?.data?.free_percent),'var(--muted-foreground)']].map(([n,d,v,c])=>(
                <div key={n} className="px-4 py-3.5 flex items-center gap-3">
                  <span className="w-[7px] h-[7px] rounded-full" style={{background:c}}/>
                  <div className="min-w-0"><div className="text-[13.5px] text-[#171717]">{t(n)}</div><div className="text-[12px] text-[#8F8F8F]">{t(d)}</div></div>
                  <span title={`event_id=${available(m?.event_id)} · seq=${available(m?.seq)}`} className="ml-auto text-[13px] font-medium tabular-nums text-[#171717]">{v}</span>
                </div>))}
            </div>
            <p className="mt-3 text-[12px] text-[#A15C00]">{t(demo ? 'Données de démo' : health.isError ? health.error.message : 'POLARIS')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Nodes() {
  const [node,setNode] = useState(null);
  const { demo } = usePolarisMode(); const probes = useProbes(); const auth = useAuthMe(); const health = useHealth();
  const raw = records(probes.data?.data, 'probes');
  const nodes = raw.map((n,i)=>demo ? n : toLegacyProbe(n,i));
  const current = nodes.find(n=>n.n===node);
  const resources = useProbeResources(current?.id);
  const metrics = useMetrics(); const safety = useStorageSafety();
  const [target,setTarget] = useState(''); const [actionError,setActionError] = useState('');
  const capture = useCaptureAction(auth.data?.data?.role, health.data?.data?.coordination_open);
  const doCapture = (action,id) => { if (!window.confirm('Confirmer cette action de capture ?')) return; capture.mutate({action,id,target,confirmed:true},{onError:e=>setActionError(e.message)}); };

  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="polaris-content-shell px-8 py-7 space-y-5">
        <div className="flex items-end gap-6">
          <div><div className="text-[12px] text-[#666666]">POLARIS Nœuds</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">Gestion des nœuds</h1>
            <div className="text-[13px] text-[#666666] mt-1">{probes.isError ? probes.error.message : `${nodes.length} nœuds · POLARIS`}</div></div>
          <div className="ml-auto flex gap-2">
            <button disabled title="Non disponible : backend à venir" className="h-9 px-4 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.plus} c="w-4 h-4"/>Ajouter un nœud</button>
            <button disabled title="Non disponible : backend à venir" className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Déploiements</button>
            <button disabled title="Non disponible : backend à venir" className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Journal d’audit</button>
          </div>
        </div>
        <div className="space-y-5">
            <Card title="Nœuds de la plateforme">
              <table className="w-full text-[12.5px]">
                <thead><tr>{['Nœud','Rôle','État','Version servie','CPU','Mémoire','Disque','Dernier contact',''].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#F2F2F2]">{h}</th>)}</tr></thead>
                <tbody>
                  {nodes.map(n => (
                    <React.Fragment key={n.n}>
                      <tr onClick={()=>setNode(node===n.n?null:n.n)} className={`cursor-pointer ${node===n.n?'bg-[#FAFAFA]':'hover:bg-[#FAFAFA]'}`}>
                        <td className="h-11 px-4 border-b border-[#F2F2F2]"><div className="font-mono text-[12px] text-[#171717]">{n.n}</div><div className="text-[11.5px] text-[#8F8F8F]">{n.info}</div></td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#4D4D4D]">{n.role}</td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="inline-flex items-center gap-1.5"><Dot st={n.st}/>{n.st==='ok'?'Opérationnel':n.st==='warn'?'Vigilance':'—'}</span></td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="font-mono text-[11.5px]">{n.ver}</span>{n.exp && n.ver.includes(n.exp) && <span className="ml-1.5 text-[11px] text-[#15803D]">✓ attendue</span>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.cpu===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.cpu}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.mem===null?<span className="text-[#D4D4D4]">—</span>:<div><Bar v={Math.round(n.mem[0]/n.mem[1]*100)}/><div className="text-[10.5px] text-[#8F8F8F] mt-0.5">{n.mem[0]} / {n.mem[1]} Go MemoryMax</div></div>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.disk===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.disk}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#666666]">{n.seen}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#8F8F8F]"><I d={ic.chev} c={`w-4 h-4 transition ${node===n.n?'rotate-180':''}`}/></td>
                      </tr>
                      {node===n.n && (
                        <tr><td colSpan="9" className="bg-[#FAFAFA] border-b border-[#F2F2F2] px-4 py-4">
                          <div className="grid grid-cols-3 gap-6 text-[12.5px]">
                            <div><Lbl>Interfaces</Lbl>{records(resources.probeInterfaces.data?.data, 'interfaces').map((x,i)=><div key={i}>{available(x.name ?? x.interface)}</div>)}{resources.probeInterfaces.isError && <div>{resources.probeInterfaces.error.message}</div>}</div>
                            <div><Lbl>Version</Lbl><div>{available(resources.probe.data?.data?.version)}</div></div>
                            <div><Lbl>Actions</Lbl><div>Non disponible : backend à venir</div></div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-2 gap-5">
              <Card title="Capture · interfaces"><div className="p-4 grid grid-cols-4 gap-2">{records(resources.interfaces.data?.data, 'interfaces').map((x,i)=><div key={i} className="rounded-md border border-[#EBEBEB] px-2.5 py-2">{available(x.name ?? x.interface)}</div>)}</div><div className="px-4 pb-4">{resources.interfaces.isError ? resources.interfaces.error.message : 'POLARIS'}</div></Card>
              <Card title="Stockage et ingestion"><div className="p-4 space-y-3">{[['Disque disponible', safety.data?.data?.free_percent],['Segments ingérés',metrics.data?.data?.segments_ingested],['Échecs ingestion',metrics.data?.data?.ingestion_failures]].map(([label,value])=><div key={label} className="flex justify-between"><span>{label}</span><span>{available(value)}</span></div>)}</div></Card>
              <Card title="Modules"><div className="p-4">{records(resources.modules.data?.data,'modules').map((x,i)=><div key={i}>{available(x.name)} · {available(x.status)}</div>)}{resources.modules.isError && resources.modules.error.message}</div></Card>
              <Card title="Captures"><div className="p-4">{records(resources.captures.data?.data,'captures').map((x,i)=><div key={i}>{available(x.id)} · {available(x.status)}{auth.data?.data?.role==='operator' && <button disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)} onClick={()=>doCapture('stop',x.id)}>Arrêter</button>}</div>)}{resources.captures.isError && resources.captures.error.message}</div></Card>
            </div>
            {auth.data?.data?.role==='operator' && <section className="flex items-center gap-2"><input aria-label="Cible de capture" disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Cible de capture" className="h-8 px-3 border rounded-md"/><button disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)||!target||capture.isPending} onClick={()=>doCapture('validate')}>Valider la capture</button><button disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)||!target||capture.isPending} onClick={()=>doCapture('start')}>Démarrer la capture</button>{actionError && <span>{actionError}</span>}</section>}
          </div>

        <div className="text-[11.5px] text-[#8F8F8F]">{demo ? "Données de démo" : "POLARIS"}</div>
      </div>
    </div>
  );
}

const STARTERS = [
  ['Échecs du dernier run','Toutes les sessions en échec, triées par capture',[['Résultat','Échec']]],
  ['PDU Session 5G','Établissements de session de données en 5G SA',[['Procédure','PDU Session'],['RAT','5G SA']]],
  ['Attach LTE','Attachements 4G et bearers par défaut',[['Procédure','Attach'],['RAT','LTE']]],
  ['Plan de contrôle N4','Sessions avec échanges PFCP',[['Interface','N4']]],
];

const matchQ = (s,conds,join) => { const r = conds.map(c=>c[2]==='≠'?!test(s,c):test(s,c)); return join==='OU' ? (r.length===0 || r.some(Boolean)) : r.every(Boolean); };
const TPLS = [['Trace','Toutes les sessions d’un UE'],['Parcourir','Une ligne par session'],['Inspecter','Une ligne par message'],['Capture','Extrait pcap d’une session']];
const SCOPES = ['Run 5G #482','lte-run-976bd44b','Captures c41 → c43','Fenêtre horaire'];
const GROUPS = ['Aucun','Procédure','Résultat','Cause','Cellule','UE'];
const mkDraft = (o={}) => ({tpl:'Parcourir',scope:'',conds:[],join:'ET',group:'Aucun',name:'',...o});

function QueryLibrary({saved,onNew,onOpen}) {
  const [q,setQ] = useState(''); const [flt,setFlt] = useState('Toutes');
  const list = saved.filter(x=>(flt==='Toutes'||(flt==='Favoris'?x.fav:x.shared)) && x.n.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1280px] mx-auto px-8 py-8 space-y-6">
        <div className="flex items-end gap-4">
          <div><div className="text-[12px] text-[#666666]">POLARIS Analyzer</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">Requêtes</h1>
            <div className="text-[13px] text-[#666666] mt-1">Consulte et lance tes requêtes. La création s’ouvre dans un nouvel onglet.</div></div>
          <button onClick={()=>onNew()} className="ml-auto h-10 px-5 rounded-lg bg-[var(--app-accent)] text-white text-[14px] font-medium flex items-center gap-2 hover:opacity-90"><I d={ic.plus} c="w-4 h-4"/>Nouvelle requête</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 rounded-md border border-[#EBEBEB] bg-white flex items-center gap-2 px-3 focus-within:border-[var(--app-accent)]"><I d={ic.search} c="w-4 h-4 text-[#8F8F8F]"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher une requête…" className="flex-1 outline-none text-[13px] bg-transparent"/></div>
          <div className="flex rounded-md border border-[#EBEBEB] p-[2px] bg-white">{['Toutes','Favoris','Partagées'].map(f=><button key={f} onClick={()=>setFlt(f)} className={`h-8 px-3 rounded-[4px] text-[12.5px] ${flt===f?'bg-[var(--app-accent)] text-white font-medium':'text-[#666666]'}`}>{f}</button>)}</div>
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-3">Démarrer depuis un modèle</div>
          <div className="grid grid-cols-4 gap-3">
            {STARTERS.map(([tt,d,c]) => (
              <button key={tt} onClick={()=>onNew(mkDraft({tpl:'Parcourir',conds:c.map(x=>[x[0],x[1],'=']),name:tt,group:c[0][0]==='Résultat'?'Cause':'Résultat'}),tt)} className="text-left bg-white rounded-lg border border-[#EBEBEB] hover:border-[var(--app-accent)] p-4 transition">
                <div className="text-[13px] font-medium">{tt}</div><div className="text-[12px] text-[#666666] mt-1 leading-relaxed">{d}</div>
                <div className="flex flex-wrap gap-1 mt-3">{c.map(x=><span key={x[1]} className="text-[11px] rounded border border-[#EBEBEB] px-1.5 py-0.5 text-[#4D4D4D]">{x[0]} = {x[1]}</span>)}</div>
              </button>
            ))}
          </div>
        </div>
        <section className="bg-white rounded-lg border border-[#EBEBEB] overflow-hidden">
          <div className="px-5 h-12 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[14px] font-semibold">Requêtes enregistrées</h3><span className="ml-auto text-[12px] text-[#666666]">{list.length} requêtes</span></div>
          <table className="w-full text-[12.5px]">
            <thead><tr>{['','Nom','Gabarit','Portée','Conditions','Dernière exécution','Résultats',''].map((h,k)=><th key={k} className="h-9 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{h}</th>)}</tr></thead>
            <tbody>
              {list.length===0 && <tr><td colSpan={8} className="h-16 text-center text-[#8F8F8F]">Aucune requête.</td></tr>}
              {list.map(x => (
                <tr key={x.n} onClick={()=>onOpen(x)} className="cursor-pointer hover:bg-[#FAFAFA] group">
                  <td className="h-11 pl-4 border-b border-[#F2F2F2] w-8"><I d={ic.star} c={`w-3.5 h-3.5 ${x.fav?'text-[#171717]':'text-[#D4D4D4]'}`}/></td>
                  <td className="px-4 border-b border-[#F2F2F2] font-medium text-[#171717]">{x.n}{x.shared && <span className="ml-2 text-[10.5px] rounded border border-[#EBEBEB] px-1.5 py-0.5 text-[#666666]">partagée</span>}</td>
                  <td className="px-4 border-b border-[#F2F2F2] text-[#4D4D4D]">{x.g}</td>
                  <td className="px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666]">{x.p}</td>
                  <td className="px-4 border-b border-[#F2F2F2]"><span className="flex flex-wrap gap-1">{x.c.map((y,k)=><span key={k} className="text-[11px] rounded border border-[#EBEBEB] px-1.5 py-0.5 text-[#4D4D4D]">{y[0]} {y[2]||'='} {y[1]}</span>)}</span></td>
                  <td className="px-4 border-b border-[#F2F2F2] text-[#666666]">{x.last}</td>
                  <td className="px-4 border-b border-[#F2F2F2] tabular-nums">{x.r}</td>
                  <td className="px-4 border-b border-[#F2F2F2] text-right"><span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#171717] opacity-0 group-hover:opacity-100">Ouvrir<I d={ic.chev} c="w-3.5 h-3.5 -rotate-90"/></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="text-[11.5px] text-[#8F8F8F]">local à ce navigateur</div>
      </div>
    </div>
  );
}

function QSec({n,title,sub,children}) {
  const [open,setOpen] = useState(true);
  return (
    <section className="bg-white rounded-lg border border-[#EBEBEB]">
      <button onClick={()=>setOpen(!open)} className="w-full px-5 h-11 flex items-center gap-3 text-left">
        <span className="w-5 h-5 rounded-full bg-[#F2F2F2] text-[11px] font-semibold grid place-items-center text-[#4D4D4D]">{n}</span>
        <span className="text-[13.5px] font-semibold">{title}</span><span className="text-[11.5px] text-[#8F8F8F]">{sub}</span>
        <I d={ic.chev} c={`w-3.5 h-3.5 ml-auto text-[#8F8F8F] transition ${open?'':'-rotate-90'}`}/>
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </section>
  );
}

function QueryEditor({draft,setDraft,dirty,run,save,cancel,role,sessionRows=[]}) {
  const { demo } = usePolarisMode(); const datasets = useDatasets(); const causes = useAvailableCauses();
  const scopes = records(datasets.data?.data, 'datasets');
  const fieldList = demo ? FIELDS : [['Message',[]],['Cause',Array.isArray(causes.data?.data) ? causes.data.data.map(x=>typeof x==='string'?x:String(x.cause ?? x.code ?? '—')) : []],['Interface',FIELDS.find(x=>x[0]==='Interface')[1]],['UE',sessionRows.map(x=>x.ue)]];

  const [f,setF] = useState(fieldList[0][0]);
  const [v,setV] = useState(fieldList[0][1][0] || '');
  const [op,setOp] = useState('=');
  const [err,setErr] = useState('');
  const vals = (fieldList.find(x=>x[0]===f)||fieldList[0])[1];
  const up = o => setDraft({...draft,...o});
  const count = sessionRows.filter(s=>matchQ(s,draft.conds,draft.join)).length;
  const idField = x => x==='UE' || x==='IMSI';
  const exec = () => {
    const unsupported = querySupport(draft,demo); if (unsupported) return setErr(unsupported);
    if (draft.tpl==='Trace' && !draft.conds.some(c=>c[0]==='UE')) return setErr('Le gabarit Trace exige une condition UE.');
    if (draft.conds.some(c=>c[0]==='IMSI') && role!=='operator') return setErr('Les conditions IMSI exigent le rôle operator.');
    setErr(''); run();
  };
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1280px] mx-auto px-8 py-6 space-y-3">
        <div className="flex items-end gap-4 pb-1">
          <div><div className="text-[12px] text-[#666666]">POLARIS Analyzer · Requête</div>
            <input value={draft.name} onChange={e=>up({name:e.target.value})} placeholder="Nouvelle requête" className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1 bg-transparent outline-none w-[520px] placeholder:text-[#171717]"/></div>
          <span className="ml-auto text-[12px] text-[#666666]">{dirty && <span className="mr-3 inline-flex items-center gap-1.5 text-[#A15C07]"><span className="w-1.5 h-1.5 rounded-full bg-[#A15C07]"/>Modifications non enregistrées</span>}Aperçu : <b className="text-[#171717] tabular-nums">{demo ? count : '—'}</b> sessions</span>
        </div>
        <QSec n={1} title="Gabarit" sub="ce que la requête retourne">
          <div className="grid grid-cols-4 gap-2">{TPLS.map(([x,d]) => <button key={x} onClick={()=>up({tpl:x})} className={`text-left rounded-md border px-3 py-2 transition ${draft.tpl===x?'border-[var(--app-accent)] ring-1 ring-[var(--app-accent)]':'border-[#EBEBEB] hover:border-[#D4D4D4]'}`}><div className="text-[13px] font-medium uppercase tracking-wide">{x}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">{d}</div></button>)}</div>
        </QSec>
        <QSec n={2} title="Portée" sub="run, captures ou fenêtre horaire">
          <div className="flex flex-wrap gap-2">{(demo ? SCOPES : scopes.map(x=>String(x.id))).map(x => <button key={x} onClick={()=>up({scope:x})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.scope===x?'border-[var(--app-accent)] bg-[var(--app-accent)] text-white':'border-[#EBEBEB] text-[#4D4D4D] hover:border-[#D4D4D4]'}`}>{x}</button>)}</div>
        </QSec>
        <QSec n={3} title="Conditions" sub="champ, opérateur, valeur">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] text-[#666666]">Combinaison
              <div className="flex rounded-md border border-[#EBEBEB] p-[2px]">{['ET','OU'].map(j=><button key={j} onClick={()=>up({join:j})} className={`h-6 px-2.5 rounded-[4px] text-[11.5px] ${draft.join===j?'bg-[var(--app-accent)] text-white font-medium':'text-[#666666]'}`}>{j}</button>)}</div>
              <span className="text-[#8F8F8F]">· NON via l’opérateur ≠</span></div>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {draft.conds.length===0 && <span className="text-[12.5px] text-[#8F8F8F] self-center">Aucune condition : toutes les sessions de la portée.</span>}
              {draft.conds.map((c,i) => <span key={i} className="inline-flex items-center h-8 rounded-md border border-[#EBEBEB] text-[12.5px] overflow-hidden">{i>0 && <span className="px-2 h-full flex items-center text-[10.5px] font-semibold text-[#8F8F8F] border-r border-[#EBEBEB]">{draft.join}</span>}<span className="px-2.5 h-full flex items-center bg-[#FAFAFA] border-r border-[#EBEBEB] text-[#666666]">{c[0]}</span><span className="px-2 text-[#8F8F8F]">{c[2]||'='}</span><span className="pr-2.5 font-medium">{c[1]}</span><button onClick={()=>up({conds:draft.conds.filter((_,j)=>j!==i)})} aria-label="Retirer" className="w-7 h-full grid place-items-center text-[#8F8F8F] hover:text-[#B42318] border-l border-[#EBEBEB]"><I d={ic.x} c="w-3.5 h-3.5"/></button></span>)}
            </div>
            <div className="flex items-center gap-2">
              <select value={f} onChange={e=>{setF(e.target.value); setV(fieldList.find(x=>x[0]===e.target.value)[1][0] || '');}} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white">{fieldList.map(x=><option key={x[0]} disabled={idField(x[0]) && x[0]==='IMSI' && role!=='operator'}>{x[0]}</option>)}</select>
              <select value={op} onChange={e=>setOp(e.target.value)} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white"><option>=</option><option>≠</option></select>
              <input value={v} onChange={e=>setV(e.target.value)} list="polaris-filter-values" className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white min-w-[180px]"/><datalist id="polaris-filter-values">{vals.map(x=><option key={x} value={x}/>)}</datalist>
              <button onClick={()=>up({conds:[...draft.conds,[f,v,op]]})} className="h-8 px-3 rounded-md border border-[#EBEBEB] text-[12.5px] hover:bg-[#FAFAFA] flex items-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter</button>
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-[#8F8F8F]"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator</span>
            </div>
          </div>
        </QSec>
        <QSec n={4} title="Regrouper par" sub="facultatif">
          <div className="flex flex-wrap gap-2">{!demo && <span>Non disponible : backend à venir</span>}{GROUPS.map(g=><button disabled={!demo && g!=='Aucun'} key={g} onClick={()=>up({group:g})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.group===g?'border-[var(--app-accent)] text-[#171717] ring-1 ring-[var(--app-accent)]':'border-[#EBEBEB] text-[#666666] hover:border-[#D4D4D4]'}`}>{g}</button>)}</div>
        </QSec>
        <section className="bg-white rounded-lg border border-[#EBEBEB] px-5 h-14 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#F2F2F2] text-[11px] font-semibold grid place-items-center text-[#4D4D4D]">5</span><span className="text-[13.5px] font-semibold mr-3">Actions</span>
          {err && <span className="text-[12px] text-[#B42318]">{err}</span>}
          <button onClick={cancel} className="ml-auto h-9 px-3 rounded-md border border-[#EBEBEB] bg-white text-[12.5px] text-[#4D4D4D] hover:bg-[#F2F2F2]">Annuler</button>
          <button onClick={save} className="h-9 px-3 rounded-md border border-[#EBEBEB] bg-white text-[12.5px] text-[#4D4D4D] hover:bg-[#F2F2F2]">Enregistrer</button>
          <button onClick={exec} className="h-9 px-5 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter la requête</button>
        </section>
      </div>
    </div>
  );
}

const THEMES = [['blue','Bleu','#0062A1'],['black','Noir','#171717'],['green','Vert','#0F5B56']];
function Settings({theme,setTheme,lang,setLang,onClose}) {
  const version = useVersion();
  const [sec,setSec]=useState('apparence');
  const [cur,setCur]=useState(''),[nw,setNw]=useState(''),[cf,setCf]=useState(''),[pm,setPm]=useState(null);
  const accent = THEMES.find(t=>t[0]===theme)[2];
  const save = e => { e.preventDefault(); if(!cur||nw.length<8) return setPm(['err',t("Mot de passe actuel requis et 8 caractères minimum.")]); if(nw!==cf) return setPm(['err',t("Les mots de passe ne correspondent pas.")]); setPm(['err',t("Non disponible : backend à venir — authentification gérée par le proxy.")]); setCur('');setNw('');setCf(''); };
  const strength = Math.min(4,[/.{8,}/,/[A-Z]/,/[0-9]/,/[^A-Za-z0-9]/].filter(r=>r.test(nw)).length);
  const inp = "w-full h-11 rounded-lg border border-[#E5E5E5] bg-white px-3.5 text-[14px] outline-none transition focus:border-transparent focus:ring-2";
  const SECS=[['apparence','Apparence','Couleur et thème'],['securite','Sécurité','Mot de passe'],['langue','Langue','Français ou English'],['apropos','À propos','Version et build']];
  const Card = ({title,desc,children}) => <section className="bg-white rounded-xl border border-[#EBEBEB] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div className="px-7 pt-6 pb-5 border-b border-[#F0F0F0]"><h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#171717]">{title}</h2><p className="mt-1 text-[14px] text-[#666666]">{desc}</p></div>
    <div className="p-7">{children}</div></section>;
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="relative h-36 shrink-0" style={{background:`linear-gradient(120deg, ${accent}, ${accent}CC 60%, ${accent}88)`}}>
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 144" preserveAspectRatio="xMidYMid slice">
          <defs><radialGradient id="polGlow"><stop offset="0" stopColor="#fff" stopOpacity=".9"/><stop offset=".3" stopColor="#cfe8ff" stopOpacity=".35"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient></defs>
          <circle cx="389" cy="22" r="0.6" fill="#fff" opacity="0.39"/><circle cx="643" cy="53" r="0.6" fill="#fff" opacity="0.85"/><circle cx="258" cy="12" r="1.3" fill="#fff" opacity="0.39"/><circle cx="109" cy="61" r="0.6" fill="#fff" opacity="0.87"/><circle cx="757" cy="84" r="0.6" fill="#fff" opacity="0.67"/><circle cx="476" cy="141" r="0.6" fill="#fff" opacity="0.66"/><circle cx="160" cy="60" r="0.6" fill="#fff" opacity="0.66"/><circle cx="672" cy="98" r="0.6" fill="#fff" opacity="0.67"/><circle cx="767" cy="54" r="0.6" fill="#fff" opacity="0.66"/><circle cx="743" cy="71" r="1.3" fill="#fff" opacity="0.78"/><circle cx="559" cy="133" r="1" fill="#fff" opacity="0.51"/><circle cx="953" cy="101" r="0.8" fill="#fff" opacity="0.40"/><circle cx="360" cy="71" r="1" fill="#fff" opacity="0.75"/><circle cx="346" cy="141" r="0.6" fill="#fff" opacity="0.63"/><circle cx="198" cy="49" r="1.3" fill="#fff" opacity="0.58"/><circle cx="1154" cy="11" r="1" fill="#fff" opacity="0.54"/><circle cx="420" cy="72" r="1.3" fill="#fff" opacity="0.39"/><circle cx="112" cy="39" r="0.6" fill="#fff" opacity="0.38"/><circle cx="842" cy="93" r="1.3" fill="#fff" opacity="0.51"/><circle cx="463" cy="96" r="0.6" fill="#fff" opacity="0.87"/><circle cx="427" cy="88" r="1.3" fill="#fff" opacity="0.38"/><circle cx="922" cy="19" r="0.8" fill="#fff" opacity="0.57"/><circle cx="1100" cy="71" r="0.8" fill="#fff" opacity="0.60"/><circle cx="659" cy="127" r="1.3" fill="#fff" opacity="0.83"/><circle cx="334" cy="60" r="1" fill="#fff" opacity="0.73"/><circle cx="457" cy="33" r="0.6" fill="#fff" opacity="0.45"/><circle cx="278" cy="34" r="1.3" fill="#fff" opacity="0.81"/><circle cx="219" cy="41" r="0.8" fill="#fff" opacity="0.58"/><circle cx="443" cy="82" r="0.8" fill="#fff" opacity="0.73"/><circle cx="619" cy="89" r="0.6" fill="#fff" opacity="0.60"/><circle cx="1045" cy="137" r="1.3" fill="#fff" opacity="0.57"/><circle cx="473" cy="69" r="1.3" fill="#fff" opacity="0.38"/><circle cx="81" cy="30" r="0.8" fill="#fff" opacity="0.41"/><circle cx="721" cy="15" r="0.8" fill="#fff" opacity="0.65"/><circle cx="1139" cy="88" r="0.6" fill="#fff" opacity="0.83"/><circle cx="737" cy="21" r="1" fill="#fff" opacity="0.88"/><circle cx="723" cy="68" r="0.6" fill="#fff" opacity="0.82"/><circle cx="1192" cy="67" r="1.3" fill="#fff" opacity="0.52"/><circle cx="173" cy="108" r="1" fill="#fff" opacity="0.61"/><circle cx="830" cy="74" r="0.8" fill="#fff" opacity="0.87"/><circle cx="634" cy="21" r="0.6" fill="#fff" opacity="0.77"/><circle cx="358" cy="93" r="0.6" fill="#fff" opacity="0.73"/><circle cx="313" cy="53" r="0.8" fill="#fff" opacity="0.55"/><circle cx="267" cy="78" r="1" fill="#fff" opacity="0.70"/><circle cx="736" cy="114" r="0.8" fill="#fff" opacity="0.79"/><circle cx="982" cy="107" r="0.8" fill="#fff" opacity="0.46"/><circle cx="591" cy="105" r="0.6" fill="#fff" opacity="0.78"/><circle cx="567" cy="28" r="1" fill="#fff" opacity="0.60"/><circle cx="1124" cy="142" r="1" fill="#fff" opacity="0.39"/><circle cx="123" cy="68" r="1" fill="#fff" opacity="0.46"/><circle cx="749" cy="130" r="0.6" fill="#fff" opacity="0.61"/><circle cx="784" cy="115" r="0.6" fill="#fff" opacity="0.81"/><circle cx="144" cy="56" r="0.8" fill="#fff" opacity="0.61"/><circle cx="214" cy="114" r="1" fill="#fff" opacity="0.40"/><circle cx="1135" cy="104" r="1.3" fill="#fff" opacity="0.57"/><circle cx="1136" cy="104" r="0.8" fill="#fff" opacity="0.90"/><circle cx="33" cy="85" r="1.3" fill="#fff" opacity="0.79"/><circle cx="175" cy="119" r="1.3" fill="#fff" opacity="0.71"/><circle cx="420" cy="79" r="0.8" fill="#fff" opacity="0.36"/><circle cx="959" cy="105" r="0.6" fill="#fff" opacity="0.64"/><circle cx="1120" cy="62" r="0.8" fill="#fff" opacity="0.80"/><circle cx="253" cy="36" r="1" fill="#fff" opacity="0.63"/><circle cx="916" cy="47" r="1.3" fill="#fff" opacity="0.81"/><circle cx="73" cy="107" r="1.3" fill="#fff" opacity="0.71"/><circle cx="978" cy="74" r="0.8" fill="#fff" opacity="0.64"/><circle cx="628" cy="3" r="1.3" fill="#fff" opacity="0.78"/><circle cx="730" cy="112" r="0.8" fill="#fff" opacity="0.44"/><circle cx="568" cy="104" r="0.6" fill="#fff" opacity="0.53"/><circle cx="622" cy="80" r="0.6" fill="#fff" opacity="0.84"/><circle cx="68" cy="28" r="0.6" fill="#fff" opacity="0.77"/>
          <g opacity=".5" stroke="#fff" strokeWidth=".8" fill="none"><path d="M960 60 L905 78 L862 92 L820 100 L800 124 L752 118 L770 96 L820 100"/></g>
          {[[905,78],[862,92],[820,100],[800,124],[752,118],[770,96]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.8" fill="#fff"/>)}
          <circle cx="960" cy="60" r="34" fill="url(#polGlow)"/>
          <path d="M960 34 L963 57 L986 60 L963 63 L960 86 L957 63 L934 60 L957 57 Z" fill="#fff"/>
          <path d="M960 48 L962 58 L972 60 L962 62 L960 72 L958 62 L948 60 L958 58 Z" fill="#fff" transform="rotate(45 960 60)" opacity=".8"/>
          <text x="960" y="104" textAnchor="middle" fill="#fff" fontSize="9" letterSpacing="3" opacity=".75">POLARIS</text>
        </svg>
        <button onClick={onClose} className="absolute top-5 left-8 h-9 px-3.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[13.5px] font-medium backdrop-blur">{t("← Retour")}</button>
      </div>
      <div className="polaris-content-shell relative z-10 px-8 -mt-12 pb-16">
        <div className="flex items-end gap-5 mb-10">
          <div style={{background:accent}} className="w-24 h-24 rounded-2xl ring-4 ring-white shadow-lg grid place-items-center text-[30px] font-bold text-white">SD</div>
          <div className="pb-1 pt-14"><h1 className="text-[30px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717]">{t("Paramètres")}</h1><p className="text-[14.5px] text-[#666666]">{t("Gérez votre compte et l'apparence de POLARIS")}</p></div>
        </div>
        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-10">
          <nav className="space-y-1.5">
            {SECS.map(([k,n,d])=>{const on=sec===k; return (
              <button key={k} onClick={()=>setSec(k)} className={`w-full text-left px-4 py-3 rounded-lg transition border ${on?'bg-white border-[#EBEBEB] shadow-sm':'border-transparent hover:bg-white/70'}`}>
                <div className="flex items-center gap-2.5"><span className="w-1.5 h-5 rounded-full" style={{background:on?accent:'transparent'}}/><div><div className={`text-[14.5px] ${on?'font-semibold text-[#171717]':'text-[#4D4D4D]'}`}>{t(n)}</div><div className="text-[12.5px] text-[#8F8F8F]">{t(d)}</div></div></div>
              </button>);})}
          </nav>
          <div>
            {sec==='apparence' && <Card title={t("Couleur de l'application")} desc={t("Choisissez la couleur d'accent utilisée dans toute l'interface.")}>
              <div className="grid grid-cols-3 gap-5">{THEMES.map(([k,n,c])=>{const on=theme===k; return (
                <button key={k} onClick={()=>setTheme(k)} className={`group text-left rounded-xl border-2 overflow-hidden transition ${on?'shadow-md':'border-[#EBEBEB] hover:border-[#D4D4D4]'}`} style={on?{borderColor:c}:{}}>
                  <div className="h-28 bg-[#FAFAFA] p-3 flex flex-col gap-2">
                    <div className="h-4 rounded flex items-center gap-1.5 px-1.5 bg-white border border-[#EEE]"><span className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/><span className="h-1 w-8 rounded bg-[#DDD]"/><span className="ml-auto w-2.5 h-2.5 rounded-full" style={{background:c}}/></div>
                    <div className="flex-1 rounded bg-white border border-[#EEE] p-2 space-y-1.5"><span className="block h-1.5 w-3/4 rounded bg-[#E5E5E5]"/><span className="block h-1.5 w-1/2 rounded bg-[#E5E5E5]"/><span className="block h-4 w-14 rounded mt-2" style={{background:c}}/></div>
                  </div>
                  <div className="px-4 py-3 flex items-center gap-2.5 bg-white"><span className="w-5 h-5 rounded-full" style={{background:c}}/><span className="text-[14.5px] font-medium">{t(n)}</span><span className="ml-auto font-mono text-[11.5px] text-[#8F8F8F]">{c}</span>
                    {on && <span className="w-5 h-5 rounded-full grid place-items-center text-white text-[11px]" style={{background:c}}>✓</span>}</div>
                </button>);})}</div>
            </Card>}
            {sec==='securite' && <Card title={t("Mot de passe")} desc={t("Non disponible : backend à venir — authentification gérée par le proxy.")}>
              <form onSubmit={save} className="space-y-5 max-w-[460px]" style={{'--tw-ring-color':accent+'55'}}>
                {[['Mot de passe actuel',cur,setCur],['Nouveau mot de passe',nw,setNw],['Confirmer le mot de passe',cf,setCf]].map(([l,v,fn],i)=>(
                  <label key={l} className="block"><span className="block text-[13.5px] font-medium mb-1.5">{t(l)}</span>
                    <input disabled type="password" value={v} onChange={e=>fn(e.target.value)} className={inp}/>
                    {i===1 && nw && <div className="mt-2 flex gap-1.5">{[0,1,2,3].map(j=><span key={j} className="h-1.5 flex-1 rounded-full" style={{background:j<strength?accent:'#EBEBEB'}}/>)}</div>}
                  </label>))}
                {pm && <div className={`text-[13.5px] rounded-lg px-3.5 py-2.5 ${pm[0]==='ok'?'bg-[#ECF8F0] text-[#15803D]':'bg-[#FDEFEE] text-[#B42318]'}`}>{pm[1]}</div>}
                <button disabled title="Non disponible : backend à venir" type="submit" style={{background:accent}} className="h-11 px-6 rounded-lg text-white text-[14px] font-semibold shadow-sm hover:opacity-90">{t("Mettre à jour le mot de passe")}</button>
              </form>
            </Card>}
            {sec==='langue' && <Card title={t("Langue de l'interface")} desc={t("Choisissez la langue utilisée dans POLARIS.")}>
              <div className="grid grid-cols-2 gap-5 max-w-[520px]">{[['fr','Français','FR'],['en','English','EN']].map(([k,n,c])=>{const on=lang===k; return (
                <button key={k} onClick={()=>setLang(k)} className={`rounded-xl border-2 px-5 py-4 flex items-center gap-3 text-left transition ${on?'shadow-md':'border-[#EBEBEB] hover:border-[#D4D4D4]'}`} style={on?{borderColor:accent}:{}}>
                  <span className="w-10 h-10 rounded-lg grid place-items-center text-[13px] font-bold text-white" style={{background:on?accent:'#A3A3A3'}}>{c}</span>
                  <span className="text-[15px] font-medium">{n}</span>
                  {on && <span className="ml-auto w-5 h-5 rounded-full grid place-items-center text-white text-[11px]" style={{background:accent}}>✓</span>}
                </button>);})}</div>
            </Card>}
            {sec==='apropos' && <Card title={t("À propos")} desc={t("Versions des composants installés.")}>
              <div className="grid grid-cols-2 gap-5">{versionComponents(version.data?.data,UI_VERSION).map(([n,v])=>(
                <div key={n} className="rounded-xl border border-[#EBEBEB] p-5"><div className="text-[13px] text-[#666666]">{n}</div><div className="mt-1 text-[26px] font-semibold tracking-tight font-mono" style={{color:accent}}>{v}</div></div>))}</div>
            </Card>}
          </div>
        </div>
      </div>
    </div>);
}

/* ---------------- Traffic (flux, santé TCP, applications, congestion) — démo ---------------- */
function Traffic({setPage}){
  const { TR_CATS, TR_APPS, TR_CELLS, TR_V, TR_FLOWS, seedRand } = useTrafficDemo();
  const [sel,setSel]=useState(0); const [by,setBy]=useState('cat');
  const f=TR_FLOWS[sel]; const card="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden";
  const head=(n,x)=><div className="h-11 px-4 flex items-center gap-2 border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{t(n)}</h3>{x}</div>;
  const r=seedRand('flow'+sel); const W=600; const pts=k=>Array.from({length:40},()=>r()*k);
  const line=(d,mx)=>d.map((v,i)=>`${i?'L':'M'}${(i*W/39).toFixed(1)},${(70-v/mx*62).toFixed(1)}`).join(' ');
  const bars = by==='cat'?TR_CATS.map(([n,v,c])=>[n,v,c]):by==='app'?TR_APPS.map(([n,v])=>[n,v,'var(--app-accent)']):by==='cell'?TR_CELLS.map((c,i)=>['Cellule '+c,[31,24,18,12,9,6][i],'var(--app-accent)']):by==='dnn'?[['internet',84.1,'var(--app-accent)'],['ims',4.3,'var(--app-accent)'],['iot',2.1,'var(--app-accent)']]:[['5QI 9',82.4,'var(--app-accent)'],['5QI 8',9.9,'var(--app-accent)'],['5QI 1',4.1,'var(--app-accent)'],['5QI 5',0.6,'var(--app-accent)']];
  const mx=Math.max(...bars.map(b=>b[1]));
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-[#FAFAFA]">
      <div className="polaris-content-shell px-8 py-7 space-y-5">
        <div className="flex flex-wrap items-end gap-6">
          <div><div className="text-[12px] text-[#666666]">POLARIS Traffic</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">Traffic</h1><div className="text-[13px] text-[#666666] mt-1">{t("Débit, santé TCP, applications, congestion")}</div></div>
          <div className="ml-auto flex items-center gap-3"><span className="text-[11px] font-medium text-[#A15C00] bg-[#FFF7E6] border border-[#FCE2B0] rounded px-1.5 py-[1px]">{t("Données de démo")}</span><span className="text-[12px] text-[#8F8F8F]">{t("Aucune charge utile, aucune URL complète stockée.")}</span></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[['Volume','412 Go'],['Débit DL','1,84 Gb/s'],['Flux actifs','18 240'],['Établissement TCP','98,6 %'],['RTT médian','31 ms'],['Flux congestionnés','6,2 %']].map(([n,v])=><div key={n} className="bg-white rounded-xl border border-[#EBEBEB] px-4 py-3"><div className="text-[12px] text-[#8F8F8F]">{t(n)}</div><div className="text-[20px] font-semibold tabular-nums text-[#171717] mt-0.5">{v}</div></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <div className={card}>
            {head("Vue d'ensemble",<div className="ml-auto flex gap-1">{[['cat','Catégorie'],['app','Application'],['cell','Cellule'],['dnn','DNN'],['qi','5QI']].map(([k,n])=><button key={k} onClick={()=>setBy(k)} className={`h-7 px-2.5 rounded-md text-[12px] ${by===k?'bg-[#F2F2F2] font-semibold text-[#171717]':'text-[#666666]'}`}>{t(n)}</button>)}</div>)}
            <div className="p-4 space-y-2.5">{bars.map(([n,v,c])=><div key={n} className="flex items-center gap-3 text-[12.5px]"><span className={`w-32 truncate ${n==='Non identifié'?'text-[#8F8F8F] italic':'text-[#4D4D4D]'}`}>{t(n)}</span><div className="flex-1 h-2.5 rounded-full bg-[#F2F2F2]"><div className="h-2.5 rounded-full" style={{width:(v/mx*100)+'%',background:c}}/></div><span className="w-14 text-right tabular-nums">{v} %</span></div>)}
              {by==='app'&&<div className="text-[11px] text-[#8F8F8F] pt-1">{t("Réseau réel : agrégé uniquement, sans historique par abonné.")}</div>}</div>
          </div>
          <div className={card}>
            {head("Santé TCP")}
            <div className="p-4 grid grid-cols-3 gap-4 text-[12px]">
              {[['SYN → SYN-ACK (réseau)','14 ms'],['SYN-ACK → ACK (UE/radio)','17 ms'],['Sans réponse','0,9 %'],['RST','0,5 %'],['Retransmissions','1,1 %'],['Déséquencements','0,3 %'],['ACK dupliqués','0,7 %'],['Fenêtre nulle','0,2 %'],['ECN CE','0,04 %'],['MSS médian','1 360'],['UDP/QUIC volume','38 %'],['QUIC durée méd.','42 s']].map(([n,v])=><div key={n}><div className="text-[#8F8F8F]">{t(n)}</div><div className="text-[15px] font-semibold tabular-nums text-[#171717]">{v}</div></div>)}
              <div className="col-span-3 text-[11px] text-[#8F8F8F]">{t("RTT intra-capture et même interface uniquement.")}</div>
            </div>
          </div>
        </div>
        <div className={card}>
          {head("Congestion cellules × temps",<span className="ml-auto flex gap-3 text-[11px]">{Object.values(TR_V).map(([n,c])=><span key={n} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{background:c}}/>{t(n)}</span>)}</span>)}
          <div className="p-4"><table className="w-full text-[11px]"><tbody>{TR_CELLS.map(c=>{const rr=seedRand('cg'+c);return <tr key={c}><td className="pr-3 font-mono text-[#4D4D4D] w-14">{c}</td>{Array.from({length:48},(_,i)=>{const x=rr();const k=x>0.93?'RADIO':x>0.9?'CORE':x>0.88?'QOS':x>0.87?'IND':'OK';return <td key={i} className="p-[1px]"><div title={t(TR_V[k][0])} className="h-5 rounded-[2px]" style={{background:TR_V[k][1],opacity:k==='OK'?0.15:0.9}}/></td>;})}</tr>;})}</tbody></table>
          <div className="mt-2 flex justify-between text-[10.5px] text-[#A3A3A3]"><span>−12 h</span><span>{t("maintenant")}</span></div></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
          <div className={card}>
            {head("Flux")}
            <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-[11px] text-[#8F8F8F]">{['UE','Proto','5-uplet','Application','Catégorie','Règle','Cellule','Débit','RTT','Retrans.','Verdict'].map(h=><th key={h} className="px-3 py-2 font-medium border-b border-[#F2F2F2] whitespace-nowrap">{t(h)}</th>)}</tr></thead>
            <tbody>{TR_FLOWS.map((x,i)=><tr key={i} onClick={()=>setSel(i)} className={`cursor-pointer whitespace-nowrap ${sel===i?'bg-[#FAFAFA] shadow-[inset_2px_0_0_var(--app-accent)]':'hover:bg-[#FAFAFA]'}`}>
              <td className="px-3 py-2 font-mono">{x[0]}</td><td className="px-3">{x[1]}</td><td className="px-3 font-mono text-[11px] text-[#666666] whitespace-nowrap">{x[2]} → {x[3]}</td><td className="px-3">{x[4]}</td><td className={`px-3 ${x[5]==='Non identifié'?'italic text-[#8F8F8F]':''}`}>{t(x[5])}</td><td className="px-3 font-mono text-[11px] text-[#8F8F8F]">{x[6]}</td><td className="px-3 font-mono">{x[8]}</td><td className="px-3 tabular-nums">{x[9]} Mb/s</td><td className="px-3 tabular-nums">{x[10]} ms</td><td className="px-3 tabular-nums">{x[11]} %</td>
              <td className="px-3"><span className="text-[10.5px] font-medium rounded px-1.5 py-[1px] text-white whitespace-nowrap" style={{background:TR_V[x[12]][1]}}>{t(TR_V[x[12]][0])}</span></td></tr>)}</tbody></table></div>
          </div>
          <div className={card}>
            {head("Détail du flux",<span className="ml-auto font-mono text-[11px] text-[#8F8F8F]">{f[0]} · {f[7]}</span>)}
            <div className="p-4 space-y-3">
              {[['Débit',f[9]*1.4,'Mb/s'],['RTT',f[10]*1.5,'ms'],['Retransmissions',Math.max(1,f[11]*2),'%']].map(([n,k,u])=><div key={n}><div className="text-[11.5px] text-[#8F8F8F]">{t(n)} ({u})</div><svg viewBox={`0 0 ${W} 72`} className="w-full h-[56px]"><path d={line(pts(k),k)} fill="none" stroke="var(--app-accent)" strokeWidth="1.6"/></svg></div>)}
              <div className="rounded-md border border-[#F2F2F2] p-3 text-[12px]"><div className="flex items-center gap-2"><span className="text-[#8F8F8F]">{t("Verdict")}</span><span className="text-[10.5px] font-medium rounded px-1.5 text-white" style={{background:TR_V[f[12]][1]}}>{t(TR_V[f[12]][0])}</span></div><div className="mt-1 text-[#4D4D4D]">{f[13]}</div><div className="mt-1 text-[11px] text-[#8F8F8F]">{t("Règle appliquée")} : {f[6]} · {f[5]}</div></div>
              <button onClick={()=>setPage('sessions')} className="w-full h-9 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[12.5px] font-medium">{t("Ouvrir la session dans l'Analyzer →")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- KPI & Anomalies ---------------- */
// Fiche KPI : [id, nom, version, unité, numérateur, dénominateur, événements sources, dimensions, dédup, invariant, requête]
function MockChart({data,unit}){
  const w=640,h=240,pad=28; const mn=Math.min(...data), mx=Math.max(...data); const lo=mn-(mx-mn)*0.1, hi=mx+(mx-mn)*0.1||1;
  const X=i=>pad+i*(w-pad*2)/(data.length-1), Y=v=>h-pad-(v-lo)/(hi-lo||1)*(h-pad*2);
  const line=data.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const avg=data.reduce((a,b)=>a+b,0)/data.length;
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
    {[0,1,2,3].map(i=>{const y=pad+i*(h-pad*2)/3; const v=hi-(i/3)*(hi-lo); return <g key={i}><line x1={pad} x2={w-pad} y1={y} y2={y} stroke="#F2F2F2"/><text x={2} y={y+3} fontSize="9" fill="#A3A3A3">{fmtV(v,unit)}</text></g>;})}
    <path d={`${line} L${X(data.length-1)},${h-pad} L${X(0)},${h-pad} Z`} fill="var(--app-accent)" opacity="0.08"/>
    <path d={line} fill="none" stroke="var(--app-accent)" strokeWidth="1.8"/>
    <line x1={pad} x2={w-pad} y1={Y(avg)} y2={Y(avg)} stroke="#A3A3A3" strokeDasharray="3 3"/>
    {data.map((v,i)=>Math.abs(v-avg)>(mx-mn)*0.35?<circle key={i} cx={X(i)} cy={Y(v)} r="3.2" fill="#B42318"><title>{fmtV(v,unit)}</title></circle>:null)}
  </svg>;
}

function App() {
  const { demo } = usePolarisMode(); const auth = useAuthMe(); const role = auth.data?.data?.role ?? null;
  const version = useVersion(), metrics = useLiveMetrics();
  const kpis = useKpiCatalogue(); const demoLibrary = useDemoLibrary(); const sessionFilter = useSessionFilter();

  const [lang,setLangS] = useState(()=>{ try { return localStorage.getItem('polaris-lang')||'fr'; } catch(e) { return 'fr'; } });
  const setLang = l => { try { localStorage.setItem('polaris-lang',l); } catch(e) {} setLangS(l); };
  LANG = lang;
  const [theme,setThemeS] = useState(()=>{ try { return localStorage.getItem('polaris-theme')||'blue'; } catch(e) { return 'blue'; } });
  const setTheme = t => { try { localStorage.setItem('polaris-theme',t); } catch(e) {} setThemeS(t); };
  const accent = THEMES.find(t=>t[0]===theme)?.[2] || '#0062A1';
    const readP = () => { const h=(location.hash||'').replace('#',''); return (h!=='trafic'||TRAFFIC_ENABLED) && ['sessions','nodes','settings','templates','kpi','live','trafic'].includes(h) ? h : 'home'; };
  const [page,setPageS] = useState(readP);
  const setPage = p => { if(p==='trafic'&&!TRAFFIC_ENABLED) p='home'; try { location.hash = p; } catch(e) {} setPageS(p); };
  useEffect(()=>{ const f=()=>setPageS(readP()); window.addEventListener('hashchange',f); return ()=>window.removeEventListener('hashchange',f); },[]);
  const [tabs,setTabs] = useState([]);
  const seededDemo = useRef(false);
  useEffect(()=>{
    if (demo && !seededDemo.current) {
      seededDemo.current=true;
      setTabs(ts=>ts.length ? ts : demoLibrary.tabs.map(tab=>({...tab,demoOnly:true})));
    } else if (!demo) {
      seededDemo.current=false;
      setTabs(ts=>ts.filter(tab=>!tab.demoOnly));
    }
  },[demo]);
  const [tabId,setTabId] = useState('t1');
  const [saved,setSaved] = useState(()=>{ try { return redact(JSON.parse(localStorage.getItem('polaris-saved-queries') || '[]')); } catch { return []; } });
  useEffect(()=>{localStorage.setItem('polaris-saved-queries',JSON.stringify(saved));},[saved]);
  const savedList = [...saved,...demoLibrary.saved.filter(x=>!saved.some(y=>y.n===x.n))];
  const [aview,setAview] = useState('queries');
  const active = tabs.find(x=>x.id===tabId);
  const view = aview==='queries' || !active ? 'library' : (active.mode==='edit' ? 'edit' : 'results');
  const conds = active ? active.conds : [];
  const setConds = c => active && setTabs(ts=>ts.map(x=>x.id===active.id?{...x,conds:c.map(y=>y.length>2?y:[y[0],y[1],'='])}:x));
  const sessionsQuery = useSessions({ page:1, page_size:100, sort:'capture_id', order:'asc' }, page==='sessions');
  const sourceRows = records(sessionsQuery.data?.data, 'sessions').map((x,i)=>demo ? x : toLegacySession(x,i));
  const rows = useMemo(()=>{
    if (!active) return [];
    const ue = active.ue;
    const data = demo ? sourceRows : (active.apiRows || sourceRows);
    return demo ? data.filter(s=>(!ue || (Array.isArray(ue)?ue.includes(s.ue):s.ue===ue)) && matchQ(s,active.conds,active.join)) : data;
  },[active,demo,sessionsQuery.data]);
  const [sel,setSel] = useState(3);
  const s = rows.find(r=>r.id===sel) || rows.find(r=>r.id!=null);
  const bundle = useSessionBundle(page==='sessions' && view==='results' ? s?.id : null);
  const detailSession = bundle.session.data?.data ? toLegacySession(bundle.session.data.data) : null;
  const detailErrors = s?.id == null ? [] : [['session',bundle.session],['events',bundle.events],['procedures',bundle.procedures],['callflow',bundle.callflow],['correlations',bundle.correlations]]
    .filter(([,query])=>query.isError)
    .map(([endpoint,query])=>({endpoint:`/sessions/${encodeURIComponent(String(s.id))}${endpoint==='session'?'':`/${endpoint}`}`,status:query.error?.status ?? '—'}));
  const selected = s ? (demo ? s : {...s,...(detailSession ?? {}),id:detailSession?.id ?? s.id,session_id:detailSession?.session_id ?? s.session_id,d:bundle.detail || s.d,detailErrors}) : null;
  const nameOf = c => `${c.length?c.map(x=>x[1]).join(' · '):'Toutes les sessions'}${demo ? ' · run 482' : ''}`;
  const patch = (id,o) => setTabs(ts=>ts.map(x=>x.id===id?{...x,...o}:x));
  const newTab = (draft=mkDraft(),title) => { const id='q'+Date.now(); setTabs(ts=>[...ts,{id,k:'Requête',n:title||'Nouvelle requête',conds:[],mode:'edit',draft,dirty:!!title,demoOnly:demo}]); setTabId(id); setAview('tab'); };
  const openSaved = q => { const id='q'+Date.now(); const c=q.c.map(y=>[y[0],y[1],y[2]||'=']); setTabs(ts=>[...ts,{id,k:'Requête',n:q.n,conds:c,join:'ET',mode:demo?'results':'edit',draft:mkDraft({tpl:q.g,scope:q.p,conds:c,name:q.n}),demoOnly:demo}]); setTabId(id); setAview('tab'); };
  const editActive = () => { if (!active) return; patch(active.id,{mode:'edit',draft:active.draft||mkDraft({conds:active.conds,name:active.n,join:active.join||'ET'})}); };
  const setDraft = d => patch(active.id,{draft:d,dirty:true,n:d.name||'Nouvelle requête'});
  const runQuery = () => { const d=active.draft; const id=active.id;
    sessionFilter.mutate(d,{onSuccess:response=>patch(id,{conds:d.conds,join:d.join,n:d.name||nameOf(d.conds),mode:'results',ran:true,apiRows:demo?undefined:records(response.data,'sessions').map(toLegacySession)}),onError:e=>window.alert(e.message)});
  };
  const saveQuery = () => { const d=active.draft; const n=d.name||nameOf(d.conds);
    setSaved(sv=>[{n,g:d.tpl,p:d.scope,c:d.conds,last:"à l'instant",r:demo ? sourceRows.filter(x=>matchQ(x,d.conds,d.join)).length : '—',fav:false},...sv.filter(x=>x.n!==n)]);
    patch(active.id,{dirty:false,n,draft:{...d,name:n}}); };
  const cancelEdit = () => {
    if (active.ran || active.conds.length) { patch(active.id,{mode:'results'}); return; }
    const i = tabs.findIndex(x=>x.id===active.id);
    const nx = tabs.filter(x=>x.id!==active.id);
    setTabs(nx);
    setTabId(nx.length ? nx[Math.max(0,i-1)].id : null);
    setAview('queries');
  };
  const pickTab = id => { setTabId(id); setAview('tab'); };
  const closeTab = id => {
    const tb = tabs.find(x=>x.id===id);
    if (tb && tb.dirty && !window.confirm('Cet onglet contient des modifications non enregistrées. Fermer quand même ?')) return;
    const i = tabs.findIndex(x=>x.id===id);
    const nx = tabs.filter(x=>x.id!==id);
    setTabs(nx);
    if (id===tabId) {
      if (!nx.length) { setTabId(null); setAview('queries'); }
      else setTabId(nx[Math.max(0,i-1)].id);
    }
  };
  const [msg,setMsg] = useState(0);
  const [lens,setLens] = useState(null);
  const L0 = (()=>{ try { return JSON.parse(localStorage.getItem('polaris-layout'))||{}; } catch(e) { return {}; } })();
  const [gridPct,setGridPct] = useState(L0.gridPct ?? 42);
  const [gridHidden,setGridHidden] = useState(L0.gridHidden ?? false);
  const [insW,setInsW] = useState(L0.insW ?? 360);
  const [insHidden,setInsHidden] = useState(L0.insHidden ?? false);
  const [full,setFull] = useState(false);
  useEffect(()=>{ try { localStorage.setItem('polaris-layout',JSON.stringify({gridPct,gridHidden,insW,insHidden})); } catch(e) {} },[gridPct,gridHidden,insW,insHidden]);
  const mainRef = useRef(null);
  const drag = (e,kind) => { e.preventDefault(); const r = mainRef.current.getBoundingClientRect();
    const mv = ev => { if(kind==='h') setGridPct(Math.min(80,Math.max(15,(ev.clientY-r.top)/r.height*100))); else setInsW(Math.min(640,Math.max(280,window.innerWidth-ev.clientX))); };
    const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); document.body.style.cursor=''; };
    document.body.style.cursor = kind==='h'?'row-resize':'col-resize'; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); };
  const ui = {full,setFull,gridHidden,setGridHidden};
  useEffect(()=>{ setMsg(0); setLens(null); },[s?.id]);
  return (
    <div style={{"--app-accent":accent}} className="h-screen flex flex-col bg-[#FAFAFA] text-[#171717] text-base">
      <TopBar role={role} page={page} setPage={setPage} onAnalyzer={()=>setAview('queries')} accent={accent} onSettings={()=>setPage('settings')} metrics={metrics} version={version} demo={demo}/>
      <DataStatus t={t}/>
      {role==='operator' && <div className="h-7 shrink-0 bg-[#FDF6E7] border-b border-[#F1D9A8] text-[#7A4505] text-[12px] flex items-center px-4">Rôle operator actif · identités masquées · actions soumises au proxy</div>}
      {page==='settings' ? <Settings theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} onClose={()=>setPage('home')}/> : page==='home' ? <Home setPage={setPage} onNew={()=>{ setPage('sessions'); newTab(); }}/> : page==='kpi' ? <KpiModule t={t} role={role} setPage={setPage} KPIS={kpis.catalogue} mockSeries={kpis.mockSeries} MockChart={MockChart} fmtV={fmtV}/> : page==='live' ? <LiveModule t={t} role={role} setPage={setPage}/> : page==='trafic' ? (TRAFFIC_ENABLED && demo ? <Traffic setPage={setPage}/> : <div className="p-8">Non disponible : backend à venir</div>) : page==='nodes' ? <Nodes/> : page==='templates' ? <QueryLibrary saved={savedList} onNew={(d,tt)=>{setPage('sessions'); newTab(d,tt);}} onOpen={q=>{setPage('sessions'); openSaved(q);}}/> : <>
      {!full && <Tabs tabs={tabs} active={view==='library'?null:tabId} home={view==='library'} onPick={pickTab} onClose={closeTab} onHome={()=>setAview('queries')} onNew={()=>newTab()}/>}
      {view==='library' ? <QueryLibrary saved={savedList} onNew={newTab} onOpen={openSaved}/> : view==='edit' ? <QueryEditor key={active.id} draft={active.draft} setDraft={setDraft} dirty={active.dirty} run={runQuery} save={saveQuery} cancel={cancelEdit} role={role} sessionRows={sourceRows}/> : <div className="flex-1 flex min-h-0 p-3 bg-[#FAFAFA]">
        <main ref={mainRef} className="flex-1 min-w-0 flex flex-col">
          {!full && !gridHidden && <>
            <Grid rows={rows} sel={s?.id} setSel={setSel} role={role} conds={conds} setConds={setConds} onEdit={editActive} height={`${gridPct}%`}/>
            <div onMouseDown={e=>drag(e,'h')} onDoubleClick={()=>setGridPct(42)} title="Glisser pour redimensionner · double-clic pour réinitialiser" className="group h-3 shrink-0 cursor-row-resize relative"><div className="absolute left-1/2 -translate-x-1/2 top-[5px] h-[2px] w-10 rounded-full bg-[#E0E0E0] group-hover:bg-[var(--app-accent)] group-hover:w-full transition-all"/></div>
          </>}
          {selected ? <Detail s={selected} sel={msg} setSel={setMsg} lens={lens} ui={ui}/> : <div className="p-8 text-[#666666]">{sessionsQuery.isError ? sessionsQuery.error.message : sessionsQuery.isPending ? "Connexion POLARIS…" : "Aucune session"}</div>}
        </main>
        {selected && !full && (insHidden
          ? <button onClick={()=>setInsHidden(false)} title="Afficher le panneau" className="ml-3 w-9 shrink-0 bg-white rounded-xl border border-[#EBEBEB] flex flex-col items-center pt-3 gap-3 text-[#666666] hover:text-[#171717]"><I d="M9 4v16M4 4h16v16H4z" c="w-4 h-4"/><span className="[writing-mode:vertical-rl] text-[12px]">Décodage</span></button>
          : <><div onMouseDown={e=>drag(e,'v')} onDoubleClick={()=>setInsW(360)} title="Glisser pour redimensionner" className="group w-3 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[5px] w-[2px] h-10 rounded-full bg-[#E0E0E0] group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div>
            <Inspector s={selected} sel={msg} role={role} lens={lens} setLens={setLens} width={insW} onHide={()=>setInsHidden(true)}/></>)}
      </div>}</>}
      <footer className="h-7 shrink-0 bg-white border-t border-[#EBEBEB] flex items-center gap-5 px-4 text-[11.5px] text-[#666666]">
        <span>Capture : {available(metrics.data?.data?.capture_state)}</span><span>Segments ingérés : {available(metrics.data?.data?.segments_ingested)}</span>
        <span className="ml-auto font-mono">POLARIS {available(version.data?.data?.platform_core)} · API {available(version.data?.data?.backend_api)} · UI {UI_VERSION}{demo ? ' · Données de démo' : ''}</span>
      </footer>
    </div>
  );
}
export default App;
