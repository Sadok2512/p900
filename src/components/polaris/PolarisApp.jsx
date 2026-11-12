import KpiModule from './kpi/KpiModule';
import { ConditionBadge } from './ui/ConditionBadge';
import { conditionTone } from '@/lib/polaris-ui/conditionTone';
import LiveModule from './live/LiveModule';
import { useAuthMe, useHealth, useVersion, useMetrics, useLiveMetrics, useInterfaceRuntime, useStorageSafety, useSessions, useSessionAnchors, useSessionFlows, useSessionBundle, useProbes, useProbeResources, useDatasets, useAvailableCauses, useTrafficDemo, useKpiCatalogue, useDemoLibrary, usePolarisMode, useSessionFilter, useSessionIdentityMap, useSessionIdentities, usePacketDissection, useEvent, useProvenance, usePackets, useCorrelationRules, apiPath, redact, records, canCapture, useCaptureAction, TRAFFIC_ENABLED, UI_VERSION, toLegacySession, toLegacyProbe, available, querySupport, versionComponents, decoderVersions, topBarLiveIndicator } from '@/lib/polaris-api';
import { DataStatus } from '@/lib/polaris-api/status';
import SessionAnalysis, { VerdictBadge } from './analyzer/SessionAnalysis';
import Administration from './admin/Administration';
import LiveCapture from './admin/LiveCapture';
import ProbeRegistration from './admin/ProbeRegistration';
import ProbeManagement from './admin/ProbeManagement';
import { loadHidden, saveHidden, toggleHidden, isVisible, sanitizeHidden } from './admin/modules';
import SubscriberJourney, { OtherSessions } from './analyzer/SubscriberJourney';
import GeoPanel from './analyzer/GeoPanel';
import { shortPseudo, groupBySubscriber } from './analyzer/subscriber';
import { InterfaceBadge, AvailabilityStatus, TechnicalValue, BpfFilterDisplay } from './ui/InterfaceBadge';
import { INTERFACE_FAMILY_HEX, interfaceFamilyOf } from '@/lib/polaris-ui/interfaceColors';
import { APP_THEMES, DEFAULT_THEME, accentOf, normalizeTheme } from '@/lib/polaris-ui/appThemes';
/* Ladder lines and chips are SVG: they take the family's reference hex. */
const ifcHex = (name, part) => INTERFACE_FAMILY_HEX[interfaceFamilyOf(name)][part];
import { visibleMessages, filterOptions, emptyFilter, filterActive, pageItems, pageSlice, verdict, timeOf, toMs, fmtUtc, fmtDuration, sessionSummary } from './analyzer/analysis';
import React, { useState, useMemo, useEffect, useRef } from 'react';

/* Données fictives — PLMN de test 001/01. Tri canonique (capture_id, seq). */
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
const EN = {"Débit, santé TCP, applications, congestion": "Throughput, TCP health, applications, congestion", "Aucune charge utile, aucune URL complète stockée.": "No payload, no full URL stored.", "Volume": "Volume", "Débit DL": "DL throughput", "Flux actifs": "Active flows", "Établissement TCP": "TCP setup", "RTT médian": "Median RTT", "Flux congestionnés": "Congested flows", "Vue d'ensemble": "Overview", "Catégorie": "Category", "Application": "Application", "Cellule": "Cell", "Vidéo": "Video", "Transfert": "Transfer", "Messagerie": "Messaging", "Voix": "Voice", "Jeu": "Gaming", "Non identifié": "Unidentified", "Réseau réel : agrégé uniquement, sans historique par abonné.": "Live network: aggregated only, no per-subscriber history.", "Santé TCP": "TCP health", "Sans réponse": "No response", "Retransmissions": "Retransmissions", "ACK dupliqués": "Duplicate ACKs", "Fenêtre nulle": "Zero window", "RTT intra-capture et même interface uniquement.": "RTT intra-capture and same interface only.", "Congestion cellules × temps": "Cell congestion × time", "Radio": "Radio", "Cœur/Internet": "Core/Internet", "Limite QoS": "QoS limit", "Limite récepteur": "Receiver limit", "Limite application": "Application limit", "INDÉTERMINÉ": "UNDETERMINED", "Flux": "Flows", "Règle": "Rule", "Verdict": "Verdict", "Détail du flux": "Flow detail", "Règle appliquée": "Applied rule", "Ouvrir la session dans l'Analyzer →": "Open session in Analyzer →", "Taux d’établissement TCP": "TCP setup rate", "RTT TCP": "TCP RTT", "Retransmissions TCP": "TCP retransmissions", "Live delayed by": "Live delayed by", "flux pris après décodage — dumpcap jamais touchés": "stream taken after decoding — dumpcap never touched", "Cible": "Target", "Pause": "Pause", "Reprendre": "Resume", "Rôle viewer : cible par pseudonyme uniquement, identités masquées.": "Viewer role: pseudonym targets only, identities masked.", "Traces actives": "Active traces", "Expiration": "Expires in", "Messages reçus": "Messages received", "En tampon (pause)": "Buffered (paused)", "Signalisation live": "Live signalling", "en direct": "live", "en pause": "paused", "Ordre (capture_id, seq) — chaque message est retrouvable à l'identique dans l'Analyzer.": "Order (capture_id, seq) — every message is found identical in the Analyzer.", "Chaîne d'identité": "Identity chain", "masqué": "masked", "Débit live": "Live throughput", "Rapport d'usage PFCP": "PFCP usage report", "écart": "gap", "RTP live": "Live RTP", "Codec": "Codec", "Débit": "Bitrate", "Pertes": "Loss", "Gigue": "Jitter", "Déséquencement": "Reordering", "estimation G.107": "G.107 estimate", "En-têtes seulement — aucune charge audio lue ni stockée.": "Headers only — no audio payload read or stored.", "Journal des traces": "Trace log", "trace créée": "trace created", "recherche IMSI": "IMSI lookup", "consultation historique": "history viewed", "Données de démo": "Demo data", "Fraîcheur : 4 s": "Freshness: 4 s", "moyenne": "average", "échecs": "failures", "maintenant": "now", "il y a": "", "preuve": "evidence", "Analyse": "Analysis", "Template": "Template", "il y a 3 min": "3 min ago", "il y a 12 min": "12 min ago", "il y a 40 min": "40 min ago", "il y a 2 h": "2 h ago", "Données de démo — POLARIS non connecté.": "Demo data — POLARIS not connected.", "Accueil": "Home", "Administrateur": "Administrator", "Topologie et état des nœuds du réseau.": "Network node topology and status.", "Analyzer": "Analyzer", "Nœuds": "Nodes", "KPI": "KPI", "Live": "Live", "Trafic": "Traffic", "Templates": "Templates", "Paramètres": "Settings", "Compte": "Account", "Notifications": "Notifications", "Rechercher…": "Search…", "← Retour": "← Back", "Gérez votre compte et l'apparence de POLARIS": "Manage your account and the look of POLARIS", "Apparence": "Appearance", "Couleur et thème": "Color and theme", "Sécurité": "Security", "Mot de passe": "Password", "À propos": "About", "Version et build": "Version and build", "Langue": "Language", "Français ou English": "French or English", "Couleur de l'application": "App color", "Choisissez la couleur d'accent utilisée dans toute l'interface.": "Choose the accent color used across the interface.", "Bleu": "Blue", "Gris": "Grey", "Vert": "Green", "Rose": "Pink", "Violet": "Violet", "Ambre": "Amber", "Turquoise": "Turquoise", "Utilisez au moins 8 caractères, avec majuscules, chiffres et symboles.": "Use at least 8 characters, with uppercase letters, numbers and symbols.", "Mot de passe actuel": "Current password", "Nouveau mot de passe": "New password", "Confirmer le mot de passe": "Confirm password", "Mettre à jour le mot de passe": "Update password", "Versions des composants installés.": "Versions of installed components.", "Langue de l'interface": "Interface language", "Choisissez la langue utilisée dans POLARIS.": "Choose the language used in POLARIS.", "Mot de passe actuel requis et 8 caractères minimum.": "Current password required, 8 characters minimum.", "Les mots de passe ne correspondent pas.": "Passwords do not match.", "Mot de passe mis à jour.": "Password updated.", "Bienvenue sur POLARIS": "Welcome to POLARIS", "Analyse, diagnostic et supervision des sessions et du trafic réseau.": "Analysis, diagnostics and monitoring of network sessions and traffic.", "Nouvelle analyse": "New analysis", "Ouvrir un template": "Open a template", "Explorer un run": "Explore a run", "Trace live": "Live trace", "Bientôt": "Soon", "Modules": "Modules", "KPI & Anomalies": "KPI & Anomalies", "Plan usager": "User plane", "Requêtes, ladder et corrélation des sessions 4G/5G.": "Queries, ladder and correlation of 4G/5G sessions.", "Indicateurs par procédure et détection d'écarts.": "Per-procedure indicators and anomaly detection.", "Suivi en temps réel des sessions capturées.": "Real-time tracking of captured sessions.", "Débits et flux N3 / S1-U par session.": "N3 / S1-U throughput and flows per session.", "Requêtes enregistrées et modèles prêts à l'emploi.": "Saved queries and ready-to-use models.", "Ouvrir →": "Open →", "Activité récente": "Recent activity", "Voir tout": "View all", "Aucune activité pour l'instant": "No activity yet", "Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.": "Your analyses, KPI queries, templates and viewed runs will appear here.", "Lancer une analyse →": "Start an analysis →", "État de la plateforme": "Platform status", "Voir la supervision": "View monitoring", "Capture": "Capture", "dumpcap actifs / attendus": "active / expected dumpcap", "Fraîcheur des données": "Data freshness", "dernier import": "last import", "Alertes": "Alerts", "points de vigilance": "watch points", "Service POLARIS non connecté : aucune donnée en direct.": "POLARIS service not connected: no live data.", "Données à jour · retard 4 s": "Data up to date · 4 s delay", "Fraîcheur : — (POLARIS non connecté)": "Freshness: — (POLARIS not connected)", "Rechercher un KPI…": "Search a KPI…", "Santé sonde": "Probe health", "Procédures 5G": "5G procedures", "Procédures 4G": "4G procedures", "Session N4": "N4 session", "Erreurs": "Errors", "Latence": "Latency", "Corrélation": "Correlation", "Dumpcap actifs": "Active dumpcap", "Segments ignorés": "Dropped segments", "Retard d’import": "Import lag", "Disque disponible": "Disk available", "Succès Registration": "Registration success", "Succès PDU Session": "PDU Session success", "Succès Service Request": "Service Request success", "Succès Attach": "Attach success", "Succès E-RAB Setup": "E-RAB Setup success", "Succès établissement N4": "N4 establishment success", "Erreurs S6a": "S6a errors", "Erreurs SBI par NF": "SBI errors per NF", "Latence par procédure": "Latency per procedure", "Taux de liens EXACT": "EXACT link rate", "Séries": "Series", "Heatmap causes × temps": "Causes × time heatmap", "Top-N": "Top-N", "Granularité": "Granularity", "Aucune donnée à afficher": "No data to display", "Chaque point cliquable ouvrira l'Analyzer pré-filtré (fenêtre + dimension).": "Each clickable point will open the Analyzer pre-filtered (window + dimension).", "Requête générée": "Generated query", "Fiche KPI": "KPI sheet", "Formule": "Formula", "Événements sources": "Source events", "Dimensions": "Dimensions", "Unité": "Unit", "Règle de dédup": "Dedup rule", "Invariant": "Invariant", "Explorer dans l'Analyzer →": "Explore in Analyzer →", "Anomalies": "Anomalies", "Règles et invariants": "Rules and invariants", "Nouveauté": "Novelty", "Invariant de comptage": "Counting invariant", "succès + échec = total, par procédure et par minute": "success + failure = total, per procedure per minute", "Cause obligatoire": "Mandatory cause", "toute procédure en échec porte une cause (NAS, Diameter, HTTP…)": "every failed procedure carries a cause (NAS, Diameter, HTTP…)", "Ordre canonique": "Canonical order", "seq strictement croissant dans une capture (capture_id, seq)": "seq strictly increasing within a capture (capture_id, seq)", "Cause jamais vue": "Never-seen cause", "une cause d’échec absente du référentiel historique": "a failure cause absent from the historical reference", "Séquence hors flux 3GPP": "Out-of-flow 3GPP sequence", "enchaînement de messages incompatible avec la procédure": "message sequence incompatible with the procedure", "jamais déclenchée": "never triggered", "Une anomalie se ferme avec une preuve, ou reste OUVERTE.": "An anomaly closes with evidence, or stays OPEN.", "Requêtes": "Queries", "Requête": "Query", "Session": "Session", "Comparaison": "Comparison", "Trace": "Trace", "Fermer l'onglet": "Close tab", "Nouvel onglet": "New tab", "Vue partagée": "Shared view", "Toutes les sessions": "All sessions", "Nouvelle requête": "New query", "Segments en attente": "Pending segments", "À importer": "To import", "Échecs ingestion": "Ingestion failures", "Import": "Import", "Segments ingérés": "Ingested segments", "Importés": "Imported", "Segments ouverts": "Open segments", "Capture en cours": "Capture in progress", "Segments sans événement": "Zero-event segments", "Décodage": "Decoding", "Stockage": "Storage", "État de capture": "Capture state", "Opérationnel": "Operational", "Vigilance": "Warning", "Échec": "Failure", "Inconnu": "Unknown", "Information": "Information", "POLARIS connecté": "POLARIS connected", "Connexion POLARIS…": "Connecting to POLARIS…"};
let LANG = 'fr';
EN["Afficher toutes les sessions"] = "Display all sessions";
const t = s => LANG==='en' ? (EN[s] ?? s) : s;
const I = ({d,c='w-4 h-4'}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={c}><path d={d}/></svg>;
const ic = {
  search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35', x:'M18 6 6 18M6 6l12 12', plus:'M12 5v14M5 12h14',
  cols:'M4 5h16v14H4zM10 5v14M16 5v14', dl:'M12 4v11m0 0-4-4m4 4 4-4M5 20h14', lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  play:'M7 5l12 7-12 7z', star:'M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z', chev:'m6 9 6 6 6-6',
  lens:'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', pin:'M9 4h6l-1 6 4 3H6l4-3zM12 13v7',
  split:'M4 5h16v14H4zM12 5v14',
};
const Tag = ({i}) => <InterfaceBadge name={i}/>;
/* Badge strip for a probe row: compact, capped, the overflow in a tooltip. */
const InterfaceStrip = ({names}) => {
  const list = [...new Set((Array.isArray(names) ? names : []).filter(Boolean))];
  if (!list.length) return <span className="text-[11px] text-faint">aucune interface remontée</span>;
  return <span className="mt-1 flex flex-wrap items-center gap-1">{list.slice(0,4).map(i=><InterfaceBadge key={i} name={i}/>)}{list.length>4 && <span className="text-[11px] text-subtle" title={list.slice(4).join(', ')}>+{list.length-4}</span>}</span>;
};
const Res = ({r}) => <span className="inline-flex items-center gap-1.5"><span className={`w-[7px] h-[7px] rounded-full ${r==='Succès'||r==='success'?'bg-success':r==='Échec'||r==='failed'?'bg-warning':'bg-track'}`}/>{r}</span>;
const Stat = ({s}) => {
  const m = {'EXACT':'text-success bg-success-soft border-success-line','OUVERT':'text-warning bg-warning-soft border-warning-line','OUVERT':'text-danger bg-danger-soft border-danger-line'}[s];
  return <span className={`inline-block text-[11px] font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px] ${m}`}>{s}</span>;
};
const Lbl = ({children}) => <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mb-1.5">{children}</div>;

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
  return <button type="button" onClick={onOpen} title={title} aria-label={`État capture : ${indicator.label}`} className="h-9 px-2.5 flex items-center gap-2 rounded-md hover:bg-muted font-semibold text-[12.5px] tracking-wide" style={{color:indicator.color}}><span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${indicator.pulse?'polaris-live-pulse':''}`} style={{backgroundColor:indicator.color}}/><span>{indicator.label}</span></button>;
}

function TopBarVersion({version}) {
  const data=version.data?.data;
  const title=`backend_api: ${available(data?.backend_api)}\nsession_engine: ${available(data?.session_engine)}\ncorrelation_engine: ${available(data?.correlation_engine)}\nevent_schema: ${available(data?.event_schema)}\ndecoders: ${decoderVersions(data?.decoders)}`;
  return <div title={title} className="flex flex-col justify-center leading-none whitespace-nowrap"><span className="text-[17px] font-semibold tracking-tight text-foreground leading-[20px]">POLARIS</span><span className="text-[10.5px] text-muted-foreground font-mono leading-[14px] mt-0.5">{UI_VERSION}</span></div>;
}

function TopBar({role,page,setPage,onAnalyzer,accent,onSettings,metrics,version,demo,hidden=[]}) {
  const [menu,setMenu] = useState(false);
  return (
    <header className="h-14 shrink-0 bg-white border-b border-border flex items-center px-4 lg:px-5 gap-4 lg:gap-8 min-w-0">
      <div className="flex items-center gap-2.5 shrink-0">
        <div style={{background:accent}} className="w-8 h-8 rounded-[7px] grid place-items-center"><svg viewBox="0 0 24 24" className="w-[18px] h-[18px]"><path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" fill="#fff"/></svg></div>
        <TopBarVersion version={version}/>
      </div>
      <nav className="flex h-full min-w-0 overflow-x-auto scroll-thin gap-1 lg:gap-2">
        {[['home','Accueil'],['templates','Dashboard'],['sessions','Analyzer'],['kpi','KPI'],['live','Live'],...(TRAFFIC_ENABLED ? [['trafic','Traffic']] : [])].filter(([k])=>isVisible(hidden,k)).map(([k,n]) => {
          const on = page===k, ok = ['home','sessions','nodes','templates','kpi','live','trafic'].includes(k);
          return <button key={k} type="button" onClick={()=>{ if(ok) { setPage(k); if((k==='sessions'||k==='templates') && onAnalyzer) onAnalyzer(); } }} className={`relative shrink-0 px-3 h-full flex items-center text-[14px] outline-none focus-visible:bg-muted rounded-sm transition-colors ${ok?'cursor-pointer':'cursor-default'} ${on?'text-foreground font-semibold':'text-muted-foreground font-medium hover:text-foreground'}`} aria-current={on?'page':undefined}>{t(n)}{on && <span style={{background:accent}} className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-sm"/>}</button>;
        })}
      </nav>
      <div className="ml-auto shrink-0 flex items-center gap-2 lg:gap-4 text-[13px]">
        <TopBarLive metrics={metrics} demo={demo} onOpen={()=>setPage('live')}/>
        <span className="hidden lg:inline text-muted-foreground" aria-label="Rôle">{role || '—'}</span>
        <button type="button" title={t("Notifications")} className="w-9 h-9 rounded-md grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><I d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" c="w-[18px] h-[18px]"/></button>
        <div className="relative">
          <button type="button" onClick={()=>setMenu(m=>!m)} title={t("Compte")} style={{background:accent}} className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-semibold text-white hover:opacity-90">SD</button>
          {menu && <>
            <div className="fixed inset-0 z-40" onClick={()=>setMenu(false)}/>
            <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-border rounded-md shadow-lg py-1 text-[13px]">
              <div className="px-3 py-2 border-b border-border"><div className="font-semibold text-foreground">SD</div><div className="text-[11.5px] text-subtle">{role}</div></div>
              <button type="button" onClick={()=>{setMenu(false);onSettings();}} className="w-full text-left px-3 py-2 hover:bg-surface-2 text-foreground">{t("Paramètres")}</button>
            </div></>}
        </div>
      </div>
    </header>
  );
}

function Tabs({tabs,active,home,onPick,onClose,onHome,onNew}) {
  return (
    <div className="h-10 shrink-0 bg-white border-b border-border flex items-end px-3 gap-px overflow-x-auto scroll-thin">
      <button onClick={onHome} title={t("Requêtes")} className={`shrink-0 h-8 px-3 flex items-center gap-1.5 text-[12.5px] rounded-t-md border border-b-0 ${home?'bg-white border-border text-foreground font-medium shadow-[inset_0_2px_0_var(--app-accent)]':'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/60'}`}><I d={ic.cols} c="w-3.5 h-3.5"/>{t("Requêtes")}</button>
      <span className="w-px h-4 bg-muted mb-2 mx-1 shrink-0"/>
      {tabs.map(tb => (
        <div key={tb.id} onClick={()=>onPick(tb.id)} className={`group shrink-0 h-8 pl-3 pr-1.5 flex items-center gap-2 text-[12.5px] rounded-t-md border border-b-0 cursor-pointer max-w-[300px] ${tb.id===active?'bg-white border-border text-foreground shadow-[inset_0_2px_0_var(--app-accent)]':'border-transparent text-muted-foreground hover:bg-white/60'}`}>
          {tb.live && <span className="w-[6px] h-[6px] rounded-full bg-success shrink-0"/>}
          <span className="text-[11px] text-subtle shrink-0">{t(tb.k)}</span>
          <span className={`${tb.id===active?'font-medium':''} truncate`}>{tb.n}</span>{tb.dirty && <span title="Modifications non enregistrées" className="w-[7px] h-[7px] rounded-full bg-warning shrink-0"/>}{tb.mode==='edit' && <span className="text-[11px] text-subtle shrink-0">édition</span>}
          <button onClick={e=>{e.stopPropagation(); onClose(tb.id);}} title={t("Fermer l'onglet")} aria-label={t("Fermer l'onglet")} className="w-5 h-5 shrink-0 grid place-items-center rounded text-subtle hover:text-danger hover:bg-muted"><I d={ic.x} c="w-3 h-3"/></button>
        </div>
      ))}
      <button onClick={onNew} title={t("Nouvel onglet")} aria-label={t("Nouvel onglet")} className="shrink-0 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"><I d={ic.plus}/></button>
      <button className="ml-auto mb-1 shrink-0 h-7 px-2 flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><I d={ic.split} c="w-3.5 h-3.5"/>{t("Vue partagée")}</button>
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
    <aside className="w-[264px] shrink-0 bg-white border-r border-border flex flex-col">
      <div className="p-4 space-y-5 overflow-auto scroll-thin flex-1">
        <div><Lbl>Gabarit</Lbl>
          <div className="grid grid-cols-4 rounded-md border border-border p-[2px] bg-surface-2">
            {['Trace','Parcourir','Inspecter','Capture'].map(t => <button key={t} onClick={()=>setTpl(t)} className={`h-6 rounded-[4px] text-[11.5px] ${tpl===t?'bg-white text-foreground shadow-sm font-medium':'text-muted-foreground'}`}>{t}</button>)}
          </div>
        </div>
        <div><Lbl>Portée</Lbl>
          <div className="h-8 rounded-md border border-border px-2.5 flex items-center text-[13px]">Run 5G #482<span className="ml-auto text-subtle font-mono text-[11.5px]">c41 → c43</span><I d={ic.chev} c="w-3.5 h-3.5 ml-1.5 text-subtle"/></div>
        </div>
        <div><Lbl>Conditions</Lbl>
          <div className="space-y-1.5">
            {conds.map((c,i) => (
              <div key={i} className="flex"><ConditionBadge field={c[0]} value={c[1]} size="md" className="flex-1 pr-0"><button onClick={()=>setConds(conds.filter((_,j)=>j!==i))} aria-label="Retirer" className="ml-auto w-7 h-full grid place-items-center opacity-70 hover:opacity-100 hover:text-danger"><I d={ic.x} c="w-3.5 h-3.5"/></button></ConditionBadge></div>
            ))}
            {adding ? (
              <div className="rounded-md border border-foreground p-2 space-y-1.5 bg-surface-2">
                <select value={f} onChange={e=>{setF(e.target.value); setV(FIELDS.find(x=>x[0]===e.target.value)[1][0]);}} className="w-full h-7 rounded border border-border text-[12.5px] px-1.5 bg-white">{FIELDS.map(x=><option key={x[0]}>{x[0]}</option>)}</select>
                <select value={v} onChange={e=>setV(e.target.value)} className="w-full h-7 rounded border border-border text-[12.5px] px-1.5 bg-white">{vals.map(x=><option key={x}>{x}</option>)}</select>
                <div className="flex gap-1.5"><button onClick={()=>{setConds([...conds,[f,v]]); setAdding(false);}} className="flex-1 h-7 rounded bg-[var(--app-accent)] text-white text-[12px] font-medium">Ajouter</button><button onClick={()=>setAdding(false)} className="h-7 px-2 rounded border border-border text-[12px] bg-white">Annuler</button></div>
              </div>
            ) : <button onClick={()=>setAdding(true)} className="w-full h-8 rounded-md border border-dashed border-border-strong text-[12.5px] text-muted-foreground hover:border-foreground hover:text-foreground flex items-center justify-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter une condition</button>}
            <div className="flex items-center gap-1.5 pt-1 text-[11.5px] text-subtle"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator uniquement</div>
          </div>
        </div>
        <div><Lbl>Regrouper par</Lbl>
          <div className="h-8 rounded-md border border-border px-2.5 flex items-center text-[13px] text-subtle">Aucun<I d={ic.chev} c="w-3.5 h-3.5 ml-auto"/></div>
        </div>
        <button className="w-full h-8 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center justify-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter</button>
        <div className="border-t border-border-subtle pt-4"><Lbl>Requêtes enregistrées</Lbl>
          {['Échecs · run 482','PDU Session 5G · toutes causes','Attach LTE · certification','Liens à prouver SBI'].map((q,k) => (
            <div key={q} className="flex items-center gap-2 h-7 px-1 rounded text-[12.5px] text-ink-2 hover:bg-surface-2"><I d={ic.star} c={`w-3.5 h-3.5 ${k<2?'text-warning':'text-faint'}`}/>{q}</div>
          ))}
        </div>
      </div>
    </aside>
  );
}

const durOf = r => { if (r.multiCapture) return null; if (r.durMs!==undefined) return r.durMs; const a=toMs(r.start_timestamp), b=toMs(r.end_timestamp); return a!=null&&b!=null ? b-a : null; };
const GRID_GROUPS = [
  {k:'session',l:'Tous protocoles'},
  {k:'nas',l:'NAS — 5GS / EPS'},
  {k:'ran',l:'NGAP / S1AP'},
  {k:'correlation',l:'Corrélation multi-protocole'},
];
const GRID_COLS = [
  {k:'num',l:'Numéro',g:'session',w:112,v:r=>r.id!=null?`c${r.cap} · ${r.seq}`:'identifiant absent',mono:true,required:true},
  {k:'start',l:'Début UTC',g:'session',w:118,v:r=>fmtUtc(toMs(r.start_timestamp)),mono:true},
  {k:'sid',l:'Session ID',g:'session',w:120,v:r=>r.session_id??'—',mono:true},
  {k:'res',l:'Résultat',g:'session',w:96,v:r=>verdict(r.res)},
  {k:'dur',l:'Durée',g:'session',w:76,v:r=>{if(r.multiCapture) return 'multi-capture'; const d=durOf(r);return d==null?(r.dur??'—'):fmtDuration(d);},sort:r=>durOf(r)??-1},
  {k:'ue',l:'UE',g:'session',w:96,v:r=>r.ue,mono:true},
  {k:'sub',l:'Abonné',g:'session',w:140,v:r=>r.subscriber_imsi ?? shortPseudo(r.subscriber_pseudonym),mono:true},
  {k:'rat',l:'RAT',g:'session',w:64,v:r=>r.rat},
  {k:'proc',l:'Procédure',g:'session',w:130,v:r=>r.proc},
  {k:'imsi',l:'IMSI',g:'nas',w:132,v:r=>r.identities?.imsi??'—',identity:true,mono:true},
  {k:'tmsi',l:'TMSI',g:'nas',w:140,v:r=>r.identities?.tmsi?.at(-1)?.value??'—',identity:true,proof:'tmsi',mono:true},
  {k:'s_tmsi',l:'S-TMSI',g:'nas',w:140,v:r=>r.identities?.s_tmsi?.at(-1)?.value??'—',identity:true,proof:'s_tmsi',mono:true},
  {k:'m_tmsi',l:'M-TMSI',g:'nas',w:112,v:r=>r.identities?.m_tmsi?.at(-1)?.value??'—',identity:true,proof:'m_tmsi',mono:true},
  {k:'imei',l:'IMEI',g:'nas',w:132,v:r=>r.identities?.imei?.value??'—',identity:true,mono:true},
  {k:'msisdn',l:'MSISDN',g:'nas',w:132,v:r=>r.identities?.msisdn??'—',identity:true,mono:true},
  {k:'cause',l:'Cause',g:'nas',w:120,v:r=>r.cause||'—'},
  {k:'pdu',l:'PDU Session',g:'nas',w:88,v:r=>r.pdu_session_id??'—',mono:true},
  {k:'cell',l:'Cellule',g:'ran',w:84,v:r=>r.cell??'—'},
  {k:'core',l:'AMF/MME',g:'ran',w:90,v:r=>r.serving_node??'—'},
  {k:'ran',l:'gNB/eNB',g:'ran',w:90,v:r=>r.ran_node??r.gnb??r.enb??'—'},
  {k:'ifc',l:'Interfaces',g:'correlation',w:132,v:r=>[...new Set(r.interfaces??[])].join(' ')},
  {k:'ex',l:'Liens EXACT',g:'correlation',w:90,v:r=>r.ex,mono:true},
  {k:'comp',l:'Compl.',g:'correlation',w:68,v:r=>r.comp==='—'?'—':`${r.comp} %`,sort:r=>Number(r.comp)||-1},
];
function Grid({rows,sel,setSel,role,conds,setConds,onEdit,height}) {
  const { demo } = usePolarisMode(); const sessions = useSessions({ page:1, page_size:100, sort:'capture_id', order:'asc' },false);
  const operator=role==='operator'||role==='administrator';
  const identityMap=useSessionIdentityMap(rows.map(row=>row.session_id),operator&&!demo);
  const enrichedRows=useMemo(()=>rows.map(row=>({...row,identities:identityMap[row.session_id]})),[rows,identityMap]);
  const [more,setMore] = useState(false);
  const [manageCols,setManageCols] = useState(false);
  const [txt,setTxt] = useState('');
  const [sort,setSort] = useState(null);
  const [widths,setWidths] = useState(()=>{ try { return JSON.parse(localStorage.getItem('polaris-grid-cols'))||{}; } catch(e) { return {}; } });
  const [hiddenCols,setHiddenCols] = useState(()=>{ try { const value=JSON.parse(localStorage.getItem('polaris-grid-hidden-cols'))||[]; return Array.isArray(value)?value.filter(k=>GRID_COLS.some(c=>c.k===k&&!c.required)):[]; } catch(e) { return []; } });
  useEffect(()=>{ try { localStorage.setItem('polaris-grid-cols',JSON.stringify(widths)); } catch(e) {} },[widths]);
  useEffect(()=>{ try { localStorage.setItem('polaris-grid-hidden-cols',JSON.stringify(hiddenCols)); } catch(e) {} },[hiddenCols]);
  const visibleCols = useMemo(()=>GRID_COLS.filter(c=>!hiddenCols.includes(c.k)&&(!c.identity||operator)),[hiddenCols,operator]);
  const W = c => widths[c.k] ?? c.w;
  const closeMore = () => { setMore(false); setManageCols(false); };
  const resetCols = () => { setWidths({}); setHiddenCols([]); setSort(null); closeMore(); };
  const toggleCol = c => { if(c.required) return; setHiddenCols(value=>value.includes(c.k)?value.filter(k=>k!==c.k):[...value,c.k]); if(sort?.[0]===c.k) setSort(null); };
  const resize = (e,c) => { e.preventDefault(); e.stopPropagation(); const x0=e.clientX, w0=W(c);
    const mv = ev => setWidths(w=>({...w,[c.k]:Math.max(48,w0+ev.clientX-x0)}));
    const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); document.body.style.cursor=''; };
    document.body.style.cursor='col-resize'; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); };
  const q = txt.trim().toLowerCase();
  const shown = useMemo(()=>{
    let out = q ? enrichedRows.filter(r=>GRID_COLS.some(c=>(!c.identity||operator)&&String(c.v(r)).toLowerCase().includes(q))) : enrichedRows;
    if (sort) { const c=GRID_COLS.find(x=>x.k===sort[0]); const f=c.sort||c.v; out=[...out].sort((a,b)=>{const x=f(a),y=f(b); return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))*sort[1];}); }
    return out;
  },[enrichedRows,q,sort,operator]);
  const [grouped,setGrouped] = useState(false); const [openGroups,setOpenGroups] = useState([]);
  const [size,setSize] = useState(25); const [page,setPage] = useState(1);
  const condKey = JSON.stringify(conds);
  useEffect(()=>{ setPage(1); },[q,condKey,size]);
  const pages = Math.max(1,Math.ceil(shown.length/size)); const cur = Math.min(page,pages);
  const pageRows = pageSlice(shown,cur,size);
  const ko = rows.filter(r=>verdict(r.res)==='FAILED').length;
  const cell = (c,r) => {
    const v = c.v(r);
    if (c.k==='res') return <VerdictBadge v={v}/>;
    if (c.k==='sub') return v==='—' ? <span className="text-subtle">—</span> : <span className="inline-flex items-center gap-1">{v}{r.subscriber_session_count!=null && <span className="rounded bg-brand-soft text-brand px-1 text-[11px] font-sans font-semibold">{r.subscriber_session_count} sessions</span>}</span>;
    if (c.k==='ifc') return <span className="flex gap-1">{[...new Set(r.interfaces ?? [])].map(i=><Tag key={i} i={i}/>)}</span>;
    if (c.identity) { const values=c.proof ? (r.identities?.[c.proof]??[]) : []; const extra=Math.max(0,values.length-1); const title=values.map(x=>`${x.value} — ${x.role} — ${x.capture_id}·${x.packet_number}`).join('\n'); return <span className="font-mono" title={title||undefined}>{v}{extra>0&&<span className="ml-1 rounded bg-brand-soft text-brand px-1 font-sans text-[10px]">+{extra}</span>}</span>; }
    if (c.k==='cause') return <span className={verdict(r.res)==='FAILED'?'text-danger':'text-muted-foreground'}>{v}</span>;
    return v;
  };
  return (
    <section className="flex flex-col min-h-0 bg-white shrink-0 rounded-xl border border-border overflow-hidden" style={{height}}>
      <div className="h-10 shrink-0 flex items-center gap-3 px-3 border-b border-border">
        <span className="text-[13px] font-semibold text-foreground">Sessions</span>
        <div className="flex-1 h-7 rounded-md border border-border flex items-center gap-1.5 px-2 focus-within:border-[var(--app-accent)]">
          <I d={ic.search} c="w-[14px] h-[14px] text-muted-foreground"/>
          {conds.map((c,i) => <ConditionBadge key={i} field={c[0]} value={c[1]} op={c[2]||'='} className="pr-1"><button onClick={()=>setConds(conds.filter((_,j)=>j!==i))} aria-label="Retirer" className="opacity-70 hover:opacity-100"><I d={ic.x} c="w-3 h-3"/></button></ConditionBadge>)}
          <input aria-label="Rechercher dans les sessions" value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&txt){ const f=FIELDS.find(x=>x[1].some(v=>v.toLowerCase()===txt.toLowerCase())); if(f){ setConds([...conds,[f[0],f[1].find(v=>v.toLowerCase()===txt.toLowerCase())]]); setTxt(''); } } }}
            placeholder="Rechercher… (Entrée sur Échec, LTE, N4… ajoute un filtre)" className="flex-1 min-w-[140px] outline-none text-[12.5px] placeholder:text-subtle"/>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{demo || sessions.data || rows.length ? shown.length : '—'}</span> sessions
          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden flex"><div className="bg-[#16A34A]" style={{width:`${rows.length?(rows.length-ko)/rows.length*100:0}%`}}/><div className="bg-danger" style={{width:`${rows.length?ko/rows.length*100:0}%`}}/></div>
          <span className="tabular-nums">{demo || sessions.data || rows.length ? ko : '—'} échecs</span>
        </div>
        <button onClick={onEdit} className="h-7 px-2.5 rounded-md border border-border text-[12px] flex items-center gap-1.5 text-ink-2 hover:bg-surface-2"><I d={ic.search} c="w-3.5 h-3.5"/>Modifier la requête</button>
        <div className="relative">
          <button onClick={()=>{setMore(m=>!m);setManageCols(false);}} title="Plus d'actions" aria-expanded={more} className="h-7 w-7 rounded-md border border-border grid place-items-center text-ink-2 hover:bg-surface-2">⋯</button>
          {more && <><div className="fixed inset-0 z-30" onClick={closeMore}/>{manageCols ? <div role="dialog" aria-label="Gérer les colonnes" className="absolute right-0 top-8 z-40 w-72 bg-white border border-border rounded-lg shadow-lg text-[12.5px] overflow-hidden">
            <div className="h-9 px-3 flex items-center border-b border-border"><button onClick={()=>setManageCols(false)} aria-label="Retour aux actions" className="mr-2 text-muted-foreground hover:text-foreground">←</button><span className="font-semibold text-foreground">Gérer les colonnes</span><button onClick={()=>setHiddenCols([])} className="ml-auto text-[11.5px] text-[var(--app-accent)]">Tout afficher</button></div>
            <div className="max-h-[420px] overflow-auto scroll-thin p-2.5 space-y-3">
              {GRID_GROUPS.map(group=><section key={group.k} aria-label={group.l}><div className="px-1 mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{group.l}</div>{GRID_COLS.filter(c=>c.g===group.k&&(!c.identity||operator)).map(c=><label key={c.k} className={`h-7 px-1 flex items-center gap-2 rounded hover:bg-surface-2 ${c.required?'cursor-not-allowed':'cursor-pointer'}`}><input type="checkbox" aria-label={c.l} checked={!hiddenCols.includes(c.k)} disabled={c.required} onChange={()=>toggleCol(c)}/><span>{c.l}</span>{c.required&&<span className="ml-auto text-[11px] text-subtle">obligatoire</span>}</label>)}</section>)}
            </div>
            <div className="p-2 border-t border-border text-[11px] text-muted-foreground">Les choix sont enregistrés dans ce navigateur.</div>
          </div> : <div className="absolute right-0 top-8 z-40 w-52 bg-white border border-border rounded-lg shadow-lg py-1 text-[12.5px]">
            <button onClick={()=>setManageCols(true)} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-surface-2"><I d={ic.cols} c="w-3.5 h-3.5 text-muted-foreground"/>Gérer les colonnes</button>
            <button onClick={()=>{setGrouped(g=>!g);closeMore();}} aria-pressed={grouped} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-surface-2"><I d={ic.cols} c="w-3.5 h-3.5 text-muted-foreground"/>{grouped?'Ne plus grouper':'Grouper par abonné'}</button>
            <button onClick={resetCols} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-surface-2"><I d={ic.cols} c="w-3.5 h-3.5 text-muted-foreground"/>Réinitialiser les colonnes</button>
            <button onClick={closeMore} className="w-full px-3 h-8 flex items-center gap-2 hover:bg-surface-2"><I d={ic.dl} c="w-3.5 h-3.5 text-muted-foreground"/>Exporter</button>
          </div>}</>}
        </div>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        <table className="text-[12px] whitespace-nowrap border-separate border-spacing-0 table-fixed" style={{width:visibleCols.reduce((a,c)=>a+W(c),0)}}>
          <colgroup>{visibleCols.map(c=><col key={c.k} style={{width:W(c)}}/>)}</colgroup>
          <thead className="sticky top-0 z-20">
            <tr>{visibleCols.map((c,k) => <th key={c.k} aria-sort={sort?.[0]===c.k?(sort[1]>0?'ascending':'descending'):'none'} onClick={()=>setSort(s=>s?.[0]===c.k?(s[1]>0?[c.k,-1]:null):[c.k,1])} className={`relative h-7 px-2 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border cursor-pointer select-none hover:text-foreground ${k===0?'sticky left-0 z-30 border-r':''}`}>
              <span className="inline-flex items-center gap-1 truncate max-w-full">{c.lock && <I d={ic.lock} c="w-3 h-3"/>}{c.l}{sort?.[0]===c.k && <span className="text-foreground">{sort[1]>0?'↑':'↓'}</span>}</span>
              <span onMouseDown={e=>resize(e,c)} onClick={e=>e.stopPropagation()} onDoubleClick={e=>{e.stopPropagation();setWidths(w=>{const n={...w};delete n[c.k];return n;});}} title="Redimensionner" className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--app-accent)]/40"/></th>)}</tr>
          </thead>
          <tbody>
            {(grouped ? groupBySubscriber(pageRows).flatMap(g=>{ const open=g.key==null||openGroups.includes(g.key); return [g.key==null?null:{__group:g.key,n:g.rows.length,open}, ...(open?g.rows:[])].filter(Boolean); }) : pageRows).map((r,rowIndex) => {
              if (r.__group) return <tr key={`g-${r.__group}`} onClick={()=>setOpenGroups(o=>o.includes(r.__group)?o.filter(x=>x!==r.__group):[...o,r.__group])} className="cursor-pointer"><td colSpan={visibleCols.length} className="h-7 px-2 border-b border-border bg-surface-2 text-[12px] font-medium text-foreground">{r.open?'▾':'▸'} Abonné <span className="font-mono">{shortPseudo(r.__group)}</span> <span className="ml-1 rounded bg-brand-soft text-brand px-1 text-[11px] font-semibold">{r.n} sessions</span></td></tr>;
              const on = sel===r.id;
              const clickable = r.id != null;
              return (
                <tr key={r.id ?? `missing-session-${rowIndex}`} onClick={()=>{if(clickable)setSel(r.id);}} aria-selected={on} aria-disabled={!clickable} className={`group ${clickable?'cursor-pointer':'cursor-default opacity-70'}`}>
                  {visibleCols.map((c,k)=>{ const v=c.v(r); return <td key={c.k} title={String(v)} className={`h-7 px-2 border-b border-border-subtle overflow-hidden text-ellipsis ${c.mono?'font-mono text-[11.5px]':''} ${k===0?'sticky left-0 z-10 border-r border-r-[#E2E8F0] text-muted-foreground':'text-foreground'} ${on?'bg-[color-mix(in_oklab,var(--app-accent)_8%,white)]':'bg-white group-hover:bg-surface-2'} ${on&&k===0?'shadow-[inset_3px_0_0_var(--app-accent)]':''}`}>{cell(c,r)}</td>; })}
                </tr>
              );
            })}
            {shown.length===0 && <tr><td colSpan={visibleCols.length} className="px-3 py-8 text-left text-muted-foreground">{q ? 'Aucune session ne correspond à la recherche' : demo || sessions.data ? 'Aucune session' : 'POLARIS non connecté'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="h-9 shrink-0 flex items-center gap-3 px-3 border-t border-border bg-white text-[12px] text-ink-2 whitespace-nowrap overflow-hidden">
        <span className="tabular-nums">{shown.length ? `${(cur-1)*size+1}–${Math.min(cur*size,shown.length)}` : '0'} sur <b>{shown.length}</b> sessions</span>
        <label className="ml-auto flex items-center gap-1.5 text-muted-foreground">Lignes par page
          <select aria-label="Lignes par page" value={size} onChange={e=>setSize(Number(e.target.value))} className="h-6 px-1 rounded border border-border bg-white text-foreground outline-none">{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <nav aria-label="Pagination des sessions" className="flex items-center gap-0.5">
          {[['|<',1,'Première page'],['<',cur-1,'Page précédente']].map(([l,p,a])=><button key={a} aria-label={a} disabled={cur<=1} onClick={()=>setPage(p)} className="h-6 min-w-6 px-1 rounded text-ink-2 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent">{l}</button>)}
          {pages>1 && pageItems(cur,pages).map((p,i)=>p==='…'?<span key={'g'+i} className="px-1 text-subtle">…</span>:<button key={p} aria-current={p===cur?'page':undefined} onClick={()=>setPage(p)} className={`h-6 min-w-6 px-1.5 rounded tabular-nums ${p===cur?'bg-[var(--app-accent)] text-white font-medium':'hover:bg-muted'}`}>{p}</button>)}
          {[['>',cur+1,'Page suivante'],['>|',pages,'Dernière page']].map(([l,p,a])=><button key={a} aria-label={a} disabled={cur>=pages} onClick={()=>setPage(p)} className="h-6 min-w-6 px-1 rounded text-ink-2 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent">{l}</button>)}
        </nav>
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
function Ladder({d,sel,setSel,lens,hidden,collapsed,width,zoom=1,timers=false,allowed}) {
  const W = Math.max(560, Math.round(width*zoom)), LG = 214, n = Math.max(2,d.nodes.length), ROW = 30, TOP = 46;
  const x = k => LG + 50 + k*((W-LG-(timers?130:100))/(n-1));
  const procedureKey = p => `${p[0]}:${p[3] ?? p[1]}`;
  const inCollapsed = k => d.procs.some(p=>collapsed.includes(procedureKey(p)) && k>=p[1] && k<=p[2]);
  const vis = d.msgs.map((m,k)=>k).filter(k=>!hidden.includes(d.msgs[k][0]) && !inCollapsed(k) && (!allowed || allowed.has(k)));
  const H = TOP + Math.max(1,vis.length)*ROW + 16;
  const lensCause = lens && d.msgs.some(m=>m[5]===lens && isCause(m));
  return (
    <svg width={W} height={H} className="block select-none">
      {d.nodes.map((nd,k) => <g key={nd}><line x1={x(k)} x2={x(k)} y1="34" y2={H} stroke="#EDEDED" strokeDasharray="0"/><rect x={x(k)-48} y="8" width="96" height="24" rx="6" fill="#fff" stroke="#E5E5E5"/><text x={x(k)} y="24" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#171717">{nd}</text></g>)}
      {vis.length===0 && <text x={W/2} y={TOP+20} textAnchor="middle" fontSize="12" fill="#8F8F8F">Aucun message visible — réaffiche une interface ou déplie une procédure.</text>}
      {vis.map((k,row) => {
        const m = d.msgs[k];
        const [a,b] = m[2].split(' → ').map(s=>nodeIdx(d.nodes,s));
        const y = TOP + row*ROW + 18, x1 = x(a), x2 = x(b), dir = x2>x1?1:-1, c = ifcHex(m[0],'fg');
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
            <text x="12" y={y+4} fontSize="10.5" fill="#94A3B8" fontFamily="Geist Mono">{String(d.evidence?.[k]?.seq ?? k+1).padStart(2,'0')}</text>
            <text x="40" y={y+4} fontSize="10.5" fill="#64748B" fontFamily="Geist Mono">{fmtUtc(timeOf(d.evidence?.[k]))}</text>
            <rect x="128" y={y-7} width="34" height="14" rx="3" fill={ifcHex(m[0],'bg')}/><text x="145" y={y+3.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={c} fontFamily="Geist Mono">{String(m[0]).slice(0,6)}</text>
            {pstart && <text x="168" y={y+4} fontSize="10.5" fill="#334155" fontWeight="600">{String(pstart[0]).slice(0,7)}</text>}
            {timers && row>0 && (()=>{const a=timeOf(d.evidence?.[vis[row-1]]), b=timeOf(d.evidence?.[k]); return a!=null&&b!=null ? <text x={W-8} y={y+4} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="Geist Mono">+{fmtDuration(b-a)}</text> : null;})()}
            <line x1={x1} x2={x2 - dir*7} y1={y} y2={y} stroke={c} strokeWidth={on?2.5:1.2}/>
            <path d={`M${x2},${y} l${-dir*7},-3.5 l0,7 z`} fill={c}/>
            <text x={Math.min(x1,x2)+7} y={y-5} fontSize="11.5" fill={on?'#171717':'#333'} fontWeight={on?600:450}>{label}</text>
            {cause && <g><rect x={Math.max(x1,x2)+8} y={y-9} width={(m[5].length+7)*6.4} height="17" rx="4" fill="#FDEFEE" stroke="#F5C6C2"/><text x={Math.max(x1,x2)+14} y={y+3} fontSize="10.5" fill="#B42318" fontWeight="600">{m[4].replace(/^cause /,'')} {m[5]}</text></g>}
          </g>
        );
      })}
    </svg>
  );
}

function usePopover() {
  const [open,setOpen] = useState(false); const ref = useRef(null);
  useEffect(()=>{ if(!open) return; const down=e=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }; const key=e=>{ if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown',down); document.addEventListener('keydown',key); return ()=>{ document.removeEventListener('mousedown',down); document.removeEventListener('keydown',key); }; },[open]);
  return [open,setOpen,ref];
}
function LadderMore({children}) {
  return <div className="flex flex-wrap items-center gap-1 shrink-0 [&_button]:h-7">{children}</div>;
}
function LadderFilter({flow,value,onApply}) {
  const [open,setOpen,ref] = usePopover(); const [draft,setDraft] = useState(value); const [pq,setPq] = useState('');
  useEffect(()=>{ if(open) setDraft(value); },[open]);
  const opts = useMemo(()=>filterOptions(flow),[flow]);
  const toggle = (key,v) => setDraft(d=>({...d,[key]:d[key].includes(v)?d[key].filter(x=>x!==v):[...d[key],v]}));
  const active = filterActive(value);
  const H = ({children}) => <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1">{children}</div>;
  const sel = "h-7 w-full px-1.5 rounded border border-border bg-white text-[12px] outline-none focus:border-[var(--app-accent)]";
  return <div ref={ref} className="relative shrink-0">
    <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} className={`h-7 px-2 rounded-md border text-[12px] flex items-center gap-1.5 ${active?'border-[var(--app-accent)] text-[var(--app-accent)]':'border-border text-ink-2 hover:bg-surface-2'}`}>
      <I d="M3 5h18l-7 8v5l-4 2v-7z" c="w-3.5 h-3.5"/>Filter{active && <span aria-label="Filtres actifs" className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)]"/>}</button>
    {open && <div role="dialog" aria-label="Filtres du Ladder" className="absolute right-0 top-8 z-40 w-[300px] bg-white border border-border rounded-lg shadow-lg flex flex-col max-h-[420px] text-[12px] text-foreground">
      <div className="flex-1 overflow-auto scroll-thin p-3 space-y-3">
        <section><H>Procédures</H>
          <input aria-label="Rechercher une procédure" value={pq} onChange={e=>setPq(e.target.value)} placeholder="Rechercher…" className={sel+" mb-1.5"}/>
          <div className="flex gap-3 mb-1 text-[11.5px]"><button onClick={()=>setDraft(d=>({...d,procs:[]}))} className="text-[var(--app-accent)]">Tout sélectionner</button><button onClick={()=>setDraft(d=>({...d,procs:opts.procs}))} className="text-[var(--app-accent)]">Tout désélectionner</button></div>
          {opts.procs.filter(p=>p.toLowerCase().includes(pq.toLowerCase())).map(p=><label key={p} className="flex items-center gap-2 h-6 cursor-pointer"><input type="checkbox" checked={!draft.procs.includes(p)} onChange={()=>toggle('procs',p)}/><span className="truncate">{p}</span></label>)}
          {opts.procs.length===0 && <div className="text-muted-foreground">Aucune procédure.</div>}
        </section>
        <section><H>Messages</H><div className="space-y-1.5">
          <input aria-label="Nom de message" value={draft.text} onChange={e=>setDraft(d=>({...d,text:e.target.value}))} placeholder="Nom de message…" className={sel}/>
          <select aria-label="Type de message" value={draft.type} onChange={e=>setDraft(d=>({...d,type:e.target.value}))} className={sel}><option value="">Tous les types</option>{opts.types.map(x=><option key={x}>{x}</option>)}</select>
          {opts.dirs.length>0 && <select aria-label="Sens" value={draft.dir} onChange={e=>setDraft(d=>({...d,dir:e.target.value}))} className={sel}><option value="">UL et DL</option>{opts.dirs.map(x=><option key={x}>{x}</option>)}</select>}
          <div className="text-[11px] text-muted-foreground">Interfaces : boutons N2 / N3 / N4 de la barre.</div>
        </div></section>
        {opts.results.length>0 && <section><H>Résultats</H>{opts.results.map(r=><label key={r} className="flex items-center gap-2 h-6 cursor-pointer"><input type="checkbox" checked={!draft.results.includes(r)} onChange={()=>toggle('results',r)}/><VerdictBadge v={r}/></label>)}</section>}
      </div>
      <div className="shrink-0 flex justify-end gap-2 p-2 border-t border-border">
        <button onClick={()=>{const e=emptyFilter(); setDraft(e); onApply(e);}} className="h-7 px-2.5 rounded-md border border-border text-ink-2">Réinitialiser</button>
        <button onClick={()=>{onApply(draft); setOpen(false);}} className="h-7 px-3 rounded-md bg-[var(--app-accent)] text-white font-medium">Appliquer</button>
      </div>
    </div>}
  </div>;
}

function Detail({s,sel,setSel,lens,ui,onOpenSession}) {
  const { demo } = usePolarisMode(); const auth = useAuthMe();
  const [tab,setTab] = useState('Ladder');
  const [hidden,setHidden] = useState([]);
  const [collapsed,setCollapsed] = useState([]);
  const [ref,width] = useWidth();
  const [zoom,setZoom] = useState(1); const [timers,setTimers] = useState(false);
  const [mf,setMf] = useState(emptyFilter);
  useEffect(()=>{ setHidden([]); setCollapsed([]); setMf(emptyFilter()); },[s.id]);
  const ifs = [...new Set(s.d.msgs.map(m=>m[0]))];
  const shownIdx = useMemo(()=>visibleMessages(s.d,hidden,mf),[s.d,hidden,mf]); const shownSet = useMemo(()=>new Set(shownIdx),[shownIdx]);
  const step = dir => { const n=s.d.msgs.length; let k=sel; for(let i=0;i<n;i++){ k=(k+dir+n)%n; if(shownSet.has(k)) break; } setSel(k); };
  useEffect(()=>{ const f=e=>{ if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return; if(e.key==='ArrowDown'||e.key==='j'){e.preventDefault();step(1);} if(e.key==='ArrowUp'||e.key==='k'){e.preventDefault();step(-1);} if(e.key==='f'&&tab==='Ladder') ui.setFull(v=>!v); if(e.key==='Escape') ui.setFull(false); }; window.addEventListener('keydown',f); return ()=>window.removeEventListener('keydown',f); });
  const tb = "h-7 px-2 rounded-md text-[12px] flex items-center gap-1.5 border transition";
  const d = s.d, ex = d.links.filter(l=>l[5]==='EXACT').length;
  return (
    <section className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-3 border-b border-border">
        {s.detailErrors?.map(error => <div key={error.endpoint} role="alert" className="pt-1.5 text-[12px] text-danger">Détail indisponible · {error.endpoint} · HTTP {error.status}</div>)}
        <div className="min-h-[42px] flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          {['Ladder','Messages','Corrélation','Plan usager','Comparer'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-[42px] shrink-0 whitespace-nowrap text-[12.5px] border-b-2 ${tab===t?'border-[var(--app-accent)] text-foreground font-medium':'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>)}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {ifs.map(i=>{const off=hidden.includes(i); return <button key={i} aria-pressed={!off} onClick={()=>setHidden(off?hidden.filter(x=>x!==i):[...hidden,i])} title={off?`Afficher ${i}`:`Masquer ${i}`} className={`h-6 px-0.5 rounded-md border transition ${off?'opacity-35 border-transparent':'border-border bg-white'}`}><Tag i={i}/></button>;})}
          </div>
          <LadderFilter flow={d} value={mf} onApply={setMf}/>
          <LadderMore><button disabled={demo} onClick={()=>{window.location.href=apiPath(`/exports/callflow/${encodeURIComponent(s.id)}`);}} className={tb+" border-border"}>Exporter</button>{auth.data?.data?.role==='operator' && <button disabled={demo || s.cap==='—'} onClick={()=>{if(window.confirm('Télécharger cet extrait pcap ?')) window.location.href=apiPath(`/captures/${encodeURIComponent(s.cap)}/download`);}} className={tb+" border-border"}>PCAP</button>}
          <button onClick={()=>setZoom(z=>Math.max(0.6,+(z-0.2).toFixed(1)))} title="Zoom arrière" className={`${tb} border-border text-ink-2`}>−</button>
          <button onClick={()=>setZoom(1)} title="Ajuster à la largeur" className={`${tb} border-border text-ink-2 tabular-nums`}>{zoom===1?'Ajusté':`${Math.round(zoom*100)} %`}</button>
          <button onClick={()=>setZoom(z=>Math.min(3,+(z+0.2).toFixed(1)))} title="Zoom avant" className={`${tb} border-border text-ink-2`}>+</button>
          <button onClick={()=>setTimers(v=>!v)} aria-pressed={timers} title="Afficher les délais entre messages" className={`${tb} ${timers?'border-[var(--app-accent)] text-[var(--app-accent)]':'border-border text-ink-2'}`}>Timers</button>
          <button onClick={()=>step(-1)} title="Message précédent (↑)" className={`${tb} border-border text-ink-2 hover:bg-surface-2`}>↑</button>
          <button onClick={()=>step(1)} title="Message suivant (↓)" className={`${tb} border-border text-ink-2 hover:bg-surface-2`}>↓</button>
          {!ui.full && <button onClick={()=>ui.setGridHidden(v=>!v)} className={`${tb} border-border text-ink-2 hover:bg-surface-2`}>{ui.gridHidden?'Afficher le tableau':'Masquer le tableau'}</button>}
          <button onClick={()=>ui.setFull(v=>!v)} title="Plein écran (F)" className={`${tb} ${ui.full?'border-transparent bg-[var(--app-accent)] text-white':'border-border text-ink-2 hover:bg-surface-2'}`}><I d={ui.full?'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5':'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} c="w-3.5 h-3.5"/>{ui.full?'Quitter':'Plein écran'}</button>
</LadderMore>
          <span title={`${shownIdx.length} messages affichés sur ${d.msgs.length}`} className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground"><b className="text-foreground tabular-nums">{shownIdx.length}</b> {shownIdx.length>1?'messages':'message'}</span>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-auto scroll-thin">
        {tab==='Ladder' && <Ladder d={d} sel={sel} setSel={setSel} lens={lens} hidden={hidden} collapsed={collapsed} width={width} zoom={zoom} timers={timers} allowed={shownSet}/>}
        {tab==='Messages' && <table className="w-full text-[12.5px]"><tbody>{d.msgs.map((m,k)=>[m,k]).filter(([,k])=>shownSet.has(k)).map(([m,k])=>(
          <tr key={k} onClick={()=>setSel(k)} className={`cursor-pointer ${sel===k?'bg-[color-mix(in_oklab,var(--app-accent)_9%,white)]':'hover:bg-surface-2'}`}>
            <td className="h-7 px-4 border-b border-border-subtle font-mono text-[11.5px] text-subtle w-12">{available(d.evidence?.[k]?.seq ?? (demoMessageNumber(d,k)))}</td><td className="px-2 border-b border-border-subtle w-20"><Tag i={m[0]}/></td>
            <td className="px-2 border-b border-border-subtle">{m[1]}{m[3]&&<span className="text-muted-foreground"> · {m[3]}</span>}</td><td className="px-2 border-b border-border-subtle text-muted-foreground">{m[2]}</td>
            <td className="px-4 border-b border-border-subtle font-mono text-[11.5px] text-muted-foreground">{m[4]?`${m[4]} ${m[5]}`:''}</td></tr>))}</tbody></table>}
        {tab==='Corrélation' && <table className="w-full text-[12.5px]"><thead><tr>{['De','Vers','Clé','Messages','Statut'].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border">{h}</th>)}</tr></thead><tbody>{d.links.map((l,k)=>(
          <tr key={k}><td className="h-8 px-4 border-b border-border-subtle"><Tag i={l[2]}/></td><td className="px-4 border-b border-border-subtle"><Tag i={l[3]}/></td><td className="px-4 border-b border-border-subtle font-mono text-[12px]">{l[4]}</td><td className="px-4 border-b border-border-subtle font-mono text-[12px] text-muted-foreground">{l[0]===null?'—':l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun'}</td><td className="px-4 border-b border-border-subtle"><Stat s={l[5]}/></td></tr>))}</tbody></table>}
        {(tab==='Plan usager'||tab==='Comparer') && <div className="p-8 text-[13px] text-muted-foreground">{tab==='Plan usager' ? 'Volumes UL / DL par TEID, comparés aux règles N4 et aux rapports d’usage PFCP.' : 'Choisis une session réussie de même procédure pour aligner les deux flux et voir le point de bifurcation.'}</div>}
      </div>
    </section>
  );
}

function DecodeNode({k,v,path,open,toggle,q}) {
  const leaf = v==null || typeof v!=='object';
  const isOpen = open[path] ?? false;
  const text = leaf ? String(v) : '';
  const hit = q && (String(k).toLowerCase().includes(q) || text.toLowerCase().includes(q));
  const copy = e => { e.stopPropagation(); try { navigator.clipboard?.writeText(leaf?`${k}: ${text}`:`${k}: ${JSON.stringify(v)}`); } catch(err) {} };
  const hex = leaf && typeof v==='number' ? ` (0x${v.toString(16)})` : '';
  return <div>
    <div onClick={()=>!leaf&&toggle(path)} className={`group flex items-center gap-1 rounded px-1 ${leaf?'':'cursor-pointer'} hover:bg-muted ${hit?'bg-warning-soft':''}`}>
      <span className="w-3 text-subtle">{leaf?'':isOpen?'▾':'▸'}</span><span className="text-muted-foreground">{k}</span>
      {leaf ? <span className="text-foreground truncate">: {text}<span className="text-subtle">{hex}</span></span> : <span className="text-subtle">{Array.isArray(v)?`[${v.length}]`:`{${Object.keys(v).length}}`}</span>}
      <button onClick={copy} title="Copier nom et valeur" className="ml-auto opacity-0 group-hover:opacity-100 text-[11px] text-muted-foreground hover:text-foreground">copier</button>
    </div>
    {!leaf && isOpen && <div className="pl-3 border-l border-border ml-1.5">{Object.entries(v).map(([ck,cv])=><DecodeNode key={ck} k={ck} v={cv} path={`${path}.${ck}`} open={open} toggle={toggle} q={q}/>)}</div>}
  </div>;
}
function DecodeTree({tree}) {
  const [open,setOpen] = useState({}); const [q,setQ] = useState('');
  const all = {}; const walk=(v,p)=>{ if(v&&typeof v==='object'){ all[p]=true; Object.entries(v).forEach(([k,c])=>walk(c,`${p}.${k}`)); } };
  Object.entries(tree).forEach(([k,v])=>walk(v,k));
  const qq = q.trim().toLowerCase();
  const view = qq ? all : open;
  return <div className="rounded-md border border-border">
    <div className="flex items-center gap-1 p-1.5 border-b border-border">
      <input aria-label="Rechercher un champ" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un champ…" className="flex-1 min-w-0 h-6 px-1.5 rounded border border-border text-[11.5px] outline-none focus:border-[var(--app-accent)]"/>
      <button onClick={()=>setOpen(all)} className="h-6 px-1.5 rounded border border-border text-[11px] text-ink-2">Tout déplier</button>
      <button onClick={()=>setOpen({})} className="h-6 px-1.5 rounded border border-border text-[11px] text-ink-2">Tout replier</button>
    </div>
    <div className="p-1.5 font-mono text-[11.5px] leading-[1.7]">{Object.keys(tree).length ? Object.entries(tree).map(([k,v])=><DecodeNode key={k} k={k} v={v} path={k} open={view} toggle={p=>setOpen(o=>({...o,[p]:!o[p]}))} q={qq}/>) : <div className="text-muted-foreground px-1">Arbre de décodage vide.</div>}</div>
  </div>;
}

function Inspector({s,sel,role,lens,setLens,width,onHide}) {
  const [tab,setTab] = useState(()=>{ try { return localStorage.getItem('polaris-insp-tab')||'Décodage'; } catch(e) { return 'Décodage'; } });
  useEffect(()=>{ try { localStorage.setItem('polaris-insp-tab',tab); } catch(e) {} },[tab]);
  const d = s.d, m = d.msgs[Math.min(sel,d.msgs.length-1)];
  const evidence = d.evidence?.[Math.min(sel,d.msgs.length-1)];
  const operator=role==='operator'||role==='administrator';
  const identities=useSessionIdentities(s.session_id,operator);
  const eventQuery = useEvent(evidence?.event_id ?? evidence?.id); const provenance = useProvenance(evidence?.event_id ?? evidence?.id); const packetRef=provenance.data?.data?.packet_references?.[0]??evidence?.packet_references?.[0]??{}; const packetCapture=provenance.data?.data?.capture_id??evidence?.capture_id; const packetNumber=packetRef.packet_number??evidence?.seq; const packets = usePackets({capture_id:packetCapture,packet_number:packetNumber}, packetCapture!=null && packetNumber!=null); const dissection=usePacketDissection(packetCapture,packetNumber,operator&&tab==='Hex'); const rules = useCorrelationRules(); const versions = useVersion();
  const proof = provenance.data?.data ?? evidence ?? {};
  const ids=identities.data?.data??{};
  if (!m) return <aside className="p-4 text-muted-foreground">Non disponible</aside>;
  const shared = m[5] ? d.msgs.filter(x=>x[5]===m[5]).length : 0;
  return (
    <aside style={{width}} aria-label="Décodage" className="shrink-0 bg-white flex flex-col min-w-0 rounded-xl border border-border overflow-hidden">
      <div className="h-10 shrink-0 flex items-end gap-5 px-4 border-b border-border">
        {['Décodage','Preuves','Hex','Identité'].map(t => <button key={t} onClick={()=>setTab(t)} className={`h-9 text-[12.5px] border-b-2 ${tab===t?'border-[var(--app-accent)] text-foreground font-medium':'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>)}
        <button onClick={onHide} title="Masquer le panneau" className="ml-auto mb-2 w-7 h-7 rounded-md grid place-items-center text-subtle hover:bg-muted hover:text-foreground"><I d="M15 4v16M4 4h16v16H4z" c="w-3.5 h-3.5"/></button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-3 text-[12px]">
        {tab==='Décodage' && <div className="space-y-3">
          <div><div className="flex items-center gap-2"><Tag i={m[0]}/><span className="font-mono text-[11.5px] text-muted-foreground">message #{available(evidence?.seq ?? Math.min(sel,d.msgs.length-1)+1)}</span>{evidence?.decoding_status && <span className="ml-auto text-[11px] font-semibold text-muted-foreground border border-border rounded px-1">{String(evidence.decoding_status)}</span>}</div>
            <div className="mt-1 text-[13px] font-semibold text-foreground leading-snug">{m[1]}</div><div className="text-muted-foreground text-[12px]">{m[2]}</div></div>
          {eventQuery.isPending && evidence && <div className="text-muted-foreground">Chargement du décodage…</div>}
          {eventQuery.isError && <div role="alert" className="rounded-md border border-danger-line bg-danger-soft px-2 py-1.5 text-[11.5px] text-danger">Échec <span className="font-mono">GET {apiPath(`/events/${encodeURIComponent(String(evidence?.event_id ?? evidence?.id ?? ''))}`)}</span> → {eventQuery.error.status ? `HTTP ${eventQuery.error.status}` : 'réseau'}{eventQuery.error.code && eventQuery.error.code!=='HTTP_ERROR' ? ` · ${eventQuery.error.code}` : ''}{evidence?.decoded_ie_tree ? ' — arbre affiché depuis le callflow.' : ''}</div>}
          {(()=>{ const t = eventQuery.data?.data?.decoded_ie_tree ?? evidence?.decoded_ie_tree; return (eventQuery.data || t) ? <DecodeTree key={String(evidence?.event_id ?? sel)} tree={t&&typeof t==='object'?t:t==null?{}:{valeur:t}}/> : null; })()}
          {!eventQuery.data && !evidence?.decoded_ie_tree && <div className="rounded-md border border-border bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.9] text-ink-2">
            <div>▾ {m[1].split(' ')[0]} PDU</div>
            <div className="pl-4">▾ {m[1].split(' ').slice(1).join(' ')}</div>
            <div className="pl-8">ue : <span className="text-foreground">{s.ue}</span> <span className="text-subtle">(pseudonyme)</span></div>
            {m[3] && <><div className="pl-8">▾ NAS-PDU</div><div className="pl-12">message : <span className="text-foreground">{m[3]}</span></div>
              <div className="pl-12">identité : <span className="text-subtle">{operator?(ids.imsi??'—'):'masquée'}</span></div></>}
            {m[4] && <div className="pl-8">{m[4]} : <span className="text-warning">{m[5]}</span></div>}
          </div>}
          <div><Lbl>Informations UE</Lbl><dl className="grid grid-cols-[100px_1fr] gap-y-0.5 text-[11.5px]">
            {[['IMSI / SUPI',operator?ids.imsi:'masqué'],['Identifiant UE',s.ue],['Technologie',s.rat],['Cellule',s.cell],['PCI',s.pci],['EARFCN / ARFCN',s.arfcn ?? s.earfcn ?? s.nr_arfcn],['MME / AMF',s.serving_node],['PDU Session ID',s.pdu_session_id],['ID temporaires',operator?(ids.tmsi?.at(-1)?.value??ids.s_tmsi?.at(-1)?.value):'masqué']].map(([k,v])=><React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-mono truncate" title={String(available(v))}>{available(v)}</dd></React.Fragment>)}
          </dl></div>
          <details className="rounded-md border border-border"><summary className="px-2 h-7 flex items-center cursor-pointer text-[11.5px] font-medium text-ink-2">Métadonnées techniques</summary>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1 font-mono text-[11.5px] p-2 pt-0">
              <dt className="text-muted-foreground">capture_id</dt><dd>{available(proof.capture_id)}</dd><dt className="text-muted-foreground">seq</dt><dd>{available(proof.seq)}</dd>
              <dt className="text-muted-foreground">packet_number</dt><dd>{available(proof.packet_number)}</dd><dt className="text-muted-foreground">décodeurs</dt><dd>{decoderVersions(versions.data?.data?.decoders)}</dd>
            </dl></details>
          {m[5] && (isCause(m) ? <div className="rounded-md border border-danger-line bg-danger-soft p-3">
            <div className="flex items-center gap-2 font-medium text-danger"><I d="M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" c="w-4 h-4"/>Lentille de cause</div>
            <div className="text-muted-foreground mt-1"><span className="font-mono text-danger">{m[4].replace(/^cause /,'')} {m[5]}</span> — cause d'échec, pas une clé de corrélation. Présente dans {shared} message(s).</div>
            <button onClick={()=>setLens(lens===m[5]?null:m[5])} className={`mt-2 h-7 px-3 rounded-md text-[12px] font-medium ${lens===m[5]?'border border-border text-ink-2':'bg-danger text-white'}`}>{lens===m[5]?'Retirer le surlignage':'Surligner la cause'}</button>
          </div> : <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 font-medium text-foreground"><I d={ic.lens} c="w-4 h-4"/>Lentille de clé</div>
            <div className="text-muted-foreground mt-1"><span className="font-mono text-[11.5px] text-subtle">{m[4]}</span> <span className="font-mono text-warning">{m[5]}</span> apparaît dans {shared} message(s) de la session.</div>
            <button onClick={()=>setLens(lens===m[5]?null:m[5])} className={`mt-2 h-7 px-3 rounded-md text-[12px] font-medium ${lens===m[5]?'border border-border text-ink-2':'bg-[var(--app-accent)] text-white'}`}>{lens===m[5]?'Retirer le surlignage':'Surligner dans la session'}</button>
          </div>)}
        </div>}
        {tab==='Preuves' && <div className="space-y-2"><div>event_id : {available(proof.event_id ?? evidence?.id)} · seq : {available(proof.seq)}</div>{provenance.isError && <div>{provenance.error.message}</div>}{packets.data && <div>Paquets : {records(packets.data.data,'packets').length}</div>}<div>Règles : {rules.isError ? rules.error.message : JSON.stringify(rules.data?.data ?? [])}</div>{d.links.map((l,k)=>(
          <div key={k} className="rounded-md border border-border p-3"><div className="flex items-center gap-2"><Tag i={l[2]}/><span className="text-subtle">→</span><Tag i={l[3]}/><span className="ml-auto"><Stat s={l[5]}/></span></div>
          <div className="font-mono text-[11.5px] mt-2 text-ink-2">{l[4]}</div><div className="text-[11.5px] text-subtle mt-0.5">messages {l[0]===null?'—':l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun message N4'} · matched_rules : {JSON.stringify(l[6] ?? [])}</div></div>))}</div>}
        {tab==='Hex' && (!operator?<div>Rôle operator requis.</div>:dissection.isPending?<div>Chargement de la dissection tshark…</div>:dissection.isError?<div role="alert">Échec GET /packets/:capture_id/:packet_number/dissect → {dissection.error.status||'réseau'}</div>:<pre className="font-mono text-[11px] whitespace-pre-wrap">{dissection.data?.data?.dissection??'—'}</pre>)}
        {tab==='Identité' && <div><Lbl>Pseudonyme</Lbl><span className="font-mono">{s.ue}</span>{!operator?<div>Identités cachées pour le rôle viewer.</div>:<dl className="mt-3 grid grid-cols-[90px_1fr] gap-1">{[['IMSI',ids.imsi],['TMSI',ids.tmsi?.at(-1)?.value],['S-TMSI',ids.s_tmsi?.at(-1)?.value],['M-TMSI',ids.m_tmsi?.at(-1)?.value],['IMEI',ids.imei?.value],['MSISDN',ids.msisdn]].map(([k,v])=><React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v??'—'}</dd></React.Fragment>)}</dl>}</div>}
      </div>
    </aside>
  );
}


/* ------------------------------ ACCUEIL ------------------------------ */
const IFACES = ['N2','N3','N4','SBI','N6','S1-MME','S1-U','S5-U','S11','S5-C','S6a','Sxa/Sxb'];
const Dot = ({st}) => <span className={`w-[8px] h-[8px] rounded-full ${st==='ok'?'bg-success':st==='warn'?'bg-warning':st==='error'?'bg-danger':'bg-track'}`}/>;
const Bar = ({v,warn=70,crit=85}) => <div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${v>=crit?'bg-danger':v>=warn?'bg-warning':'bg-[var(--app-accent)]'}`} style={{width:`${v}%`}}/></div><span className="tabular-nums text-[12px] text-ink-2 w-9">{v} %</span></div>;
const fmtBytes = v => typeof v!=='number'?'—':v>=1024**3?`${(v/1024**3).toFixed(2)} GiB`:v>=1024**2?`${(v/1024**2).toFixed(1)} MiB`:v>=1024?`${(v/1024).toFixed(1)} KiB`:`${v} B`;
const Card = ({title,action,children,className=''}) => (
  <section className={`bg-white rounded-lg border border-border ${className}`}>
    <div className="h-11 px-4 flex items-center border-b border-border-subtle"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3>{action && <span className="ml-auto text-[12px] text-foreground font-medium cursor-pointer">{action}</span>}</div>
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
  ['POLARIS Monitor','Indicateurs par procédure et détection d\'écarts.','M4 20V10M10 20V4M16 20v-7M22 20H2','kpi'],
  ['POLARIS Live','Suivi en temps réel des sessions capturées.','M3 12h4l3-8 4 16 3-8h4','live'],
  ['Traffic','Débit, santé TCP, applications, congestion','M4 7h16M4 12h16M4 17h16','trafic'],
  ['POLARIS Nodes','Topologie et état des nœuds du réseau.','M12 5v4M5 19l4-5M19 19l-4-5M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM4 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM20 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z','nodes',true],
];
const Soon = () => <span className="text-[11px] font-medium text-subtle border border-border rounded px-1.5 py-[1px]">{t("Bientôt")}</span>;

// Status tone from real values only: unavailable → gray, never green by default.
function homeTone(key, v) {
  if (v === undefined || v === null || v === '') return 'unknown';
  const n = Number(v);
  if (key === 'capture') { const x = String(v).toLowerCase(); return ['capturing','running','active'].includes(x) ? 'ok' : ['degraded','warning','partial','starting','stopping'].includes(x) ? 'warn' : ['failed','error','stopped'].includes(x) ? 'fail' : 'unknown'; }
  if (!Number.isFinite(n)) return 'unknown';
  if (key === 'failures') return n > 0 ? 'fail' : 'ok';
  if (key === 'pending' || key === 'zero') return n > 0 ? 'warn' : 'ok';
  if (key === 'disk') return n < 10 ? 'fail' : n < 20 ? 'warn' : 'ok';
  return 'neutral';
}
const HOME_TONE = { ok: 'var(--success)', warn: 'var(--warning)', fail: 'var(--danger)', unknown: 'var(--subtle)', neutral: 'var(--muted-foreground)' };
const HOME_TONE_LABEL = { ok: 'Opérationnel', warn: 'Vigilance', fail: 'Échec', unknown: 'Inconnu', neutral: 'Information' };

function Home({setPage,onNew,hidden=[]}) {
  const { demo } = usePolarisMode();
  const health = useHealth(), metrics = useMetrics(), safety = useStorageSafety();
  const m = metrics.data?.data, h = health.data?.data;
  const go = tg => tg && setPage(tg);
  const mods = MODULES.filter(x=>(x[3]!=='trafic'||TRAFFIC_ENABLED) && isVisible(hidden,x[3]));
  const cols = mods.length <= 2 ? 'lg:grid-cols-2' : mods.length === 4 ? 'lg:grid-cols-4' : mods.length % 3 === 0 || mods.length === 5 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  const activity = demo ? [['Analyse','Run 5G #482 · Registration','il y a 3 min','sessions'],['KPI','Succès PDU Session · 15 min','il y a 12 min','kpi'],['Template','Échecs Attach par cellule','il y a 40 min','templates'],['Analyse','Run 4G #219 · E-RAB Setup','il y a 2 h','sessions']] : [];
  const status = [['capture','Capture','État de capture',m?.capture_state ?? h?.capture_state],['pending','Segments en attente','À importer',m?.pending_segments],['failures','Échecs ingestion','Import',m?.ingestion_failures],['ingested','Segments ingérés','Importés',m?.segments_ingested],['open','Segments ouverts','Capture en cours',m?.open_segments],['zero','Segments sans événement','Décodage',m?.zero_event_segments],['disk','Disque disponible','Stockage',safety.data?.data?.free_percent]];
  const conn = demo ? ['warn','Données de démo'] : health.isError ? ['fail',health.error.message] : health.isPending ? ['unknown','Connexion POLARIS…'] : ['ok','POLARIS connecté'];
  const sectionHead = (title, action) => <div className="h-11 px-4 flex items-center border-b border-border-subtle"><h2 className="text-[14px] font-semibold text-foreground">{t(title)}</h2><div className="ml-auto">{action}</div></div>;
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-surface-2">
      <div className="polaris-content-shell px-8 pt-7 pb-8 space-y-5">
        <header className="rounded-xl border border-border bg-white px-6 py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-foreground">{t("Bienvenue sur POLARIS")}</h1>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">{t("Analyse, diagnostic et supervision des sessions et du trafic réseau.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {HOME_ACTIONS.map(([k,n,d,tg])=>(
              <button key={k} disabled={!tg} onClick={()=>go(tg)} className="h-9 px-3.5 rounded-lg border border-border bg-white text-[13px] text-foreground flex items-center gap-2 hover:border-border-strong hover:bg-surface-2 transition disabled:text-subtle disabled:hover:bg-white disabled:cursor-not-allowed">
                <I d={d} c="w-4 h-4 text-muted-foreground"/>{t(n)}{!tg && <Soon/>}</button>))}
            <button onClick={()=>onNew?onNew():setPage('sessions')} className="h-9 px-4 rounded-lg bg-[var(--app-accent)] text-white text-[13px] font-medium flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:opacity-90 transition"><I d={ic.plus} c="w-4 h-4"/>{t("Nouvelle analyse")}</button>
          </div>
        </header>

        <section aria-label={t("Modules")}>
          <h2 className="text-[14px] font-semibold text-foreground mb-3">{t("Modules")}</h2>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-3`}>
            {mods.map(([n,desc,d,tg,adm])=>(
              <button key={n} disabled={!tg} onClick={()=>go(tg)} className="group text-left rounded-xl border border-border bg-white p-4 flex items-start gap-3.5 transition hover:border-[var(--app-accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:border-border">
                <span className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center ${tg?'bg-[var(--app-accent)] text-white':'bg-muted text-subtle'}`}><I d={d} c="w-[18px] h-[18px]"/></span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className={`text-[14.5px] font-semibold flex items-center gap-1.5 flex-wrap ${tg?'text-foreground':'text-muted-foreground'}`}>{t(n)}{adm && <span className="text-[10.5px] font-semibold uppercase tracking-wide rounded px-1.5 py-[1px] border border-border text-muted-foreground">{t("Administrateur")}</span>}</span>
                  <span className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">{t(desc)}</span>
                  <span className="mt-2.5 text-[12.5px] font-medium">{tg ? <span className="text-[var(--app-accent)] group-hover:underline">{t("Ouvrir →")}</span> : <Soon/>}</span>
                </span>
              </button>))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            {sectionHead("Activité récente", <button disabled className="text-[12.5px] text-subtle cursor-not-allowed">{t("Voir tout")}</button>)}
            {activity.length ? <div className="divide-y divide-border-subtle">{activity.map(([ty,n,w,tg])=>(
              <button key={n} onClick={()=>setPage(tg)} className="w-full text-left px-4 h-11 flex items-center gap-3 hover:bg-surface-2"><span className="text-[11.5px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-[1px] w-[72px] text-center">{t(ty)}</span><span className="text-[13px] text-foreground truncate">{n}</span><span className="ml-auto text-[12px] text-subtle shrink-0">{t(w)}</span></button>))}</div>
            : <div className="px-4 py-4 flex items-center gap-3">
                <span className="w-8 h-8 shrink-0 rounded-full bg-muted grid place-items-center text-subtle"><I d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" c="w-4 h-4"/></span>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-foreground">{t("Aucune activité pour l'instant")}</div><div className="text-[12px] text-muted-foreground">{t("Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.")}</div></div>
                <button onClick={()=>onNew?onNew():setPage('sessions')} className="shrink-0 text-[13px] font-medium text-foreground hover:underline">{t("Lancer une analyse →")}</button>
              </div>}
          </section>
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            {sectionHead("État de la plateforme", <button onClick={()=>setPage('nodes')} className="text-[12.5px] font-medium text-foreground hover:underline">{t("Voir la supervision")}</button>)}
            <div className="px-4 py-2 flex items-center gap-2 border-b border-border-subtle bg-surface-2 text-[12px]"><span className="w-2 h-2 rounded-full" style={{background:HOME_TONE[conn[0]]}}/><span className="text-muted-foreground truncate">{t(conn[1])}</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {status.map(([k,n,d,raw])=>{ const tone = homeTone(k,raw); return (
                <div key={k} className="px-4 h-12 flex items-center gap-2.5 border-b border-border-subtle sm:odd:border-r">
                  <span title={t(HOME_TONE_LABEL[tone])} aria-label={t(HOME_TONE_LABEL[tone])} className="w-2 h-2 rounded-full shrink-0" style={{background:HOME_TONE[tone]}}/>
                  <div className="min-w-0"><div className="text-[13px] text-foreground truncate">{t(n)}</div><div className="text-[12px] text-subtle truncate">{t(d)}</div></div>
                  <span title={`event_id=${available(m?.event_id)} · seq=${available(m?.seq)}`} className="ml-auto text-[13px] font-medium tabular-nums text-foreground">{available(raw)}</span>
                </div>); })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROBE MANAGER : liste des sondes, puis fiche détaillée ---------------- */
const PROBE_TABS = ['Général','Live Capture','Stockage et ingestion','Actions'];

function ProbeDetails({ node, onBack }) {
  const { demo } = usePolarisMode();
  const auth = useAuthMe(); const health = useHealth();
  const metrics = useMetrics(); const safety = useStorageSafety();
  const resources = useProbeResources(node.id ?? node.n);
  const runtime = useInterfaceRuntime();
  const [tab,setTab] = useState(PROBE_TABS[0]);
  const [target,setTarget] = useState(''); const [actionError,setActionError] = useState('');
  const capture = useCaptureAction(auth.data?.data?.role, health.data?.data?.coordination_open);
  const doCapture = (action,id) => { if (!window.confirm('Confirmer cette action de capture ?')) return; capture.mutate({action,id,target,confirmed:true},{onError:e=>setActionError(e.message)}); };
  const failure = (query,path) => query.isError ? `GET /api/v1${path} → ${query.error?.status ? `HTTP ${query.error.status}` : 'erreur réseau'}` : null;
  const raw = node.raw ?? {};
  const lifecycle = available(raw.lifecycle_state ?? raw.lifecycle ?? raw.state ?? raw.probe_state);
  const captureState = available(raw.capture_state ?? metrics.data?.data?.capture_state ?? health.data?.data?.capture_state);
  const storage = safety.data?.data ?? {}, filesystem = storage.filesystem ?? {};
  const freePercent = typeof storage.free_percent==='number' ? storage.free_percent : typeof filesystem.usage_percent==='number' ? Math.max(0,100-filesystem.usage_percent) : null;
  const diskAvailable = freePercent==null && filesystem.available_bytes==null ? null : `${freePercent==null?'—':freePercent.toFixed(2)+' %'} · ${fmtBytes(filesystem.available_bytes)} libres`;
  const online = node.st==='ok' || node.st==='warn';
  const operator = auth.data?.data?.role==='operator' || auth.data?.data?.role==='administrator';
  const ifaceRows = (() => {
    const scoped = records(resources.probeInterfaces.data?.data,'interfaces'), global = records(resources.interfaces.data?.data,'interfaces');
    const base = [...new Map([...global,...scoped].map(x => [String(x.name ?? x.interface ?? '—'), { ...global.find(g => String(g.name ?? g.interface ?? '—') === String(x.name ?? x.interface ?? '—')), ...x }])).values()];
    const rt = records(runtime.data?.data,'interfaces');
    return base.map(x => {
      const name = String(x.name ?? x.interface ?? '—');
      const r = rt.find(y => String(y.interface ?? y.name ?? '') === name) ?? {};
      return { name, protocol: x.protocol ?? r.protocol ?? null, source: x.device ?? x.bridge ?? r.device ?? x.capture_point ?? null,
               bpf: x.bpf_filter ?? x.filter ?? r.bpf_filter ?? null, active: typeof r.active==='boolean' ? r.active : null };
    });
  })();
  const captures = records(resources.captures.data?.data,'captures');
  const running = captures.find(c => ['CAPTURING','STARTING','RUNNING'].includes(String(c.state ?? c.status ?? '').toUpperCase())
    && String(c.probe_id ?? c.probe ?? c.node ?? '') === String(node.id ?? node.n));
  const row = (label,value) => <div className="flex justify-between gap-4 border-b border-border-subtle py-1.5 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono text-[12px] text-foreground text-right truncate" title={String(value)}>{value}</span></div>;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <button type="button" onClick={onBack} className="h-8 px-3 rounded-md border border-border bg-white text-[12.5px] text-ink-2 hover:bg-surface-2">← Sondes</button>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-mono text-[15px] font-semibold text-foreground truncate">{node.n}</h2>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2"><Dot st={node.st}/>{online ? 'En ligne' : 'Hors ligne'}</span>
          </div>
          <div className="text-[11.5px] text-subtle mt-0.5">{available(node.role)} · {available(node.info)} · ID {available(node.id ?? node.n)}</div>
        </div>
        <div className="ml-auto text-[11.5px] text-muted-foreground">Rôle {available(auth.data?.data?.role)} · gestion des interfaces réservée à operator</div>
      </div>
      <div role="tablist" aria-label="Fiche sonde" className="flex gap-1 border-b border-border overflow-x-auto scroll-thin">
        {PROBE_TABS.map(x => <button key={x} role="tab" aria-selected={tab===x} onClick={()=>setTab(x)} className={`relative shrink-0 h-10 px-3 text-[13px] ${tab===x?'text-foreground font-semibold':'text-muted-foreground hover:text-foreground'}`}>{x}{tab===x && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[var(--app-accent)]"/>}</button>)}
      </div>
      <div role="tabpanel" aria-label={tab} className="space-y-5">
        {tab==='Général' && <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Identité et état">
            <div className="p-4 text-[12.5px]">
              {row('Nom',available(node.n))}{row('ID',available(node.id ?? node.n))}{row('Type',available(node.role))}{row('Hôte',available(node.info))}
              {row('Version logicielle',`${available(node.ver)}${node.exp && String(node.ver).includes(node.exp) ? ' · ✓ attendue' : ''}`)}
              {row('État',online ? 'En ligne' : 'Hors ligne')}{row('Dernier battement',available(node.seen))}
              {row('État du cycle de vie',lifecycle)}{row('État de capture',captureState)}
            </div>
            {!demo && (resources.probe.isError || health.isError) && <div className="px-4 pb-4">{failure(resources.probe,'/probes/'+String(node.id ?? node.n)) ?? failure(health,'/health')}</div>}
          </Card>
          <Card title="Télémétrie de la sonde">
            <div className="p-4 space-y-3 text-[12.5px]">
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">CPU</span>{node.cpu==null ? <span className="text-faint">—</span> : <Bar v={Math.round(node.cpu)}/>}</div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">RAM</span>{node.memoryBytes==null ? <span className="text-faint">—</span> : <span className="font-mono text-[12px]">{fmtBytes(node.memoryBytes)}<span className="text-subtle"> · anon {fmtBytes(node.memoryAnonBytes)} · file {fmtBytes(node.memoryFileBytes)}</span></span>}</div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Disque</span>{node.disk==null ? <span className="text-faint">—</span> : <div className="flex items-center gap-2"><Bar v={Math.round(node.disk)} warn={95} crit={99}/><span className="text-[11px] text-subtle">{fmtBytes(node.diskFreeBytes)} libres · seuils 95 / 99 %</span></div>}</div>
              <div className="pt-1 border-t border-border-subtle">{row('Disque disponible (plateforme)',available(diskAvailable))}{row('Segments ingérés',available(metrics.data?.data?.segments_ingested))}{row('Échecs ingestion',available(metrics.data?.data?.ingestion_failures))}</div>
            </div>
            {(safety.isError || metrics.isError) && <div className="px-4 pb-4">{failure(safety,'/storage/safety') ?? failure(metrics,'/metrics')}</div>}
          </Card>
        </div>
        <Card title="Interfaces et points de capture">
          <table className="w-full text-[12.5px]"><thead><tr>{['Interface','Protocole','Source de capture','Filtre BPF','Disponibilité'].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border-subtle">{h}</th>)}</tr></thead>
            <tbody>{ifaceRows.map(x=><tr key={x.name} className="hover:bg-surface-2"><td className="h-10 px-4 border-b border-border-subtle"><InterfaceBadge name={x.name}/></td><td className="px-4 border-b border-border-subtle text-[12px] text-ink-2">{available(x.protocol)}</td><td className="px-4 border-b border-border-subtle"><TechnicalValue value={x.source}/></td><td className="px-4 border-b border-border-subtle"><BpfFilterDisplay filter={x.bpf}/></td>
              <td className="px-4 border-b border-border-subtle"><AvailabilityStatus active={x.active}/></td></tr>)}
              {!ifaceRows.length && <tr><td colSpan="5" className="p-4 text-subtle">{resources.probeInterfaces.isPending || resources.interfaces.isPending ? 'Connexion POLARIS…' : 'Aucune interface renvoyée par /probes/{id}/interfaces ni /interfaces'}</td></tr>}
            </tbody></table>
          <div className="px-4 py-3 text-[11.5px] text-subtle">{ifaceRows.length ? (records(resources.probeInterfaces.data?.data,'interfaces').length ? 'Liste fournie par /probes/{id}/interfaces · disponibilité par /interfaces/runtime.' : 'Liste fournie par /interfaces · disponibilité par /interfaces/runtime.') : (failure(resources.probeInterfaces,'/probes/'+String(node.id ?? node.n)+'/interfaces') ?? failure(resources.interfaces,'/interfaces'))}</div>
        </Card>
        </>}
        {tab==='Live Capture' && <LiveCapture probe={node}/>}
        {tab==='Stockage et ingestion' && <Card title="Stockage et ingestion">
          <div className="p-4 space-y-3 text-[12.5px]">{[['Disque disponible',diskAvailable],['Segments ingérés',metrics.data?.data?.segments_ingested],['Échecs ingestion',metrics.data?.data?.ingestion_failures],['Segments en attente',metrics.data?.data?.pending_segments],['Segments ouverts',metrics.data?.data?.open_segments]].map(([label,value])=><div key={label} className="flex justify-between border-b border-border-subtle py-1.5 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono text-[12px]">{available(value)}</span></div>)}</div>
          {(safety.isError || metrics.isError) && <div className="px-4 pb-4 text-danger">{failure(safety,'/storage/safety') ?? failure(metrics,'/metrics')}</div>}
          <div className="px-4 py-3 text-[11.5px] text-subtle">Endpoints plateforme : /storage/safety et /metrics.</div>
        </Card>}
        {tab==='Actions' && <Card title="Actions sur la sonde">
          <div className="p-4 space-y-4 text-[12.5px]">
            {operator ? <div className="space-y-2">
              <Lbl>Capture</Lbl>
              <div className="flex items-center gap-2 flex-wrap">
                <input aria-label="Cible de capture" disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Cible de capture" className="h-8 px-3 border border-border rounded-md text-[12.5px]"/>
                <button type="button" disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)||!target||capture.isPending} onClick={()=>doCapture('validate')} className="h-8 px-3 rounded-md border border-border bg-white text-[12.5px] text-ink-2 disabled:opacity-50">Valider la capture</button>
                <button type="button" disabled={!canCapture(auth.data?.data?.role,health.data?.data?.coordination_open)||!target||capture.isPending} onClick={()=>doCapture('start')} className="h-8 px-3 rounded-md bg-[var(--app-accent)] text-white text-[12.5px] font-medium disabled:opacity-50">Démarrer la capture</button>
                <button type="button" disabled={!running||capture.isPending} onClick={()=>doCapture('stop',running?.id ?? running?.capture_id)} className="h-8 px-3 rounded-md border border-danger-line bg-white text-[12.5px] text-danger disabled:opacity-50">Arrêter la capture</button>
              </div>
              {actionError && <div role="alert" className="text-[12px] text-danger">{actionError}</div>}
              {!health.data?.data?.coordination_open && <div className="text-[11.5px] text-warning">coordination_open absent de /health : actions de capture désactivées.</div>}
            </div> : <div className="text-[12px] text-muted-foreground">Actions de capture réservées au rôle operator.</div>}
            <div><Lbl>Cycle de vie</Lbl><div className="text-[12px] text-subtle">Non disponible : backend à venir (démarrer, arrêter, redémarrer la sonde).</div></div>
          </div>
        </Card>}
      </div>
      <div className="text-[11.5px] text-subtle">{demo ? 'Données de démo' : 'POLARIS'}</div>
    </div>
  );
}

function Nodes({ initialOpen = null } = {}) {
  const { demo } = usePolarisMode(); const probes = useProbes(); const auth = useAuthMe();
  const metrics = useMetrics(); const safety = useStorageSafety(); const version = useVersion();
  const [open,setOpen] = useState(initialOpen);
  const [registering,setRegistering] = useState(false);
  const [menu,setMenu] = useState(null);
  const [managing,setManaging] = useState(null);
  const raw = records(probes.data?.data, 'probes');
  const nodes = raw.map((n,i)=>({ ...(demo ? n : toLegacyProbe(n,i,metrics.data?.data,safety.data?.data,version.data?.data?.backend_api)), raw:n }));
  const current = open==null ? null : nodes.find(n=>n.n===open) ?? null;
  const failure = (query,path) => query.isError ? `GET /api/v1${path} → ${query.error?.status ? `HTTP ${query.error.status}` : 'erreur réseau'}` : null;
  if (current) return <ProbeDetails node={current} onBack={()=>setOpen(null)}/>;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="text-[13px] text-muted-foreground">{failure(probes,'/probes') ?? `${nodes.length} sondes enregistrées · POLARIS`}</div>
        <div className="ml-auto text-[11.5px] text-muted-foreground">Rôle {available(auth.data?.data?.role)} · gestion des interfaces réservée à operator</div>
        <button type="button" onClick={()=>setRegistering(true)} className="h-8 px-3 rounded-md bg-[var(--app-accent)] text-white text-[12px] font-medium">Ajouter une sonde</button>
      </div>
      <Card title="Sondes">
        <table className="w-full text-[12.5px]">
          <thead><tr>{['Sonde','Rôle','État','Version servie','CPU','Mémoire','Disque','Dernier contact',''].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border-subtle">{h}</th>)}</tr></thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n.n} onClick={()=>setOpen(n.n)} className="cursor-pointer hover:bg-surface-2">
                <td className="h-11 px-4 border-b border-border-subtle"><div className="font-mono text-[12px] text-foreground">{n.n}</div><div className="text-[11.5px] text-subtle">{n.info}</div><InterfaceStrip names={n.interfaces ?? n.connected_interfaces}/></td>
                <td className="px-4 border-b border-border-subtle text-ink-2">{n.role}</td>
                <td className="px-4 border-b border-border-subtle"><span className="inline-flex items-center gap-1.5"><Dot st={n.st}/>{n.st==='ok'?'Opérationnel':n.st==='warn'?'Vigilance':'—'}</span></td>
                <td className="px-4 border-b border-border-subtle"><span className="font-mono text-[11.5px]">{n.ver}</span>{n.exp && n.ver.includes(n.exp) && <span className="ml-1.5 text-[11px] text-success">✓ attendue</span>}</td>
                <td className="px-4 border-b border-border-subtle">{n.cpu==null?<span className="text-faint">—</span>:<Bar v={Math.round(n.cpu)}/>}</td>
                <td className="px-4 border-b border-border-subtle">{n.memoryBytes==null?<span className="text-faint">—</span>:<div><div className="font-mono text-[11.5px]">{fmtBytes(n.memoryBytes)}</div><div className="text-[11px] text-subtle mt-0.5">anon {fmtBytes(n.memoryAnonBytes)} · file {fmtBytes(n.memoryFileBytes)}</div></div>}</td>
                <td className="px-4 border-b border-border-subtle">{n.disk==null?<span className="text-faint">—</span>:<div><Bar v={Math.round(n.disk)} warn={95} crit={99}/><div className="text-[11px] text-subtle mt-0.5">{fmtBytes(n.diskFreeBytes)} libres · seuils 95 / 99 %</div></div>}</td>
                <td className="px-4 border-b border-border-subtle text-muted-foreground">{n.seen}</td>
                <td className="relative px-4 border-b border-border-subtle text-right"><button type="button" aria-label={`Actions ${n.n}`} onClick={event=>{event.stopPropagation();setMenu(menu===n.n?null:n.n);}} className="h-8 w-8 rounded-md text-[18px] leading-none hover:bg-muted">⋯</button>{menu===n.n&&<><button type="button" aria-label="Fermer le menu" onClick={event=>{event.stopPropagation();setMenu(null);}} className="fixed inset-0 z-40 cursor-default"/><div className="absolute right-3 top-9 z-50 w-52 rounded-md border border-border bg-white py-1 text-left shadow-lg"><button type="button" onClick={event=>{event.stopPropagation();setOpen(n.n);setMenu(null);}} className="w-full px-3 py-2 text-[12.5px] hover:bg-surface-2">Détails</button><button type="button" onClick={event=>{event.stopPropagation();setManaging({mode:'edit',node:n});setMenu(null);}} className="w-full px-3 py-2 text-[12.5px] hover:bg-surface-2">Modifier</button><button type="button" onClick={event=>{event.stopPropagation();setManaging({mode:'software',node:n});setMenu(null);}} className="w-full px-3 py-2 text-[12.5px] hover:bg-surface-2">Mettre à jour le logiciel</button><div className="my-1 border-t border-border"/><button type="button" onClick={event=>{event.stopPropagation();setManaging({mode:'delete',node:n});setMenu(null);}} className="w-full px-3 py-2 text-[12.5px] text-danger hover:bg-danger-soft">Supprimer</button></div></>}</td>
              </tr>
            ))}
            {!nodes.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-subtle">{probes.isPending ? 'Connexion au Node Manager…' : failure(probes,'/probes') ? `${failure(probes,'/probes')} · nouvelle tentative dans 5 s` : 'Aucune sonde renvoyée par /probes'}</td></tr>}
          </tbody>
        </table>
      </Card>
      {registering && <ProbeRegistration auth={auth.data?.data} backendVersion={version.data?.data?.backend_api} onClose={()=>setRegistering(false)}/>}
      {managing && <ProbeManagement mode={managing.mode} node={managing.node} auth={auth.data?.data} onClose={()=>setManaging(null)}/>}
      <div className="text-[11.5px] text-subtle">{demo ? "Données de démo" : "POLARIS"}</div>
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

function QueryLibrary({saved,onNew,onOpen,onDisplayAll,displayingAll=false}) {
  const [q,setQ] = useState(''); const [flt,setFlt] = useState('Toutes');
  const list = saved.filter(x=>(flt==='Toutes'||(flt==='Favoris'?x.fav:x.shared)) && x.n.toLowerCase().includes(q.toLowerCase()));
  const empty = saved.length===0 ? 'Aucune requête enregistrée.' : q ? `Aucune requête ne correspond à « ${q} ».` : flt==='Favoris' ? 'Aucune requête en favori.' : flt==='Partagées' ? 'Aucune requête partagée.' : 'Aucune requête.';
  const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-1';
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="w-full px-8 py-6 space-y-5">
        <header className="rounded-xl border border-border bg-white px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0"><div className="text-[12px] font-medium text-muted-foreground">POLARIS Analyzer</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-0.5">Requêtes</h1>
            <div className="text-[13px] text-muted-foreground mt-1">Consulte et lance tes requêtes. La création s’ouvre dans un nouvel onglet.</div></div>
          <div className="ml-auto flex items-center gap-2">
            {onDisplayAll && <button onClick={onDisplayAll} disabled={displayingAll} className={`h-9 px-4 rounded-lg border border-border bg-white text-foreground text-[13px] font-medium hover:border-[var(--app-accent)] disabled:opacity-50 ${focus}`}>{t("Afficher toutes les sessions")}</button>}
            <button onClick={()=>onNew()} className={`h-9 px-4 rounded-lg bg-[var(--app-accent)] text-white text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 ${focus}`}><I d={ic.plus} c="w-4 h-4"/>Nouvelle requête</button>
          </div>
        </header>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-10 rounded-lg border border-border bg-white flex items-center gap-2.5 px-3 focus-within:border-[var(--app-accent)] focus-within:ring-2 focus-within:ring-[var(--app-accent)]/15"><I d={ic.search} c="w-4 h-4 text-subtle shrink-0"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher une requête…" aria-label="Rechercher une requête" className="flex-1 outline-none text-[13px] bg-transparent text-foreground placeholder:text-subtle"/></div>
          <div role="tablist" className="flex rounded-lg border border-border p-[3px] bg-white">{['Toutes','Favoris','Partagées'].map(f=><button key={f} role="tab" aria-selected={flt===f} onClick={()=>setFlt(f)} className={`h-8 px-3.5 rounded-md text-[13px] transition-colors ${focus} ${flt===f?'bg-[var(--app-accent)] text-white font-semibold':'text-muted-foreground hover:text-foreground hover:bg-surface-2'}`}>{f}</button>)}</div>
        </div>
        <section>
          <div className="flex items-baseline gap-3 mb-2.5"><h2 className="text-[15px] font-semibold text-foreground">Démarrer depuis un modèle</h2><span className="text-[12.5px] text-muted-foreground">Crée une nouvelle requête préconfigurée</span></div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {STARTERS.map(([tt,d,c]) => (
              <button key={tt} onClick={()=>onNew(mkDraft({tpl:'Parcourir',conds:c.map(x=>[x[0],x[1],'=']),name:tt,group:c[0][0]==='Résultat'?'Cause':'Résultat'}),tt)} className={`group h-full flex flex-col text-left bg-white rounded-xl border border-border hover:border-[var(--app-accent)] hover:bg-surface-2/50 px-4 py-3.5 transition-colors ${focus}`}>
                <div className="flex items-center gap-2"><span data-cond={conditionTone(c[0][0],c[0][1])} className="polaris-cond w-7 h-7 shrink-0 rounded-md border grid place-items-center"><I d={ic.plus} c="w-3.5 h-3.5"/></span><span className="text-[14px] font-semibold text-foreground">{tt}</span></div>
                <div className="text-[12.5px] text-muted-foreground mt-2 leading-snug flex-1">{d}</div>
                <div className="flex flex-wrap gap-1 mt-3">{c.map(x=><ConditionBadge key={x[1]} field={x[0]} value={x[1]}/>)}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 h-12 flex items-center gap-3 border-b border-border"><h2 className="text-[15px] font-semibold text-foreground">Requêtes enregistrées</h2><span className="text-[12.5px] text-muted-foreground">Rouvrir une requête existante</span><span className="ml-auto text-[12px] font-medium text-muted-foreground tabular-nums">{list.length} requête{list.length>1?'s':''}</span></div>
          <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-[13px]">
            <thead><tr>{[['',''],['Nom',''],['Gabarit',''],['Portée',''],['Conditions',''],['Dernière exécution',''],['Résultats','text-right'],['','']].map(([h,a],k)=><th key={k} className={`h-9 px-4 font-semibold text-[12px] text-muted-foreground bg-surface-2 border-b border-border whitespace-nowrap ${a||'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody>
              {list.length===0 && <tr><td colSpan={8} className="h-14 px-5 text-[13px] text-muted-foreground">{empty}{saved.length===0 && <button onClick={()=>onNew()} className="ml-2 font-medium text-[var(--app-accent)] hover:underline">Nouvelle requête →</button>}</td></tr>}
              {list.map(x => (
                <tr key={x.n} tabIndex={0} onClick={()=>onOpen(x)} onKeyDown={ev=>{ if(ev.key==='Enter') onOpen(x); }} className="cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 outline-none group">
                  <td className="h-10 pl-4 border-b border-border-subtle w-8" title={x.fav?'Favori':''}><I d={ic.star} c={`w-3.5 h-3.5 ${x.fav?'text-warning':'text-faint'}`}/></td>
                  <td className="px-4 border-b border-border-subtle max-w-[320px]"><span className="flex items-center gap-2 min-w-0"><span title={x.n} className="truncate font-semibold text-foreground group-hover:text-[var(--app-accent)]">{x.n}</span>{x.shared && <span className="shrink-0 text-[11px] h-5 inline-flex items-center rounded-md border border-border px-1.5 text-muted-foreground">partagée</span>}</span></td>
                  <td className="px-4 border-b border-border-subtle text-muted-foreground whitespace-nowrap">{x.g}</td>
                  <td className="px-4 border-b border-border-subtle font-mono text-[11.5px] text-muted-foreground whitespace-nowrap">{x.p}</td>
                  <td className="px-4 py-1.5 border-b border-border-subtle"><span className="flex flex-wrap gap-1">{x.c.map((y,k)=><ConditionBadge key={k} field={y[0]} value={y[1]} op={y[2]||'='}/>)}</span></td>
                  <td className="px-4 border-b border-border-subtle text-ink-2 whitespace-nowrap">{x.last}</td>
                  <td className="px-4 border-b border-border-subtle text-right tabular-nums font-medium text-foreground">{x.r==null||x.r===''?<span className="text-subtle" title="Résultat indisponible">—</span>:x.r}</td>
                  <td className="px-4 border-b border-border-subtle text-right w-24"><span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--app-accent)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">Ouvrir<I d={ic.chev} c="w-3.5 h-3.5 -rotate-90"/></span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
        <div className="text-[11.5px] text-subtle">local à ce navigateur</div>
      </div>
    </div>
  );
}

function QSec({n,title,sub,children}) {
  const [open,setOpen] = useState(true);
  return (
    <section className="bg-white rounded-lg border border-border">
      <button onClick={()=>setOpen(!open)} className="w-full px-5 h-11 flex items-center gap-3 text-left">
        <span className="w-5 h-5 rounded-full bg-muted text-[11px] font-semibold grid place-items-center text-ink-2">{n}</span>
        <span className="text-[13px] font-semibold">{title}</span><span className="text-[11.5px] text-subtle">{sub}</span>
        <I d={ic.chev} c={`w-3.5 h-3.5 ml-auto text-subtle transition ${open?'':'-rotate-90'}`}/>
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
      <div className="w-full px-8 py-6 space-y-3">
        <div className="flex items-end gap-4 pb-1">
          <div><div className="text-[12px] text-muted-foreground">POLARIS Analyzer · Requête</div>
            <input value={draft.name} onChange={e=>up({name:e.target.value})} placeholder="Nouvelle requête" className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-1 bg-transparent outline-none w-[520px] placeholder:text-foreground"/></div>
          <span className="ml-auto text-[12px] text-muted-foreground">{dirty && <span className="mr-3 inline-flex items-center gap-1.5 text-warning"><span className="w-1.5 h-1.5 rounded-full bg-warning"/>Modifications non enregistrées</span>}Aperçu : <b className="text-foreground tabular-nums">{demo ? count : '—'}</b> sessions</span>
        </div>
        <QSec n={1} title="Gabarit" sub="ce que la requête retourne">
          <div className="grid grid-cols-4 gap-2">{TPLS.map(([x,d]) => <button key={x} onClick={()=>up({tpl:x})} className={`text-left rounded-md border px-3 py-2 transition ${draft.tpl===x?'border-[var(--app-accent)] ring-1 ring-[var(--app-accent)]':'border-border hover:border-border-strong'}`}><div className="text-[13px] font-medium uppercase tracking-wide">{x}</div><div className="text-[11.5px] text-subtle mt-0.5">{d}</div></button>)}</div>
        </QSec>
        <QSec n={2} title="Portée" sub="run, captures ou fenêtre horaire">
          <div className="flex flex-wrap gap-2">{(demo ? SCOPES : scopes.map(x=>String(x.id))).map(x => <button key={x} onClick={()=>up({scope:x})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.scope===x?'border-[var(--app-accent)] bg-[var(--app-accent)] text-white':'border-border text-ink-2 hover:border-border-strong'}`}>{x}</button>)}</div>
        </QSec>
        <QSec n={3} title="Conditions" sub="champ, opérateur, valeur">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">Combinaison
              <div className="flex rounded-md border border-border p-[2px]">{['ET','OU'].map(j=><button key={j} onClick={()=>up({join:j})} className={`h-6 px-2.5 rounded-[4px] text-[11.5px] ${draft.join===j?'bg-[var(--app-accent)] text-white font-medium':'text-muted-foreground'}`}>{j}</button>)}</div>
              <span className="text-subtle">· NON via l’opérateur ≠</span></div>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {draft.conds.length===0 && <span className="text-[12.5px] text-subtle self-center">Aucune condition : toutes les sessions de la portée.</span>}
              {draft.conds.map((c,i) => <span key={i} className="inline-flex items-center h-8 rounded-md border border-border text-[12.5px] overflow-hidden">{i>0 && <span className="px-2 h-full flex items-center text-[11px] font-semibold text-subtle border-r border-border">{draft.join}</span>}<ConditionBadge field={c[0]} value={c[1]} op={c[2]||'='} size="md" className="rounded-none border-0 pr-0"><button onClick={()=>up({conds:draft.conds.filter((_,j)=>j!==i)})} aria-label="Retirer" className="w-7 h-full grid place-items-center opacity-70 hover:opacity-100 hover:text-danger"><I d={ic.x} c="w-3.5 h-3.5"/></button></ConditionBadge></span>)}
            </div>
            <div className="flex items-center gap-2">
              <select value={f} onChange={e=>{setF(e.target.value); setV(fieldList.find(x=>x[0]===e.target.value)[1][0] || '');}} className="h-8 rounded-md border border-border text-[12.5px] px-2 bg-white">{fieldList.map(x=><option key={x[0]} disabled={idField(x[0]) && x[0]==='IMSI' && role!=='operator'}>{x[0]}</option>)}</select>
              <select value={op} onChange={e=>setOp(e.target.value)} className="h-8 rounded-md border border-border text-[12.5px] px-2 bg-white"><option>=</option><option>≠</option></select>
              <input value={v} onChange={e=>setV(e.target.value)} list="polaris-filter-values" className="h-8 rounded-md border border-border text-[12.5px] px-2 bg-white min-w-[180px]"/><datalist id="polaris-filter-values">{vals.map(x=><option key={x} value={x}/>)}</datalist>
              <button onClick={()=>up({conds:[...draft.conds,[f,v,op]]})} className="h-8 px-3 rounded-md border border-border text-[12.5px] hover:bg-surface-2 flex items-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter</button>
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-subtle"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator</span>
            </div>
          </div>
        </QSec>
        <QSec n={4} title="Regrouper par" sub="facultatif">
          <div className="flex flex-wrap gap-2">{!demo && <span>Non disponible : backend à venir</span>}{GROUPS.map(g=><button disabled={!demo && g!=='Aucun'} key={g} onClick={()=>up({group:g})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.group===g?'border-[var(--app-accent)] text-foreground ring-1 ring-[var(--app-accent)]':'border-border text-muted-foreground hover:border-border-strong'}`}>{g}</button>)}</div>
        </QSec>
        <section className="bg-white rounded-lg border border-border px-5 h-14 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-muted text-[11px] font-semibold grid place-items-center text-ink-2">5</span><span className="text-[13px] font-semibold mr-3">Actions</span>
          {err && <span className="text-[12px] text-danger">{err}</span>}
          <button onClick={cancel} className="ml-auto h-9 px-3 rounded-md border border-border bg-white text-[12.5px] text-ink-2 hover:bg-muted">Annuler</button>
          <button onClick={save} className="h-9 px-3 rounded-md border border-border bg-white text-[12.5px] text-ink-2 hover:bg-muted">Enregistrer</button>
          <button onClick={exec} className="h-9 px-5 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.play} c="w-3.5 h-3.5"/>Exécuter la requête</button>
        </section>
      </div>
    </div>
  );
}

const THEMES = APP_THEMES.map(t => [t.id, t.label, t.hex]);
function Settings({theme,setTheme,lang,setLang,onClose}) {
  const version = useVersion();
  const [sec,setSec]=useState('apparence');
  const [cur,setCur]=useState(''),[nw,setNw]=useState(''),[cf,setCf]=useState(''),[pm,setPm]=useState(null);
  const accent = accentOf(theme);
  const save = e => { e.preventDefault(); if(!cur||nw.length<8) return setPm(['err',t("Mot de passe actuel requis et 8 caractères minimum.")]); if(nw!==cf) return setPm(['err',t("Les mots de passe ne correspondent pas.")]); setPm(['err',t("Non disponible : backend à venir — authentification gérée par le proxy.")]); setCur('');setNw('');setCf(''); };
  const strength = Math.min(4,[/.{8,}/,/[A-Z]/,/[0-9]/,/[^A-Za-z0-9]/].filter(r=>r.test(nw)).length);
  const inp = "w-full h-11 rounded-lg border border-border bg-white px-3.5 text-[14px] outline-none transition focus:border-transparent focus:ring-2";
  const SECS=[['apparence','Apparence','Couleur et thème'],['securite','Sécurité','Mot de passe'],['langue','Langue','Français ou English'],['apropos','À propos','Version et build']];
  const Card = ({title,desc,children}) => <section className="bg-white rounded-xl border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div className="px-7 pt-6 pb-5 border-b border-border-subtle"><h2 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2><p className="mt-1 text-[14px] text-muted-foreground">{desc}</p></div>
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
        <button onClick={onClose} className="absolute top-5 left-8 h-9 px-3.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[13px] font-medium backdrop-blur">{t("← Retour")}</button>
      </div>
      <div className="polaris-content-shell relative z-10 px-8 -mt-12 pb-16">
        <div className="flex items-end gap-5 mb-10">
          <div style={{background:accent}} className="w-24 h-24 rounded-2xl ring-4 ring-white shadow-lg grid place-items-center text-[30px] font-bold text-white">SD</div>
          <div className="pb-1 pt-14"><h1 className="text-[30px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground">{t("Paramètres")}</h1><p className="text-[14px] text-muted-foreground">{t("Gérez votre compte et l'apparence de POLARIS")}</p></div>
        </div>
        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-10">
          <nav className="space-y-1.5">
            {SECS.map(([k,n,d])=>{const on=sec===k; return (
              <button key={k} onClick={()=>setSec(k)} className={`w-full text-left px-4 py-3 rounded-lg transition border ${on?'bg-white border-border shadow-sm':'border-transparent hover:bg-white/70'}`}>
                <div className="flex items-center gap-2.5"><span className="w-1.5 h-5 rounded-full" style={{background:on?accent:'transparent'}}/><div><div className={`text-[14px] ${on?'font-semibold text-foreground':'text-ink-2'}`}>{t(n)}</div><div className="text-[12.5px] text-subtle">{t(d)}</div></div></div>
              </button>);})}
          </nav>
          <div>
            {sec==='apparence' && <Card title={t("Couleur de l'application")} desc={t("Choisissez la couleur d'accent utilisée dans toute l'interface.")}>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{THEMES.map(([k,n,c])=>{const on=theme===k; return (
                <button key={k} onClick={()=>setTheme(k)} className={`group text-left rounded-xl border-2 overflow-hidden transition ${on?'shadow-md':'border-border hover:border-border-strong'}`} style={on?{borderColor:c}:{}}>
                  <div className="h-28 bg-surface-2 p-3 flex flex-col gap-2">
                    <div className="h-4 rounded flex items-center gap-1.5 px-1.5 bg-white border border-border"><span className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/><span className="h-1 w-8 rounded bg-track"/><span className="ml-auto w-2.5 h-2.5 rounded-full" style={{background:c}}/></div>
                    <div className="flex-1 rounded bg-white border border-border p-2 space-y-1.5"><span className="block h-1.5 w-3/4 rounded bg-track"/><span className="block h-1.5 w-1/2 rounded bg-track"/><span className="block h-4 w-14 rounded mt-2" style={{background:c}}/></div>
                  </div>
                  <div className="px-4 py-3 flex items-center gap-2.5 bg-white"><span className="w-5 h-5 rounded-full" style={{background:c}}/><span className="text-[14px] font-medium">{t(n)}</span><span className="ml-auto font-mono text-[11.5px] text-subtle">{c}</span>
                    {on && <span className="w-5 h-5 rounded-full grid place-items-center text-white text-[11px]" style={{background:c}}>✓</span>}</div>
                </button>);})}</div>
            </Card>}
            {sec==='securite' && <Card title={t("Mot de passe")} desc={t("Non disponible : backend à venir — authentification gérée par le proxy.")}>
              <form onSubmit={save} className="space-y-5 max-w-[460px]" style={{'--tw-ring-color':accent+'55'}}>
                {[['Mot de passe actuel',cur,setCur],['Nouveau mot de passe',nw,setNw],['Confirmer le mot de passe',cf,setCf]].map(([l,v,fn],i)=>(
                  <label key={l} className="block"><span className="block text-[13px] font-medium mb-1.5">{t(l)}</span>
                    <input disabled type="password" value={v} onChange={e=>fn(e.target.value)} className={inp}/>
                    {i===1 && nw && <div className="mt-2 flex gap-1.5">{[0,1,2,3].map(j=><span key={j} className="h-1.5 flex-1 rounded-full" style={{background:j<strength?accent:'#EBEBEB'}}/>)}</div>}
                  </label>))}
                {pm && <div className={`text-[13px] rounded-lg px-3.5 py-2.5 ${pm[0]==='ok'?'bg-success-soft text-success':'bg-danger-soft text-danger'}`}>{pm[1]}</div>}
                <button disabled title="Non disponible : backend à venir" type="submit" style={{background:accent}} className="h-11 px-6 rounded-lg text-white text-[14px] font-semibold shadow-sm hover:opacity-90">{t("Mettre à jour le mot de passe")}</button>
              </form>
            </Card>}
            {sec==='langue' && <Card title={t("Langue de l'interface")} desc={t("Choisissez la langue utilisée dans POLARIS.")}>
              <div className="grid grid-cols-2 gap-5 max-w-[520px]">{[['fr','Français','FR'],['en','English','EN']].map(([k,n,c])=>{const on=lang===k; return (
                <button key={k} onClick={()=>setLang(k)} className={`rounded-xl border-2 px-5 py-4 flex items-center gap-3 text-left transition ${on?'shadow-md':'border-border hover:border-border-strong'}`} style={on?{borderColor:accent}:{}}>
                  <span className="w-10 h-10 rounded-lg grid place-items-center text-[13px] font-bold text-white" style={{background:on?accent:'#A3A3A3'}}>{c}</span>
                  <span className="text-[15px] font-medium">{n}</span>
                  {on && <span className="ml-auto w-5 h-5 rounded-full grid place-items-center text-white text-[11px]" style={{background:accent}}>✓</span>}
                </button>);})}</div>
            </Card>}
            {sec==='apropos' && <Card title={t("À propos")} desc={t("Versions des composants installés.")}>
              <div className="grid grid-cols-2 gap-5">{versionComponents(version.data?.data,UI_VERSION).map(([n,v])=>(
                <div key={n} className="rounded-xl border border-border p-5"><div className="text-[13px] text-muted-foreground">{n}</div><div className="mt-1 text-[26px] font-semibold tracking-tight font-mono" style={{color:accent}}>{v}</div></div>))}</div>
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
  const f=TR_FLOWS[sel]; const card="bg-white rounded-xl border border-border overflow-hidden";
  const head=(n,x)=><div className="h-11 px-4 flex items-center gap-2 border-b border-border-subtle"><h3 className="text-[13px] font-semibold text-foreground">{t(n)}</h3>{x}</div>;
  const r=seedRand('flow'+sel); const W=600; const pts=k=>Array.from({length:40},()=>r()*k);
  const line=(d,mx)=>d.map((v,i)=>`${i?'L':'M'}${(i*W/39).toFixed(1)},${(70-v/mx*62).toFixed(1)}`).join(' ');
  const bars = by==='cat'?TR_CATS.map(([n,v,c])=>[n,v,c]):by==='app'?TR_APPS.map(([n,v])=>[n,v,'var(--app-accent)']):by==='cell'?TR_CELLS.map((c,i)=>['Cellule '+c,[31,24,18,12,9,6][i],'var(--app-accent)']):by==='dnn'?[['internet',84.1,'var(--app-accent)'],['ims',4.3,'var(--app-accent)'],['iot',2.1,'var(--app-accent)']]:[['5QI 9',82.4,'var(--app-accent)'],['5QI 8',9.9,'var(--app-accent)'],['5QI 1',4.1,'var(--app-accent)'],['5QI 5',0.6,'var(--app-accent)']];
  const mx=Math.max(...bars.map(b=>b[1]));
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-surface-2">
      <div className="polaris-content-shell px-8 py-7 space-y-5">
        <div className="flex flex-wrap items-end gap-6">
          <div><div className="text-[12px] text-muted-foreground">POLARIS Traffic</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-foreground mt-1">Traffic</h1><div className="text-[13px] text-muted-foreground mt-1">{t("Débit, santé TCP, applications, congestion")}</div></div>
          <div className="ml-auto flex items-center gap-3"><span className="text-[11px] font-medium text-warning bg-warning-soft border border-warning-line rounded px-1.5 py-[1px]">{t("Données de démo")}</span><span className="text-[12px] text-subtle">{t("Aucune charge utile, aucune URL complète stockée.")}</span></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[['Volume','412 Go'],['Débit DL','1,84 Gb/s'],['Flux actifs','18 240'],['Établissement TCP','98,6 %'],['RTT médian','31 ms'],['Flux congestionnés','6,2 %']].map(([n,v])=><div key={n} className="bg-white rounded-xl border border-border px-4 py-3"><div className="text-[12px] text-subtle">{t(n)}</div><div className="text-[20px] font-semibold tabular-nums text-foreground mt-0.5">{v}</div></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <div className={card}>
            {head("Vue d'ensemble",<div className="ml-auto flex gap-1">{[['cat','Catégorie'],['app','Application'],['cell','Cellule'],['dnn','DNN'],['qi','5QI']].map(([k,n])=><button key={k} onClick={()=>setBy(k)} className={`h-7 px-2.5 rounded-md text-[12px] ${by===k?'bg-muted font-semibold text-foreground':'text-muted-foreground'}`}>{t(n)}</button>)}</div>)}
            <div className="p-4 space-y-2.5">{bars.map(([n,v,c])=><div key={n} className="flex items-center gap-3 text-[12.5px]"><span className={`w-32 truncate ${n==='Non identifié'?'text-subtle italic':'text-ink-2'}`}>{t(n)}</span><div className="flex-1 h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full" style={{width:(v/mx*100)+'%',background:c}}/></div><span className="w-14 text-right tabular-nums">{v} %</span></div>)}
              {by==='app'&&<div className="text-[11px] text-subtle pt-1">{t("Réseau réel : agrégé uniquement, sans historique par abonné.")}</div>}</div>
          </div>
          <div className={card}>
            {head("Santé TCP")}
            <div className="p-4 grid grid-cols-3 gap-4 text-[12px]">
              {[['SYN → SYN-ACK (réseau)','14 ms'],['SYN-ACK → ACK (UE/radio)','17 ms'],['Sans réponse','0,9 %'],['RST','0,5 %'],['Retransmissions','1,1 %'],['Déséquencements','0,3 %'],['ACK dupliqués','0,7 %'],['Fenêtre nulle','0,2 %'],['ECN CE','0,04 %'],['MSS médian','1 360'],['UDP/QUIC volume','38 %'],['QUIC durée méd.','42 s']].map(([n,v])=><div key={n}><div className="text-subtle">{t(n)}</div><div className="text-[15px] font-semibold tabular-nums text-foreground">{v}</div></div>)}
              <div className="col-span-3 text-[11px] text-subtle">{t("RTT intra-capture et même interface uniquement.")}</div>
            </div>
          </div>
        </div>
        <div className={card}>
          {head("Congestion cellules × temps",<span className="ml-auto flex gap-3 text-[11px]">{Object.values(TR_V).map(([n,c])=><span key={n} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{background:c}}/>{t(n)}</span>)}</span>)}
          <div className="p-4"><table className="w-full text-[11px]"><tbody>{TR_CELLS.map(c=>{const rr=seedRand('cg'+c);return <tr key={c}><td className="pr-3 font-mono text-ink-2 w-14">{c}</td>{Array.from({length:48},(_,i)=>{const x=rr();const k=x>0.93?'RADIO':x>0.9?'CORE':x>0.88?'QOS':x>0.87?'IND':'OK';return <td key={i} className="p-[1px]"><div title={t(TR_V[k][0])} className="h-5 rounded-[2px]" style={{background:TR_V[k][1],opacity:k==='OK'?0.15:0.9}}/></td>;})}</tr>;})}</tbody></table>
          <div className="mt-2 flex justify-between text-[11px] text-subtle"><span>−12 h</span><span>{t("maintenant")}</span></div></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
          <div className={card}>
            {head("Flux")}
            <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-[11px] text-subtle">{['UE','Proto','5-uplet','Application','Catégorie','Règle','Cellule','Débit','RTT','Retrans.','Verdict'].map(h=><th key={h} className="px-3 py-2 font-medium border-b border-border-subtle whitespace-nowrap">{t(h)}</th>)}</tr></thead>
            <tbody>{TR_FLOWS.map((x,i)=><tr key={i} onClick={()=>setSel(i)} className={`cursor-pointer whitespace-nowrap ${sel===i?'bg-surface-2 shadow-[inset_2px_0_0_var(--app-accent)]':'hover:bg-surface-2'}`}>
              <td className="px-3 py-2 font-mono">{x[0]}</td><td className="px-3">{x[1]}</td><td className="px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{x[2]} → {x[3]}</td><td className="px-3">{x[4]}</td><td className={`px-3 ${x[5]==='Non identifié'?'italic text-subtle':''}`}>{t(x[5])}</td><td className="px-3 font-mono text-[11px] text-subtle">{x[6]}</td><td className="px-3 font-mono">{x[8]}</td><td className="px-3 tabular-nums">{x[9]} Mb/s</td><td className="px-3 tabular-nums">{x[10]} ms</td><td className="px-3 tabular-nums">{x[11]} %</td>
              <td className="px-3"><span className="text-[11px] font-medium rounded px-1.5 py-[1px] text-white whitespace-nowrap" style={{background:TR_V[x[12]][1]}}>{t(TR_V[x[12]][0])}</span></td></tr>)}</tbody></table></div>
          </div>
          <div className={card}>
            {head("Détail du flux",<span className="ml-auto font-mono text-[11px] text-subtle">{f[0]} · {f[7]}</span>)}
            <div className="p-4 space-y-3">
              {[['Débit',f[9]*1.4,'Mb/s'],['RTT',f[10]*1.5,'ms'],['Retransmissions',Math.max(1,f[11]*2),'%']].map(([n,k,u])=><div key={n}><div className="text-[11.5px] text-subtle">{t(n)} ({u})</div><svg viewBox={`0 0 ${W} 72`} className="w-full h-[56px]"><path d={line(pts(k),k)} fill="none" stroke="var(--app-accent)" strokeWidth="1.6"/></svg></div>)}
              <div className="rounded-md border border-border-subtle p-3 text-[12px]"><div className="flex items-center gap-2"><span className="text-subtle">{t("Verdict")}</span><span className="text-[11px] font-medium rounded px-1.5 text-white" style={{background:TR_V[f[12]][1]}}>{t(TR_V[f[12]][0])}</span></div><div className="mt-1 text-ink-2">{f[13]}</div><div className="mt-1 text-[11px] text-subtle">{t("Règle appliquée")} : {f[6]} · {f[5]}</div></div>
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
  const [theme,setThemeS] = useState(()=>{ try { return normalizeTheme(localStorage.getItem('polaris-theme')); } catch(e) { return DEFAULT_THEME; } });
  const setTheme = t => { try { localStorage.setItem('polaris-theme',t); } catch(e) {} setThemeS(t); };
  const [hiddenMods,setHiddenMods] = useState([]);
  useEffect(()=>{ setHiddenMods(loadHidden()); },[]);
  const accountHidden = sanitizeHidden(auth.data?.data?.hidden_modules); const navHidden = [...new Set([...hiddenMods,...accountHidden])];
  const toggleMod = k => setHiddenMods(h=>{ const n=toggleHidden(h,k); saveHidden(n); return n; });
  const accent = accentOf(theme);
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
  const listedSessions = records(sessionsQuery.data?.data, 'sessions');
  const anchorCandidates = demo ? [] : (active?.apiRows || listedSessions);
  const sessionAnchors = useSessionAnchors(anchorCandidates, page==='sessions' && view==='results' && !demo);
  const sessionFlows = useSessionFlows(anchorCandidates, page==='sessions' && view==='results' && !demo);
  const adaptSession = x => { const base = toLegacySession(x, sessionAnchors[String(x.session_id)]); const f = sessionFlows[String(x.session_id)]; if (!f) return base; const sm = sessionSummary(x, f); return { ...base, res: sm.res, durMs: sm.durationMs, multiCapture: sm.multiCapture }; };
  const sourceRows = listedSessions.map(x=>demo ? x : adaptSession(x));
  const rows = useMemo(()=>{
    if (!active) return [];
    const ue = active.ue;
    const data = demo ? sourceRows : (active.apiRows ? active.apiRows.map(adaptSession) : sourceRows);
    return demo ? data.filter(s=>(!ue || (Array.isArray(ue)?ue.includes(s.ue):s.ue===ue)) && matchQ(s,active.conds,active.join)) : data;
  },[active,demo,sessionsQuery.data,sessionAnchors,sessionFlows]);
  const [sel,setSel] = useState(3);
  const s = rows.find(r=>r.id===sel) || rows.find(r=>r.id!=null);
  const bundle = useSessionBundle(page==='sessions' && view==='results' ? s?.id : null);
  const detailSession = bundle.session.data?.data ? toLegacySession(bundle.session.data.data) : null;
  const detailErrors = s?.id == null ? [] : [['session',bundle.session],['events',bundle.events],['procedures',bundle.procedures],['callflow',bundle.callflow],['correlations',bundle.correlations]]
    .filter(([,query])=>query.isError)
    .map(([endpoint,query])=>({endpoint:`/sessions/${encodeURIComponent(String(s.id))}${endpoint==='session'?'':`/${endpoint}`}`,status:query.error?.status ?? '—'}));
  const selected = s ? (demo ? s : {...s,...Object.fromEntries(Object.entries(detailSession ?? {}).filter(([key,v])=>key!=='d' && v!=null && v!=='—' && !(Array.isArray(v)&&!v.length))),id:detailSession?.id ?? s.id,session_id:detailSession?.session_id ?? s.session_id,d:bundle.detail || s.d,detailErrors}) : null;
  const nameOf = c => `${c.length?c.map(x=>x[1]).join(' · '):'Toutes les sessions'}${demo ? ' · run 482' : ''}`;
  const patch = (id,o) => setTabs(ts=>ts.map(x=>x.id===id?{...x,...o}:x));
  const newTab = (draft=mkDraft(),title) => { const id='q'+Date.now(); setTabs(ts=>[...ts,{id,k:'Requête',n:title||'Nouvelle requête',conds:[],mode:'edit',draft,dirty:!!title,demoOnly:demo}]); setTabId(id); setAview('tab'); };
  const openSaved = q => { const id='q'+Date.now(); const c=q.c.map(y=>[y[0],y[1],y[2]||'=']); setTabs(ts=>[...ts,{id,k:'Requête',n:q.n,conds:c,join:'ET',mode:demo?'results':'edit',draft:mkDraft({tpl:q.g,scope:q.p,conds:c,name:q.n}),demoOnly:demo}]); setTabId(id); setAview('tab'); };
  const editActive = () => { if (!active) return; patch(active.id,{mode:'edit',draft:active.draft||mkDraft({conds:active.conds,name:active.n,join:active.join||'ET'})}); };
  const setDraft = d => patch(active.id,{draft:d,dirty:true,n:d.name||'Nouvelle requête'});
  const runQuery = () => { const d=active.draft; const id=active.id;
    sessionFilter.mutate(d,{onSuccess:response=>patch(id,{conds:d.conds,join:d.join,n:d.name||nameOf(d.conds),mode:'results',ran:true,apiRows:demo?undefined:records(response.data,'sessions')}),onError:e=>window.alert(e.message)});
  };
  const displayAllSessions = () => {
    const id='q'+Date.now(); const draft=mkDraft({name:'Toutes les sessions'});
    sessionFilter.mutate(draft,{onSuccess:response=>{
      setTabs(ts=>[...ts,{id,k:'Requête',n:'Toutes les sessions',conds:[],join:'ET',mode:'results',ran:true,draft,dirty:false,demoOnly:demo,apiRows:demo?undefined:records(response.data,'sessions')}]);
      setTabId(id); setAview('tab');
    },onError:e=>window.alert(e.message)});
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
  const L0 = (()=>{ try { return JSON.parse(localStorage.getItem('polaris-layout-v2'))||{}; } catch(e) { return {}; } })();
  const DEF = {gridPct:25,insPct:22,anaPct:21,jouPct:24,geoPct:26};
  const [gridPct,setGridPct] = useState(L0.gridPct ?? DEF.gridPct);
  const [gridHidden,setGridHidden] = useState(L0.gridHidden ?? false);
  const [insPct,setInsPct] = useState(L0.insPct ?? DEF.insPct);
  const [anaPct,setAnaPct] = useState(L0.anaPct ?? DEF.anaPct);
  const [insHidden,setInsHidden] = useState(L0.insHidden ?? false);
  const [anaHidden,setAnaHidden] = useState(L0.anaHidden ?? false);
  const [jouPct,setJouPct] = useState(L0.jouPct ?? DEF.jouPct);
  const [jouHidden,setJouHidden] = useState(L0.jouHidden ?? true);
  const [geoPct,setGeoPct] = useState(L0.geoPct ?? DEF.geoPct);
  const [geoHidden,setGeoHidden] = useState(L0.geoHidden ?? true);
  const [geoMax,setGeoMax] = useState(false);
  const [full,setFull] = useState(false);
  useEffect(()=>{ try { localStorage.setItem('polaris-layout-v2',JSON.stringify({gridPct,gridHidden,insPct,anaPct,insHidden,anaHidden,jouPct,jouHidden,geoPct,geoHidden})); } catch(e) {} },[gridPct,gridHidden,insPct,anaPct,insHidden,anaHidden,jouPct,jouHidden,geoPct,geoHidden]);
  const mainRef = useRef(null), lowRef = useRef(null), rowRef = useRef(null);
  const resetLayout = () => { setGridPct(DEF.gridPct); setInsPct(DEF.insPct); setAnaPct(DEF.anaPct); setJouPct(DEF.jouPct); setGeoPct(DEF.geoPct); };
  const drag = (e,kind) => { e.preventDefault(); const r = (kind==='h'?mainRef:rowRef).current.getBoundingClientRect();
    const mv = ev => {
      if(kind==='h') return setGridPct(Math.min(70,Math.max(12,(ev.clientY-r.top)/r.height*100)));
      const fromRight = (r.right-ev.clientX)/r.width*100;
      if(kind==='ana') setAnaPct(Math.min(40,Math.max(14,fromRight)));
      else if(kind==='geo') setGeoPct(Math.min(55,Math.max(18,fromRight-(anaHidden?0:anaPct)-(insHidden?0:insPct)-(jouHidden?0:jouPct))));
      else if(kind==='jou') setJouPct(Math.min(45,Math.max(16,fromRight-(anaHidden?0:anaPct)-(insHidden?0:insPct))));
      else setInsPct(Math.min(45,Math.max(14,fromRight-(anaHidden?0:anaPct))));
    };
    const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); document.body.style.cursor=''; };
    document.body.style.cursor = kind==='h'?'row-resize':'col-resize'; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); };
  const ui = {full,setFull,gridHidden,setGridHidden};
  useEffect(()=>{ setMsg(0); setLens(null); },[s?.id]);
  return (
    <div style={{"--app-accent":accent}} className="h-screen flex flex-col bg-surface-2 text-foreground text-base">
      <TopBar role={role} page={page} setPage={setPage} onAnalyzer={()=>setAview('queries')} accent={accent} onSettings={()=>setPage('settings')} metrics={metrics} version={version} demo={demo} hidden={navHidden}/>
      <DataStatus t={t}/>
      {(role==='operator'||role==='administrator') && <div className="h-7 shrink-0 bg-warning-soft border-b border-warning-line text-warning text-[12px] flex items-center px-4">Rôle operator actif · identités en clair · actions soumises au proxy</div>}
      {page==='settings' ? <Settings theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} onClose={()=>setPage('home')}/> : page==='home' ? <Home hidden={navHidden} setPage={setPage} onNew={()=>{ setPage('sessions'); newTab(); }}/> : page==='kpi' ? <KpiModule t={t} role={role} setPage={setPage} KPIS={kpis.catalogue} mockSeries={kpis.mockSeries} MockChart={MockChart} fmtV={fmtV}/> : page==='live' ? <LiveModule t={t} role={role} setPage={setPage}/> : page==='trafic' ? (TRAFFIC_ENABLED && demo ? <Traffic setPage={setPage}/> : <div className="p-8">Non disponible : backend à venir</div>) : page==='nodes' ? <Administration Card={Card} nodeManager={<Nodes/>} hidden={hiddenMods} onToggle={toggleMod} onSettings={()=>setPage('settings')}/> : page==='templates' ? <QueryLibrary saved={savedList} onNew={(d,tt)=>{setPage('sessions'); newTab(d,tt);}} onOpen={q=>{setPage('sessions'); openSaved(q);}}/> : <>
      {!full && <Tabs tabs={tabs} active={view==='library'?null:tabId} home={view==='library'} onPick={pickTab} onClose={closeTab} onHome={()=>setAview('queries')} onNew={()=>newTab()}/>}
      {view==='library' ? <QueryLibrary saved={savedList} onNew={newTab} onOpen={openSaved} onDisplayAll={displayAllSessions} displayingAll={sessionFilter.isPending}/> : view==='edit' ? <QueryEditor key={active.id} draft={active.draft} setDraft={setDraft} dirty={active.dirty} run={runQuery} save={saveQuery} cancel={cancelEdit} role={role} sessionRows={sourceRows}/> : <div ref={rowRef} className="flex-1 flex min-h-0 p-2 bg-surface-2">
        <main ref={mainRef} className={`flex-1 min-w-0 flex-col ${geoMax && selected && !geoHidden && !full ? 'hidden' : 'flex'}`}>
          {!full && !gridHidden && <>
            <Grid rows={rows} sel={s?.id} setSel={setSel} role={role} conds={conds} setConds={setConds} onEdit={editActive} height={`${gridPct}%`}/>
            <div onMouseDown={e=>drag(e,'h')} onDoubleClick={resetLayout} title="Glisser pour redimensionner · double-clic pour restaurer" className="group h-2 shrink-0 cursor-row-resize relative"><div className="absolute left-1/2 -translate-x-1/2 top-[3px] h-[2px] w-10 rounded-full bg-track group-hover:bg-[var(--app-accent)] group-hover:w-full transition-all"/></div>
          </>}
          <div ref={lowRef} className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-[280px] flex flex-col">{selected ? <Detail s={selected} sel={msg} setSel={setMsg} lens={lens} ui={ui} onOpenSession={id=>setSel(id)}/> : <div className="p-8 text-muted-foreground bg-white rounded-xl border border-border flex-1">{sessionsQuery.isError ? sessionsQuery.error.message : sessionsQuery.isPending ? "Connexion POLARIS…" : "Aucune session"}</div>}</div>
          </div>
        </main>
        {selected && !full && (geoHidden ? null : <>{!geoMax && <div onMouseDown={e=>drag(e,'geo')} onDoubleClick={resetLayout} title="Glisser pour redimensionner · double-clic pour restaurer" className="group w-2 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[3px] w-[2px] h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div>}<aside style={geoMax?undefined:{width:`${geoPct}%`}} aria-label="Geolocating" className={`${geoMax?'flex-1':'shrink-0'} bg-white flex flex-col min-w-0 rounded-xl border border-border overflow-hidden`}><GeoPanel s={selected} msg={msg} setMsg={k=>setMsg(Math.max(0,k))} onHide={()=>{setGeoHidden(true); setGeoMax(false);}} max={geoMax} setMax={setGeoMax}/></aside></>)}
        {selected && !full && (jouHidden ? null : <><div onMouseDown={e=>drag(e,'jou')} onDoubleClick={resetLayout} title="Glisser pour redimensionner · double-clic pour restaurer" className="group w-2 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[3px] w-[2px] h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div><aside style={{width:`${jouPct}%`}} aria-label="Parcours abonné" className="shrink-0 bg-white flex flex-col min-w-0 rounded-xl border border-border overflow-hidden"><div className="h-[42px] shrink-0 px-4 flex items-center border-b border-border"><span className="text-[13px] font-semibold text-foreground">Parcours abonné</span><button onClick={()=>setJouHidden(true)} title="Masquer Parcours abonné" className="ml-auto w-7 h-7 rounded-md grid place-items-center text-muted-foreground hover:bg-muted">×</button></div><div className="flex-1 overflow-auto scroll-thin"><SubscriberJourney s={selected} role={role} onOpen={id=>{ if(id) setSel(id); }}/></div></aside></>)}
        {selected && !full && (insHidden ? null : <><div onMouseDown={e=>drag(e,'ins')} onDoubleClick={resetLayout} title="Glisser pour redimensionner · double-clic pour restaurer" className="group w-2 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[3px] w-[2px] h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div><Inspector key={selected.id} s={selected} sel={msg} role={role} lens={lens} setLens={setLens} width={`${insPct}%`} onHide={()=>setInsHidden(true)}/></>)}
        {selected && !full && (anaHidden ? null : <><div onMouseDown={e=>drag(e,'ana')} onDoubleClick={resetLayout} title="Glisser pour redimensionner · double-clic pour restaurer" className="group w-2 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[3px] w-[2px] h-10 rounded-full bg-track group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div><SessionAnalysis role={role} onOpenSession={id=>setSel(id)} s={selected} width={`${anaPct}%`} loading={bundle.callflow.isFetching || bundle.events.isFetching} onPick={k=>setMsg(Math.max(0,k))} onHide={()=>setAnaHidden(true)}/></>)}
        {selected && !full && <nav aria-label="Panneaux" className="ml-2 w-10 shrink-0 self-stretch bg-white rounded-xl border border-border flex flex-col items-center py-2 gap-1">
          {[['Geolocating',geoHidden,v=>{setGeoHidden(v); if(v) setGeoMax(false);},'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5'],['Parcours abonné',jouHidden,setJouHidden,'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],['Décodage',insHidden,setInsHidden,'M8 6l-6 6 6 6M16 6l6 6-6 6'],['Analyse sessions',anaHidden,setAnaHidden,'M4 20V10M10 20V4M16 20v-7M22 20H2']].map(([l,h,set,d])=><button key={l} type="button" onClick={()=>set(!h)} aria-pressed={!h} title={`${h?'Afficher':'Masquer'} ${l}`} className={`w-8 rounded-lg flex flex-col items-center gap-2 py-2.5 transition ${!h?'bg-brand-soft text-[var(--app-accent)]':'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><I d={d} c="w-4 h-4"/><span className="[writing-mode:vertical-rl] text-[11.5px] font-medium">{l}</span></button>)}
        </nav>}
      </div>}</>}
      <footer className="h-7 shrink-0 bg-white border-t border-border flex items-center gap-5 px-4 text-[11.5px] text-muted-foreground">
        <span>Capture : {available(metrics.data?.data?.capture_state)}</span><span>Segments ingérés : {available(metrics.data?.data?.segments_ingested)}</span>
        <span className="ml-auto font-mono">POLARIS {UI_VERSION}{demo ? ' · Données de démo' : ''}</span>
      </footer>
    </div>
  );
}
export default App;
