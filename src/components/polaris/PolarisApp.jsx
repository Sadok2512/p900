import KpiModule from './kpi/KpiModule';
import LiveModule from './live/LiveModule';
import React, { useState, useMemo, useEffect, useRef } from 'react';

/* Données fictives — PLMN de test 001/01. Tri canonique (capture_id, seq). */
const IFC = {
  'N2':['#1D4ED8','#EFF4FF'],'SBI':['#6D28D9','#F4F0FF'],'N4':['#A15C07','#FDF6E7'],'N3':['#15803D','#ECF8F0'],
  'S1-MME':['#1D4ED8','#EFF4FF'],'S6a':['#BE185D','#FDEEF5'],'S11':['#A15C07','#FDF6E7'],'S5-C':['#A15C07','#FDF6E7'],'S1-U':['#15803D','#ECF8F0'],
};
const N5 = ['gNB','AMF','AUSF/UDM','SMF','UPF'];
const N4n = ['eNB','MME','HSS','SGW-C','PGW-C','SGW-U'];
const nodeIdx = (nodes, n) => nodes.indexOf(n==='AUSF'||n==='UDM' ? 'AUSF/UDM' : n);

const OK5 = { nodes:N5, procs:[['Registration',0,8],['PDU Session',9,18],['Trafic',19,20]],
  summary:'Registration et PDU Session réussies. Plan usager actif dans les deux sens.',
  msgs:[
    ['N2','NGAP InitialUEMessage','gNB → AMF','Registration Request'],
    ['SBI','Nausf UEAuthentication POST','AMF → AUSF'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','Authentication Request'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','Authentication Response'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','Security Mode Command'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','Security Mode Complete'],
    ['SBI','Nudm SDM Get am-data','AMF → UDM'],
    ['N2','NGAP InitialContextSetupRequest','AMF → gNB','Registration Accept'],
    ['N2','NGAP InitialContextSetupResponse','gNB → AMF'],
    ['N2','NGAP UplinkNASTransport','gNB → AMF','PDU Session Establishment Request'],
    ['SBI','Nsmf CreateSMContext','AMF → SMF',null,'smContextRef','ctx-1'],
    ['N4','PFCP Session Establishment Request','SMF → UPF',null,'SEID','0x3a1'],
    ['N4','PFCP Session Establishment Response','UPF → SMF',null,'UL F-TEID','0x0000a1f2'],
    ['SBI','Namf N1N2MessageTransfer','SMF → AMF',null,'UL TEID','0x0000a1f2'],
    ['N2','NGAP PDUSessionResourceSetupRequest','AMF → gNB','PDU Session Establishment Accept','UL TEID','0x0000a1f2'],
    ['N2','NGAP PDUSessionResourceSetupResponse','gNB → AMF',null,'DL TEID','0x00000b07'],
    ['SBI','Nsmf UpdateSMContext','AMF → SMF',null,'DL TEID','0x00000b07'],
    ['N4','PFCP Session Modification Request','SMF → UPF',null,'DL F-TEID','0x00000b07'],
    ['N4','PFCP Session Modification Response','UPF → SMF'],
    ['N3','GTP-U G-PDU ×1 248 (UL)','gNB → UPF',null,'TEID','0x0000a1f2'],
    ['N3','GTP-U G-PDU ×3 902 (DL)','UPF → gNB',null,'TEID','0x00000b07'],
  ],
  links:[[12,14,'N4','N2','UL TEID 0x0000a1f2','EXACT'],[12,19,'N4','N3','UL TEID 0x0000a1f2','EXACT'],[17,20,'N4','N3','DL TEID 0x00000b07','EXACT'],[13,14,'SBI','N2','n2SmInfo UL TEID','À PROUVER'],[10,11,'SBI','N4','smContextRef ↔ SEID','À PROUVER']],
};
const KO5 = { nodes:N5, procs:[['PDU Session',0,5]],
  summary:'PDU Session refusée par le SMF — 5GSM #27 Missing or unknown DNN.',
  diverge:'Première divergence au message 5 : attendu PFCP Session Establishment Request (N4), observé CreateSMContext 403 (SBI).',
  msgs:[
    ['N2','NGAP UplinkNASTransport','gNB → AMF','PDU Session Establishment Request'],
    ['SBI','Nsmf CreateSMContext','AMF → SMF',null,'smContextRef','ctx-7'],
    ['SBI','Nudm SDM Get sm-data','SMF → UDM'],
    ['SBI','Nudm SDM 200 (DNN absent)','UDM → SMF'],
    ['SBI','Nsmf CreateSMContext 403','SMF → AMF',null,'cause 5GSM','#27'],
    ['N2','NGAP DownlinkNASTransport','AMF → gNB','PDU Session Establishment Reject #27'],
  ],
  links:[[1,null,'SBI','N4','smContextRef → SEID','ABSENT']],
};
const LTE = { nodes:N4n, procs:[['Attach',0,15],['Bearer par défaut',9,17],['Trafic',18,19]],
  summary:'Attach et bearer par défaut réussis. Les 5 liens attendus sont prouvés.',
  msgs:[
    ['S1-MME','S1AP InitialUEMessage','eNB → MME','Attach Request'],
    ['S6a','Diameter AIR','MME → HSS',null,'Session-Id','d1'],
    ['S6a','Diameter AIA 2001','HSS → MME',null,'Session-Id','d1'],
    ['S1-MME','S1AP DownlinkNASTransport','MME → eNB','Authentication Request'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Authentication Response'],
    ['S1-MME','S1AP DownlinkNASTransport','MME → eNB','Security Mode Command'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Security Mode Complete'],
    ['S6a','Diameter ULR','MME → HSS',null,'Session-Id','d2'],
    ['S6a','Diameter ULA 2001','HSS → MME',null,'Session-Id','d2'],
    ['S11','GTPv2 Create Session Request','MME → SGW-C'],
    ['S5-C','GTPv2 Create Session Request','SGW-C → PGW-C'],
    ['S5-C','GTPv2 Create Session Response 16','PGW-C → SGW-C'],
    ['S11','GTPv2 Create Session Response 16','SGW-C → MME',null,'S1-U F-TEID','0x00001c3a'],
    ['S1-MME','S1AP InitialContextSetupRequest','MME → eNB','Attach Accept','UL TEID','0x00001c3a'],
    ['S1-MME','S1AP InitialContextSetupResponse','eNB → MME',null,'eNB F-TEID','0x0000e214'],
    ['S1-MME','S1AP UplinkNASTransport','eNB → MME','Attach Complete'],
    ['S11','GTPv2 Modify Bearer Request','MME → SGW-C',null,'eNB F-TEID','0x0000e214'],
    ['S11','GTPv2 Modify Bearer Response 16','SGW-C → MME'],
    ['S1-U','GTP-U G-PDU ×812 (UL)','eNB → SGW-U',null,'TEID','0x00001c3a'],
    ['S1-U','GTP-U G-PDU ×2 640 (DL)','SGW-U → eNB',null,'TEID','0x0000e214'],
  ],
  links:[[12,13,'S11','S1-MME','UL TEID 0x00001c3a','EXACT'],[12,18,'S11','S1-U','UL TEID 0x00001c3a','EXACT'],[14,16,'S1-MME','S11','eNB TEID 0x0000e214','EXACT'],[16,19,'S11','S1-U','eNB TEID 0x0000e214','EXACT'],[1,7,'S6a','S6a','Session-Id','EXACT']],
};
const SESS = [
  {id:1,cap:41,seq:18204,ue:'UE-7f3a',imsi:'001010000000101',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'412 ms',d:OK5},
  {id:2,cap:41,seq:18877,ue:'UE-2c90',imsi:'001010000000102',rat:'LTE',proc:'Attach + bearer par défaut',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'5/5',comp:100,dur:'538 ms',d:LTE},
  {id:3,cap:41,seq:20511,ue:'UE-9b14',imsi:'001010000000103',rat:'5G SA',proc:'PDU Session',res:'Échec',cause:'5GSM #27 Missing or unknown DNN',cell:'gNB-1 / 0x001',ex:'0/1',comp:100,dur:'96 ms',d:KO5},
  {id:4,cap:42,seq:311,ue:'UE-7f3a',imsi:'001010000000101',rat:'5G SA',proc:'Service Request',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/3',comp:92,dur:'58 ms',d:OK5},
  {id:5,cap:42,seq:1290,ue:'UE-51de',imsi:'001010000000104',rat:'LTE',proc:'Attach',res:'Échec',cause:'S6a 5001 USER_UNKNOWN',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'38 ms',d:LTE},
  {id:6,cap:42,seq:2044,ue:'UE-2c90',imsi:'001010000000102',rat:'LTE',proc:'Tracking Area Update',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'44 ms',d:LTE},
  {id:7,cap:42,seq:3315,ue:'UE-c6e2',imsi:'001010000000105',rat:'5G SA',proc:'Registration',res:'Échec',cause:'5GMM #7 5GS services not allowed',cell:'gNB-1 / 0x001',ex:'0/1',comp:88,dur:'71 ms',d:KO5},
  {id:8,cap:42,seq:4102,ue:'UE-0ae7',imsi:'001010000000106',rat:'LTE',proc:'Dedicated Bearer Activation',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'4/4',comp:100,dur:'120 ms',d:LTE},
  {id:9,cap:43,seq:77,ue:'UE-9b14',imsi:'001010000000103',rat:'5G SA',proc:'Deregistration',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/2',comp:100,dur:'64 ms',d:OK5},
  {id:10,cap:43,seq:812,ue:'UE-51de',imsi:'001010000000104',rat:'LTE',proc:'Detach',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'31 ms',d:LTE},
  {id:11,cap:43,seq:1555,ue:'UE-44f0',imsi:'001010000000107',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'398 ms',d:OK5},
  {id:12,cap:43,seq:2210,ue:'UE-0ae7',imsi:'001010000000106',rat:'LTE',proc:'E-RAB Release',res:'Succès',cause:'S1AP radio #20 user-inactivity',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'22 ms',d:LTE},
];
const FIELDS = [
  ['Résultat',['Succès','Échec']],['RAT',['5G SA','LTE']],
  ['Procédure',['Registration','PDU Session','Service Request','Attach','Tracking Area Update','Detach','Deregistration','E-RAB Release']],
  ['Cause',['5GSM #27','5GMM #7','S6a 5001','S1AP radio #20']],
  ['Interface',['N2','SBI','N4','N3','S1-MME','S6a','S11','S1-U']],['Cellule',['gNB-1','eNB-1']],['UE',['UE-7f3a','UE-9b14','UE-2c90','UE-51de']],
];
const test = (s,[k,v]) => ({
  'Résultat':()=>s.res===v,'RAT':()=>s.rat===v,'Procédure':()=>s.proc.includes(v),'Cause':()=>s.cause.includes(v),
  'Interface':()=>s.d.msgs.some(m=>m[0]===v),'Cellule':()=>s.cell.includes(v),'UE':()=>s.ue===v,
}[k] || (()=>true))();

/* ------------------------------------------------------------------ */
const EN = {"Débit, santé TCP, applications, congestion": "Throughput, TCP health, applications, congestion", "Aucune charge utile, aucune URL complète stockée.": "No payload, no full URL stored.", "Volume": "Volume", "Débit DL": "DL throughput", "Flux actifs": "Active flows", "Établissement TCP": "TCP setup", "RTT médian": "Median RTT", "Flux congestionnés": "Congested flows", "Vue d'ensemble": "Overview", "Catégorie": "Category", "Application": "Application", "Cellule": "Cell", "Vidéo": "Video", "Transfert": "Transfer", "Messagerie": "Messaging", "Voix": "Voice", "Jeu": "Gaming", "Non identifié": "Unidentified", "Réseau réel : agrégé uniquement, sans historique par abonné.": "Live network: aggregated only, no per-subscriber history.", "Santé TCP": "TCP health", "Sans réponse": "No response", "Retransmissions": "Retransmissions", "ACK dupliqués": "Duplicate ACKs", "Fenêtre nulle": "Zero window", "RTT intra-capture et même interface uniquement.": "RTT intra-capture and same interface only.", "Congestion cellules × temps": "Cell congestion × time", "Radio": "Radio", "Cœur/Internet": "Core/Internet", "Limite QoS": "QoS limit", "Limite récepteur": "Receiver limit", "Limite application": "Application limit", "INDÉTERMINÉ": "UNDETERMINED", "Flux": "Flows", "Règle": "Rule", "Verdict": "Verdict", "Détail du flux": "Flow detail", "Règle appliquée": "Applied rule", "Ouvrir la session dans l'Analyzer →": "Open session in Analyzer →", "Taux d’établissement TCP": "TCP setup rate", "RTT TCP": "TCP RTT", "Retransmissions TCP": "TCP retransmissions", "Live delayed by": "Live delayed by", "flux pris après décodage — dumpcap jamais touchés": "stream taken after decoding — dumpcap never touched", "Cible": "Target", "Pause": "Pause", "Reprendre": "Resume", "Rôle viewer : cible par pseudonyme uniquement, identités masquées.": "Viewer role: pseudonym targets only, identities masked.", "Traces actives": "Active traces", "Expiration": "Expires in", "Messages reçus": "Messages received", "En tampon (pause)": "Buffered (paused)", "Signalisation live": "Live signalling", "en direct": "live", "en pause": "paused", "Ordre (capture_id, seq) — chaque message est retrouvable à l'identique dans l'Analyzer.": "Order (capture_id, seq) — every message is found identical in the Analyzer.", "Chaîne d'identité": "Identity chain", "masqué": "masked", "Débit live": "Live throughput", "Rapport d'usage PFCP": "PFCP usage report", "écart": "gap", "RTP live": "Live RTP", "Codec": "Codec", "Débit": "Bitrate", "Pertes": "Loss", "Gigue": "Jitter", "Déséquencement": "Reordering", "estimation G.107": "G.107 estimate", "En-têtes seulement — aucune charge audio lue ni stockée.": "Headers only — no audio payload read or stored.", "Journal des traces": "Trace log", "trace créée": "trace created", "recherche IMSI": "IMSI lookup", "consultation historique": "history viewed", "Données de démo": "Demo data", "Fraîcheur : 4 s": "Freshness: 4 s", "moyenne": "average", "échecs": "failures", "maintenant": "now", "il y a": "", "preuve": "evidence", "Analyse": "Analysis", "Template": "Template", "il y a 3 min": "3 min ago", "il y a 12 min": "12 min ago", "il y a 40 min": "40 min ago", "il y a 2 h": "2 h ago", "Données de démo — OIRAN non connecté.": "Demo data — OIRAN not connected.", "Accueil": "Home", "Administrateur": "Administrator", "Topologie et état des nœuds du réseau.": "Network node topology and status.", "Analyzer": "Analyzer", "Nœuds": "Nodes", "KPI": "KPI", "Live": "Live", "Trafic": "Traffic", "Templates": "Templates", "Paramètres": "Settings", "Compte": "Account", "Notifications": "Notifications", "Rechercher…": "Search…", "← Retour": "← Back", "Gérez votre compte et l'apparence de POLARIS": "Manage your account and the look of POLARIS", "Apparence": "Appearance", "Couleur et thème": "Color and theme", "Sécurité": "Security", "Mot de passe": "Password", "À propos": "About", "Version et build": "Version and build", "Langue": "Language", "Français ou English": "French or English", "Couleur de l'application": "App color", "Choisissez la couleur d'accent utilisée dans toute l'interface.": "Choose the accent color used across the interface.", "Bleu": "Blue", "Noir": "Black", "Vert": "Green", "Utilisez au moins 8 caractères, avec majuscules, chiffres et symboles.": "Use at least 8 characters, with uppercase letters, numbers and symbols.", "Mot de passe actuel": "Current password", "Nouveau mot de passe": "New password", "Confirmer le mot de passe": "Confirm password", "Mettre à jour le mot de passe": "Update password", "Versions des composants installés.": "Versions of installed components.", "Langue de l'interface": "Interface language", "Choisissez la langue utilisée dans POLARIS.": "Choose the language used in POLARIS.", "Mot de passe actuel requis et 8 caractères minimum.": "Current password required, 8 characters minimum.", "Les mots de passe ne correspondent pas.": "Passwords do not match.", "Mot de passe mis à jour.": "Password updated.", "Bienvenue sur POLARIS": "Welcome to POLARIS", "Analyse, diagnostic et supervision des sessions et du trafic réseau.": "Analysis, diagnostics and monitoring of network sessions and traffic.", "Nouvelle analyse": "New analysis", "Ouvrir un template": "Open a template", "Explorer un run": "Explore a run", "Trace live": "Live trace", "Bientôt": "Soon", "Modules": "Modules", "KPI & Anomalies": "KPI & Anomalies", "Plan usager": "User plane", "Requêtes, ladder et corrélation des sessions 4G/5G.": "Queries, ladder and correlation of 4G/5G sessions.", "Indicateurs par procédure et détection d'écarts.": "Per-procedure indicators and anomaly detection.", "Suivi en temps réel des sessions capturées.": "Real-time tracking of captured sessions.", "Débits et flux N3 / S1-U par session.": "N3 / S1-U throughput and flows per session.", "Requêtes enregistrées et modèles prêts à l'emploi.": "Saved queries and ready-to-use models.", "Ouvrir →": "Open →", "Activité récente": "Recent activity", "Voir tout": "View all", "Aucune activité pour l'instant": "No activity yet", "Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.": "Your analyses, KPI queries, templates and viewed runs will appear here.", "Lancer une analyse →": "Start an analysis →", "État de la plateforme": "Platform status", "Voir la supervision": "View monitoring", "Capture": "Capture", "dumpcap actifs / attendus": "active / expected dumpcap", "Fraîcheur des données": "Data freshness", "dernier import": "last import", "Alertes": "Alerts", "points de vigilance": "watch points", "Service OIRAN non connecté : aucune donnée en direct.": "OIRAN service not connected: no live data.", "Données à jour · retard 4 s": "Data up to date · 4 s delay", "Fraîcheur : — (OIRAN non connecté)": "Freshness: — (OIRAN not connected)", "Rechercher un KPI…": "Search a KPI…", "Santé sonde": "Probe health", "Procédures 5G": "5G procedures", "Procédures 4G": "4G procedures", "Session N4": "N4 session", "Erreurs": "Errors", "Latence": "Latency", "Corrélation": "Correlation", "Dumpcap actifs": "Active dumpcap", "Segments ignorés": "Dropped segments", "Retard d’import": "Import lag", "Disque disponible": "Disk available", "Succès Registration": "Registration success", "Succès PDU Session": "PDU Session success", "Succès Service Request": "Service Request success", "Succès Attach": "Attach success", "Succès E-RAB Setup": "E-RAB Setup success", "Succès établissement N4": "N4 establishment success", "Erreurs S6a": "S6a errors", "Erreurs SBI par NF": "SBI errors per NF", "Latence par procédure": "Latency per procedure", "Taux de liens EXACT": "EXACT link rate", "Séries": "Series", "Heatmap causes × temps": "Causes × time heatmap", "Top-N": "Top-N", "Granularité": "Granularity", "Aucune donnée à afficher": "No data to display", "Chaque point cliquable ouvrira l'Analyzer pré-filtré (fenêtre + dimension).": "Each clickable point will open the Analyzer pre-filtered (window + dimension).", "Requête générée": "Generated query", "Fiche KPI": "KPI sheet", "Formule": "Formula", "Événements sources": "Source events", "Dimensions": "Dimensions", "Unité": "Unit", "Règle de dédup": "Dedup rule", "Invariant": "Invariant", "Explorer dans l'Analyzer →": "Explore in Analyzer →", "Anomalies": "Anomalies", "Règles et invariants": "Rules and invariants", "Nouveauté": "Novelty", "Invariant de comptage": "Counting invariant", "succès + échec = total, par procédure et par minute": "success + failure = total, per procedure per minute", "Cause obligatoire": "Mandatory cause", "toute procédure en échec porte une cause (NAS, Diameter, HTTP…)": "every failed procedure carries a cause (NAS, Diameter, HTTP…)", "Ordre canonique": "Canonical order", "seq strictement croissant dans une capture (capture_id, seq)": "seq strictly increasing within a capture (capture_id, seq)", "Cause jamais vue": "Never-seen cause", "une cause d’échec absente du référentiel historique": "a failure cause absent from the historical reference", "Séquence hors flux 3GPP": "Out-of-flow 3GPP sequence", "enchaînement de messages incompatible avec la procédure": "message sequence incompatible with the procedure", "jamais déclenchée": "never triggered", "Une anomalie se ferme avec une preuve, ou reste OUVERTE.": "An anomaly closes with evidence, or stays OPEN.", "Requêtes": "Queries", "Requête": "Query", "Session": "Session", "Comparaison": "Comparison", "Trace": "Trace", "Fermer l'onglet": "Close tab", "Nouvel onglet": "New tab", "Vue partagée": "Shared view", "Toutes les sessions": "All sessions", "Nouvelle requête": "New query"};
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
const Tag = ({i}) => <span className="inline-block font-mono text-[10.5px] font-semibold leading-none rounded-[3px] px-1.5 py-[3px]" style={{color:IFC[i][0],background:IFC[i][1]}}>{i}</span>;
const Res = ({r}) => <span className="inline-flex items-center gap-1.5"><span className={`w-[7px] h-[7px] rounded-full ${r==='Succès'?'bg-[#15803D]':'bg-[#C2410C]'}`}/>{r}</span>;
const Stat = ({s}) => {
  const m = {'EXACT':'text-[#15803D] bg-[#ECF8F0] border-[#BFE5CC]','À PROUVER':'text-[#A15C07] bg-[#FDF6E7] border-[#F1D9A8]','ABSENT':'text-[#B42318] bg-[#FDEFEE] border-[#F5C6C2]'}[s];
  return <span className={`inline-block text-[10.5px] font-semibold tracking-wide border rounded-[3px] px-1.5 py-[2px] ${m}`}>{s}</span>;
};
const Lbl = ({children}) => <div className="text-[11px] font-semibold text-[#666666] uppercase tracking-[0.06em] mb-1.5">{children}</div>;

function TopBar({role,setRole,page,setPage,onAnalyzer,accent,onSettings}) {
  const [menu,setMenu] = useState(false);
  return (
    <header className="h-12 shrink-0 bg-white border-b border-[#EBEBEB] flex items-center px-4 gap-6">
      <div className="flex items-center gap-2">
        <div style={{background:accent}} className="w-6 h-6 rounded-[5px] grid place-items-center"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" fill="#fff"/></svg></div>
        <span className="text-[14px] font-semibold tracking-tight text-[#171717]">POLARIS</span>
      </div>
      <nav className="flex h-full">
        {[['home','Accueil'],['sessions','Analyzer'],['kpi','KPI'],['live','Live'],['trafic','Traffic'],['templates','Templates']].map(([k,n]) => {
          const on = page===k, ok = ['home','sessions','nodes','templates','kpi','live','trafic'].includes(k);
          return <button key={k} type="button" onClick={()=>{ if(ok) { setPage(k); if((k==='sessions'||k==='templates') && onAnalyzer) onAnalyzer(); } }} className={`relative px-3 h-full flex items-center text-[13px] ${ok?'cursor-pointer':'cursor-default'} ${on?'text-[#171717] font-semibold':'text-[#666666] hover:text-[#171717]'}`}>{t(n)}{on && <span style={{background:accent}} className="absolute inset-x-3 bottom-0 h-[2px]"/>}</button>;
        })}
      </nav>
      <div className="ml-auto flex items-center gap-4 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-[#666666]"><span className="w-[7px] h-[7px] rounded-full bg-[#15803D]"/>{t("Données à jour · retard 4 s")}</span>
        <div className="flex rounded-md border border-[#EBEBEB] p-[2px] bg-[#FAFAFA]">
          {['viewer','operator'].map(r => <button key={r} onClick={()=>setRole(r)} className={`px-2.5 h-6 rounded-[4px] text-[12px] ${role===r ? (r==='operator'?'bg-[#A15C07] text-white':'bg-white text-[#171717] shadow-sm') : 'text-[#666666]'}`}>{r==='operator'?'operator':'viewer'}</button>)}
        </div>
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
          <span className="font-semibold text-[#171717] tabular-nums">{rows.length}</span> sessions
          <div className="w-16 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden flex"><div className="bg-[#15803D]" style={{width:`${rows.length?(rows.length-ko)/rows.length*100:0}%`}}/><div className="bg-[#C2410C]" style={{width:`${rows.length?ko/rows.length*100:0}%`}}/></div>
          <span className="tabular-nums">{ko} échecs</span>
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
            {rows.map(r => {
              const on = sel===r.id;
              return (
                <tr key={r.id} onClick={()=>setSel(r.id)} className={`cursor-pointer ${on?'bg-[color-mix(in_oklab,var(--app-accent)_8%,white)]':'hover:bg-[#FAFAFA]'}`}>
                  <td className={`h-8 px-3 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666] ${on?'shadow-[inset_3px_0_0_var(--app-accent)]':''}`}>c{r.cap} · {r.seq}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px] text-[#171717]">{r.ue}</td>
                  <td className="px-3 border-b border-[#F2F2F2]">{r.rat}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#171717]">{r.proc}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><Res r={r.res}/></td>
                  <td className={`px-3 border-b border-[#F2F2F2] ${r.res==='Échec'?'text-[#B42318]':'text-[#666666]'}`}>{r.cause || '—'}</td>
                  <td className="px-3 border-b border-[#F2F2F2]"><span className="flex gap-1">{[...new Set(r.d.msgs.map(m=>m[0]))].map(i=><Tag key={i} i={i}/>)}</span></td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[12px]">{r.ex}</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums">{r.comp} %</td>
                  <td className="px-3 border-b border-[#F2F2F2] tabular-nums text-[#666666]">{r.dur}</td>
                  <td className="px-3 border-b border-[#F2F2F2] text-[#666666]">{r.cell}</td>
                  <td className="px-3 border-b border-[#F2F2F2] font-mono text-[11.5px]">{role==='operator' ? <span className="text-[#A15C07]">{r.imsi}</span> : <span className="text-[#D4D4D4]">masqué</span>}</td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-[#666666]">Aucune session ne correspond à ces {conds.length} conditions. Retire une condition pour élargir.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const isCause = m => !!(m && m[4] && /^cause|code|result/i.test(m[4]));
function useWidth() {
  const ref = useRef(null); const [w,setW] = useState(900);
  useEffect(()=>{ if(!ref.current) return; const ro = new ResizeObserver(e=>setW(Math.floor(e[0].contentRect.width))); ro.observe(ref.current); return ()=>ro.disconnect(); },[]);
  return [ref,w];
}
function Ladder({d,sel,setSel,lens,hidden,collapsed,width}) {
  const W = Math.max(720, width), LG = 170, n = d.nodes.length, ROW = 30, TOP = 46;
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
        const y = TOP + row*ROW + 18, x1 = x(a), x2 = x(b), dir = x2>x1?1:-1, c = IFC[m[0]][0];
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
          <span className="ml-auto flex items-center gap-4 text-[12px] text-[#666666]"><span><b className="text-[#171717] tabular-nums">{d.msgs.length}</b> messages</span><span><b className="text-[#171717] tabular-nums">{ex}/{d.links.length}</b> liens EXACT</span><span><b className="text-[#171717] tabular-nums">{s.comp} %</b> complétude</span></span>
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#4D4D4D]">{d.summary}{d.diverge && <span className="ml-2 text-[#B42318]">{d.diverge}</span>}</div>
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
        <div className="ml-auto flex items-center gap-1 shrink-0">
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
            <td className="h-7 px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#8F8F8F] w-12">{k+1}</td><td className="px-2 border-b border-[#F2F2F2] w-20"><Tag i={m[0]}/></td>
            <td className="px-2 border-b border-[#F2F2F2]">{m[1]}{m[3]&&<span className="text-[#666666]"> · {m[3]}</span>}</td><td className="px-2 border-b border-[#F2F2F2] text-[#666666]">{m[2]}</td>
            <td className="px-4 border-b border-[#F2F2F2] font-mono text-[11.5px] text-[#666666]">{m[4]?`${m[4]} ${m[5]}`:''}</td></tr>))}</tbody></table>}
        {tab==='Corrélation' && <table className="w-full text-[12.5px]"><thead><tr>{['De','Vers','Clé','Messages','Statut'].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#EBEBEB]">{h}</th>)}</tr></thead><tbody>{d.links.map((l,k)=>(
          <tr key={k}><td className="h-8 px-4 border-b border-[#F2F2F2]"><Tag i={l[2]}/></td><td className="px-4 border-b border-[#F2F2F2]"><Tag i={l[3]}/></td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px]">{l[4]}</td><td className="px-4 border-b border-[#F2F2F2] font-mono text-[12px] text-[#666666]">{l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun'}</td><td className="px-4 border-b border-[#F2F2F2]"><Stat s={l[5]}/></td></tr>))}</tbody></table>}
        {(tab==='Plan usager'||tab==='Comparer') && <div className="p-8 text-[13px] text-[#666666]">{tab==='Plan usager' ? 'Volumes UL / DL par TEID, comparés aux règles N4 et aux rapports d’usage PFCP.' : 'Choisis une session réussie de même procédure pour aligner les deux flux et voir le point de bifurcation.'}</div>}
      </div>
    </section>
  );
}

function Inspector({s,sel,role,lens,setLens,width,onHide}) {
  const [tab,setTab] = useState(()=>{ try { return localStorage.getItem('polaris-insp-tab')||'Décodage'; } catch(e) { return 'Décodage'; } });
  useEffect(()=>{ try { localStorage.setItem('polaris-insp-tab',tab); } catch(e) {} },[tab]);
  const d = s.d, m = d.msgs[Math.min(sel,d.msgs.length-1)];
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
            <dt className="text-[#8F8F8F]">capture_id</dt><dd>{s.cap}</dd><dt className="text-[#8F8F8F]">seq</dt><dd>{s.seq+sel*3}</dd>
            <dt className="text-[#8F8F8F]">packet_number</dt><dd>{(s.seq+sel*3)*2+1}</dd><dt className="text-[#8F8F8F]">décodeur</dt><dd>2.10.2</dd>
          </dl>
          <div className="rounded-md border border-[#EBEBEB] bg-[#FAFAFA] p-3 font-mono text-[11.5px] leading-[1.9] text-[#4D4D4D]">
            <div>▾ {m[1].split(' ')[0]} PDU</div>
            <div className="pl-4">▾ {m[1].split(' ').slice(1).join(' ')}</div>
            <div className="pl-8">ue : <span className="text-[#171717]">{s.ue}</span> <span className="text-[#8F8F8F]">(pseudonyme)</span></div>
            {m[3] && <><div className="pl-8">▾ NAS-PDU</div><div className="pl-12">message : <span className="text-[#171717]">{m[3]}</span></div>
              <div className="pl-12">identité : {role==='operator' ? <span className="text-[#A15C07]">{s.imsi}</span> : <span className="text-[#8F8F8F]">masquée</span>}</div></>}
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
        {tab==='Preuves' && <div className="space-y-2">{d.links.map((l,k)=>(
          <div key={k} className="rounded-md border border-[#EBEBEB] p-3"><div className="flex items-center gap-2"><Tag i={l[2]}/><span className="text-[#8F8F8F]">→</span><Tag i={l[3]}/><span className="ml-auto"><Stat s={l[5]}/></span></div>
          <div className="font-mono text-[11.5px] mt-2 text-[#4D4D4D]">{l[4]}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">messages {l[0]+1}{l[1]!==null?` ↔ ${l[1]+1}`:' → aucun message N4'}</div></div>))}</div>}
        {tab==='Hex' && <pre className="font-mono text-[11px] leading-5 text-[#4D4D4D] whitespace-pre-wrap">{`0000  00 0f 40 4b 00 00 05 00 55 00 02 00 01 00 26 00
0010  1a 19 7e 00 41 79 00 0d 01 00 f1 10 00 00 00 00
0020  •• •• •• •• •• 2e 04 f0 f0 f0 f0 00 79 00 13 50
0030  00 f1 10 00 00 00 01 00 f1 10 00 00 01 00 5a 40`}<div className="mt-3 text-[#8F8F8F] font-sans">Octets d’identité masqués en rôle {role}.</div></pre>}
        {tab==='Identité' && (role==='operator' ? <div className="space-y-2">
          <div className="rounded-md border border-[#F1D9A8] bg-[#FDF6E7] p-3 text-[#7A4505]">Rôle operator · consultation journalisée · identités fictives (PLMN 001/01).</div>
          {[['IMSI / SUPI',s.imsi,'SBI Nausf · EXACT'],['5G-GUTI','00101-01-01-•••-0x1a2b','Registration Accept · EXACT']].map(([k,v,p])=><div key={k} className="rounded-md border border-[#EBEBEB] p-3"><div className="text-[11px] uppercase tracking-[0.06em] text-[#666666] font-semibold">{k}</div><div className="font-mono text-[#A15C07] mt-1">{v}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">rattaché par {p}</div></div>)}
        </div> : <div className="text-center py-10 text-[#666666]"><I d={ic.lock} c="w-5 h-5 mx-auto text-[#8F8F8F]"/><div className="mt-2 font-medium text-[#171717]">Identités masquées</div><div className="mt-1">Passe en rôle operator pour voir l’IMSI et sa chaîne de rattachement.</div></div>)}
      </div>
    </aside>
  );
}


/* ------------------------------ ACCUEIL ------------------------------ */
const NODES = [
  {n:'oiran-capture-01',role:'Capture',st:'ok',ver:'OIRAN 2.10.2',exp:'2.10.2',cpu:31,mem:[2.1,4],disk:76,seen:'il y a 2 s',info:'12/12 dumpcap · PID stables'},
  {n:'oiran-import-01',role:'Import et décodage',st:'ok',ver:'OIRAN 2.10.2',exp:'2.10.2',cpu:58,mem:[2.9,4],disk:76,seen:'il y a 2 s',info:'retard 4 s · 0 segment ignoré'},
  {n:'oiran-dataset',role:'Base / dataset',st:'warn',ver:'schéma 7',exp:'7',cpu:22,mem:[1.4,4],disk:76,seen:'il y a 5 s',info:'~1,5 M événements · disque en hausse'},
  {n:'analyzer-api',role:'API Analyzer',st:'ok',ver:'Analyzer 0.6.0',exp:'0.6.0',cpu:9,mem:[0.4,1],disk:41,seen:'il y a 1 s',info:'p95 requête 0,8 s'},
  {n:'polaris-control',role:'Orchestrateur',st:'ok',ver:'API 0.30.0 · sim 0.13.4',exp:'0.30.0',cpu:12,mem:[0.6,2],disk:41,seen:'il y a 3 s',info:'run 5G #482 terminé'},
  {n:'open5gs-core',role:'Cœur 5G / EPC (observé)',st:'ok',ver:'Open5GS 2.8.0',exp:'2.8.0',cpu:null,mem:null,disk:null,seen:'trafic vu il y a 1 s',info:'AMF, SMF, UPF, MME actifs'},
];
const IFACES = ['N2','N3','N4','SBI','N6','S1-MME','S1-U','S5-U','S11','S5-C','S6a','Sxa/Sxb'];
const Dot = ({st}) => <span className={`w-[8px] h-[8px] rounded-full ${st==='ok'?'bg-[#15803D]':st==='warn'?'bg-[#D97706]':'bg-[#B42318]'}`}/>;
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
  ['KPI & Anomalies','Indicateurs par procédure et détection d\'écarts.','M4 20V10M10 20V4M16 20v-7M22 20H2','kpi'],
  ['Live','Suivi en temps réel des sessions capturées.','M3 12h4l3-8 4 16 3-8h4','live'],
  ['Traffic','Débit, santé TCP, applications, congestion','M4 7h16M4 12h16M4 17h16','trafic'],
  ['Templates','Requêtes enregistrées et modèles prêts à l\'emploi.','M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z','templates'],
  ['Nœuds','Topologie et état des nœuds du réseau.','M12 5v4M5 19l4-5M19 19l-4-5M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM4 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM20 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z','nodes',true],
];
const Soon = () => <span className="text-[10.5px] font-medium text-[#8F8F8F] border border-[#EBEBEB] rounded px-1.5 py-[1px]">{t("Bientôt")}</span>;

function Home({setPage,onNew}) {
  const go = t => t && setPage(t);
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-white">
      <div className="max-w-[1120px] mx-auto px-8 pt-14 pb-16">
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
            {MODULES.map(([n,desc,d,tg,adm])=>(
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
              {[['Analyse','Run 5G #482 · Registration','il y a 3 min','sessions'],['KPI','Succès PDU Session · 15 min','il y a 12 min','kpi'],['Template','Échecs Attach par cellule','il y a 40 min','templates'],['Analyse','Run 4G #219 · E-RAB Setup','il y a 2 h','sessions']].map(([ty,n,w,tg])=>(
                <button key={n} onClick={()=>setPage(tg)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FAFAFA]"><span className="text-[11px] font-medium text-[#666666] bg-[#F5F5F5] rounded px-1.5 py-[1px] w-16 text-center">{t(ty)}</span><span className="text-[13px] text-[#171717] truncate">{n}</span><span className="ml-auto text-[12px] text-[#8F8F8F] shrink-0">{t(w)}</span></button>))}
            </div>
            <div className="hidden">
              <div className="mx-auto w-9 h-9 rounded-full bg-[#F5F5F5] grid place-items-center text-[#8F8F8F]"><I d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" c="w-4 h-4"/></div>
              <div className="mt-3 text-[14px] font-medium text-[#171717]">{t("Aucune activité pour l'instant")}</div>
              <div className="mt-1 text-[13px] text-[#666666]">{t("Vos analyses, requêtes KPI, templates et runs consultés apparaîtront ici.")}</div>
              <button onClick={()=>onNew?onNew():setPage('sessions')} className="mt-4 text-[13px] font-medium text-[#171717] hover:underline">{t("Lancer une analyse →")}</button>
            </div>
          </section>
          <section>
            <div className="flex items-center mb-4"><h2 className="text-[13px] font-semibold text-[#171717]">{t("État de la plateforme")}</h2><button onClick={()=>setPage('nodes')} className="ml-auto text-[12.5px] font-medium text-[#171717] hover:underline">{t("Voir la supervision")}</button></div>
            <div className="rounded-xl border border-[#EBEBEB] divide-y divide-[#F2F2F2]">
              {[['Capture','dumpcap actifs / attendus','12 / 12','#15803D'],['Fraîcheur des données','dernier import','4 s','#15803D'],['Alertes','points de vigilance','3','#B42318']].map(([n,d,v,c])=>(
                <div key={n} className="px-4 py-3.5 flex items-center gap-3">
                  <span className="w-[7px] h-[7px] rounded-full" style={{background:c}}/>
                  <div className="min-w-0"><div className="text-[13.5px] text-[#171717]">{t(n)}</div><div className="text-[12px] text-[#8F8F8F]">{t(d)}</div></div>
                  <span className="ml-auto text-[13px] font-medium tabular-nums text-[#171717]">{v}</span>
                </div>))}
            </div>
            <p className="mt-3 text-[12px] text-[#A15C00]">{t("Données de démo — OIRAN non connecté.")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Nodes() {
  const [node,setNode] = useState(null);
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
        <div className="flex items-end gap-6">
          <div><div className="text-[12px] text-[#666666]">POLARIS Nœuds</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">Gestion des nœuds</h1>
            <div className="text-[13px] text-[#666666] mt-1">6 nœuds joignables · versions servies conformes · disque à surveiller.</div></div>
          <div className="ml-auto flex gap-2">
            <button className="h-9 px-4 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium flex items-center gap-2"><I d={ic.plus} c="w-4 h-4"/>Ajouter un nœud</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Déploiements</button>
            <button className="h-9 px-4 rounded-md border border-[#EBEBEB] bg-white text-[13px] text-[#4D4D4D] hover:bg-[#FAFAFA]">Journal d’audit</button>
          </div>
        </div>
        <div className="space-y-5">
            <Card title="Nœuds de la plateforme">
              <table className="w-full text-[12.5px]">
                <thead><tr>{['Nœud','Rôle','État','Version servie','CPU','Mémoire','Disque','Dernier contact',''].map(h=><th key={h} className="h-8 px-4 text-left font-medium text-[#666666] bg-[#FAFAFA] border-b border-[#F2F2F2]">{h}</th>)}</tr></thead>
                <tbody>
                  {NODES.map(n => (
                    <React.Fragment key={n.n}>
                      <tr onClick={()=>setNode(node===n.n?null:n.n)} className={`cursor-pointer ${node===n.n?'bg-[#FAFAFA]':'hover:bg-[#FAFAFA]'}`}>
                        <td className="h-11 px-4 border-b border-[#F2F2F2]"><div className="font-mono text-[12px] text-[#171717]">{n.n}</div><div className="text-[11.5px] text-[#8F8F8F]">{n.info}</div></td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#4D4D4D]">{n.role}</td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="inline-flex items-center gap-1.5"><Dot st={n.st}/>{n.st==='ok'?'Opérationnel':'Vigilance'}</span></td>
                        <td className="px-4 border-b border-[#F2F2F2]"><span className="font-mono text-[11.5px]">{n.ver}</span>{n.ver.includes(n.exp) && <span className="ml-1.5 text-[11px] text-[#15803D]">✓ attendue</span>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.cpu===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.cpu}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.mem===null?<span className="text-[#D4D4D4]">—</span>:<div><Bar v={Math.round(n.mem[0]/n.mem[1]*100)}/><div className="text-[10.5px] text-[#8F8F8F] mt-0.5">{n.mem[0]} / {n.mem[1]} Go MemoryMax</div></div>}</td>
                        <td className="px-4 border-b border-[#F2F2F2]">{n.disk===null?<span className="text-[#D4D4D4]">—</span>:<Bar v={n.disk}/>}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#666666]">{n.seen}</td>
                        <td className="px-4 border-b border-[#F2F2F2] text-[#8F8F8F]"><I d={ic.chev} c={`w-4 h-4 transition ${node===n.n?'rotate-180':''}`}/></td>
                      </tr>
                      {node===n.n && (
                        <tr><td colSpan="9" className="bg-[#FAFAFA] border-b border-[#F2F2F2] px-4 py-4">
                          <div className="grid grid-cols-3 gap-6 text-[12.5px]">
                            <div><Lbl>Services</Lbl>{(n.role==='Capture'?['dumpcap × 12','ring buffer','agent POLARIS']:n.role.startsWith('Import')?['oiran-import.service','décodeurs 5G/4G','corrélation']:['service principal','agent POLARIS']).map(x=><div key={x} className="flex items-center gap-2 h-6"><Dot st="ok"/>{x}</div>)}</div>
                            <div><Lbl>Dernier déploiement</Lbl><div>2.10.2 · ANR1 · sauvegarde SHA256 OK</div><div className="text-[#8F8F8F] mt-1">rollback disponible vers 0d1b0e9</div></div>
                            <div><Lbl>Actions</Lbl><div className="flex flex-wrap gap-2"><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Journal</button><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Configuration</button><button className="h-7 px-2.5 rounded border border-[#EBEBEB] bg-white">Historique</button></div><div className="text-[11.5px] text-[#8F8F8F] mt-2">Toute action sensible demande un motif et est journalisée.</div></div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-2 gap-5">
              <Card title="Capture · 12 interfaces" action="Détails">
                <div className="p-4 grid grid-cols-4 gap-2">
                  {IFACES.map(i => <div key={i} className="rounded-md border border-[#EBEBEB] px-2.5 py-2"><div className="flex items-center gap-1.5 text-[12px] font-medium"><Dot st="ok"/>{i}</div><div className="text-[10.5px] text-[#8F8F8F] mt-0.5 font-mono">PID stable</div></div>)}
                </div>
                <div className="px-4 pb-4 text-[11.5px] text-[#666666]">Aucun dumpcap arrêté depuis le dernier déploiement · paquets perdus noyau : 0</div>
              </Card>
              <Card title="Base de données et sauvegardes" action="Ouvrir">
                <div className="p-4 space-y-3 text-[12.5px]">
                  <div className="flex items-center"><span className="text-[#666666] w-40">Disque</span><Bar v={76}/><span className="ml-2 text-[11.5px] text-[#D97706]">en hausse</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Événements publiés</span><span className="tabular-nums font-medium">~1,5 M</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Intégrité</span><span>0 perte · 0 doublon</span><span className="ml-2 text-[11.5px] text-[#8F8F8F]">recette ANR2</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Dernière sauvegarde</span><span>aujourd’hui 13:48 · SHA256 vérifié</span></div>
                  <div className="flex items-center"><span className="text-[#666666] w-40">Dernière restauration testée</span><span className="text-[#D97706]">jamais — à planifier</span></div>
                </div>
              </Card>
            </div>
          </div>

        <div className="text-[11.5px] text-[#8F8F8F]">Données de démonstration.</div>
      </div>
    </div>
  );
}

const SAVED = [
  {n:'Échecs · run 482',g:'Parcourir',p:'Run 5G #482',c:[['Résultat','Échec']],last:'il y a 12 min',r:3,fav:true},
  {n:'PDU Session 5G · toutes causes',g:'Parcourir',p:'Captures c41 → c43',c:[['Procédure','PDU Session'],['RAT','5G SA']],last:'il y a 1 h',r:1,fav:true},
  {n:'Attach LTE · certification',g:'Parcourir',p:'lte-run-976bd44b',c:[['Procédure','Attach'],['RAT','LTE']],last:'hier',r:2},
  {n:'Sessions passant par N4',g:'Inspecter',p:'Run 5G #482',c:[['Interface','N4']],last:'hier',r:4,shared:true},
  {n:'Erreurs S6a',g:'Parcourir',p:'Captures c41 → c43',c:[['Cause','S6a 5001']],last:'il y a 3 j',r:1,shared:true},
];
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
const mkDraft = (o={}) => ({tpl:'Parcourir',scope:'Run 5G #482',conds:[],join:'ET',group:'Aucun',name:'',...o});

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
        <div className="text-[11.5px] text-[#8F8F8F]">Données de démonstration.</div>
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

function QueryEditor({draft,setDraft,dirty,run,save,cancel,role}) {
  const [f,setF] = useState(FIELDS[0][0]);
  const [v,setV] = useState(FIELDS[0][1][0]);
  const [op,setOp] = useState('=');
  const [err,setErr] = useState('');
  const vals = (FIELDS.find(x=>x[0]===f)||FIELDS[0])[1];
  const up = o => setDraft({...draft,...o});
  const count = SESS.filter(s=>matchQ(s,draft.conds,draft.join)).length;
  const idField = x => x==='UE' || x==='IMSI';
  const exec = () => {
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
          <span className="ml-auto text-[12px] text-[#666666]">{dirty && <span className="mr-3 inline-flex items-center gap-1.5 text-[#A15C07]"><span className="w-1.5 h-1.5 rounded-full bg-[#A15C07]"/>Modifications non enregistrées</span>}Aperçu : <b className="text-[#171717] tabular-nums">{count}</b> sessions</span>
        </div>
        <QSec n={1} title="Gabarit" sub="ce que la requête retourne">
          <div className="grid grid-cols-4 gap-2">{TPLS.map(([x,d]) => <button key={x} onClick={()=>up({tpl:x})} className={`text-left rounded-md border px-3 py-2 transition ${draft.tpl===x?'border-[var(--app-accent)] ring-1 ring-[var(--app-accent)]':'border-[#EBEBEB] hover:border-[#D4D4D4]'}`}><div className="text-[13px] font-medium uppercase tracking-wide">{x}</div><div className="text-[11.5px] text-[#8F8F8F] mt-0.5">{d}</div></button>)}</div>
        </QSec>
        <QSec n={2} title="Portée" sub="run, captures ou fenêtre horaire">
          <div className="flex flex-wrap gap-2">{SCOPES.map(x => <button key={x} onClick={()=>up({scope:x})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.scope===x?'border-[var(--app-accent)] bg-[var(--app-accent)] text-white':'border-[#EBEBEB] text-[#4D4D4D] hover:border-[#D4D4D4]'}`}>{x}</button>)}</div>
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
              <select value={f} onChange={e=>{setF(e.target.value); setV(FIELDS.find(x=>x[0]===e.target.value)[1][0]);}} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white">{FIELDS.map(x=><option key={x[0]} disabled={idField(x[0]) && x[0]==='IMSI' && role!=='operator'}>{x[0]}</option>)}</select>
              <select value={op} onChange={e=>setOp(e.target.value)} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white"><option>=</option><option>≠</option></select>
              <select value={v} onChange={e=>setV(e.target.value)} className="h-8 rounded-md border border-[#EBEBEB] text-[12.5px] px-2 bg-white min-w-[180px]">{vals.map(x=><option key={x}>{x}</option>)}</select>
              <button onClick={()=>up({conds:[...draft.conds,[f,v,op]]})} className="h-8 px-3 rounded-md border border-[#EBEBEB] text-[12.5px] hover:bg-[#FAFAFA] flex items-center gap-1.5"><I d={ic.plus} c="w-3.5 h-3.5"/>Ajouter</button>
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-[#8F8F8F]"><I d={ic.lock} c="w-3 h-3"/>Identités : rôle operator</span>
            </div>
          </div>
        </QSec>
        <QSec n={4} title="Regrouper par" sub="facultatif">
          <div className="flex flex-wrap gap-2">{GROUPS.map(g=><button key={g} onClick={()=>up({group:g})} className={`h-8 px-3 rounded-md border text-[12.5px] ${draft.group===g?'border-[var(--app-accent)] text-[#171717] ring-1 ring-[var(--app-accent)]':'border-[#EBEBEB] text-[#666666] hover:border-[#D4D4D4]'}`}>{g}</button>)}</div>
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
  const [sec,setSec]=useState('apparence');
  const [cur,setCur]=useState(''),[nw,setNw]=useState(''),[cf,setCf]=useState(''),[pm,setPm]=useState(null);
  const accent = THEMES.find(t=>t[0]===theme)[2];
  const save = e => { e.preventDefault(); if(!cur||nw.length<8) return setPm(['err',t("Mot de passe actuel requis et 8 caractères minimum.")]); if(nw!==cf) return setPm(['err',t("Les mots de passe ne correspondent pas.")]); setPm(['ok',t("Mot de passe mis à jour.")]); setCur('');setNw('');setCf(''); };
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
      <div className="relative z-10 max-w-[1080px] mx-auto px-8 -mt-12 pb-16">
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
            {sec==='securite' && <Card title={t("Mot de passe")} desc={t("Utilisez au moins 8 caractères, avec majuscules, chiffres et symboles.")}>
              <form onSubmit={save} className="space-y-5 max-w-[460px]" style={{'--tw-ring-color':accent+'55'}}>
                {[['Mot de passe actuel',cur,setCur],['Nouveau mot de passe',nw,setNw],['Confirmer le mot de passe',cf,setCf]].map(([l,v,fn],i)=>(
                  <label key={l} className="block"><span className="block text-[13.5px] font-medium mb-1.5">{t(l)}</span>
                    <input type="password" value={v} onChange={e=>fn(e.target.value)} className={inp}/>
                    {i===1 && nw && <div className="mt-2 flex gap-1.5">{[0,1,2,3].map(j=><span key={j} className="h-1.5 flex-1 rounded-full" style={{background:j<strength?accent:'#EBEBEB'}}/>)}</div>}
                  </label>))}
                {pm && <div className={`text-[13.5px] rounded-lg px-3.5 py-2.5 ${pm[0]==='ok'?'bg-[#ECF8F0] text-[#15803D]':'bg-[#FDEFEE] text-[#B42318]'}`}>{pm[1]}</div>}
                <button type="submit" style={{background:accent}} className="h-11 px-6 rounded-lg text-white text-[14px] font-semibold shadow-sm hover:opacity-90">{t("Mettre à jour le mot de passe")}</button>
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
              <div className="grid grid-cols-2 gap-5">{[['POLARIS Analyzer','0.6.0'],['OIRAN','2.10.2']].map(([n,v])=>(
                <div key={n} className="rounded-xl border border-[#EBEBEB] p-5"><div className="text-[13px] text-[#666666]">{n}</div><div className="mt-1 text-[26px] font-semibold tracking-tight font-mono" style={{color:accent}}>{v}</div></div>))}</div>
            </Card>}
          </div>
        </div>
      </div>
    </div>);
}

/* ---------------- Live (IMSI trace · débit · RTP) — données de démo ---------------- */
const LIVE_SCRIPT = [
  ['N1','UE','AMF','Registration Request','5GMM'],['N2','gNB','AMF','Initial UE Message','NGAP'],
  ['SBI','AMF','AUSF','POST /ue-authentications','HTTP/2'],['SBI','AUSF','UDM','POST /generate-auth-data','HTTP/2'],
  ['N1','AMF','UE','Authentication Request','5GMM'],['N1','UE','AMF','Authentication Response','5GMM'],
  ['N1','AMF','UE','Security Mode Command','5GMM'],['N1','UE','AMF','Security Mode Complete','5GMM'],
  ['N1','AMF','UE','Registration Accept (5G-GUTI₂)','5GMM'],['N1','UE','AMF','PDU Session Est. Request','5GSM'],
  ['SBI','AMF','SMF','POST /sm-contexts','HTTP/2'],['N4','SMF','UPF','PFCP Session Est. Request','PFCP'],
  ['N4','UPF','SMF','PFCP Session Est. Response','PFCP'],['N2','AMF','gNB','PDU Session Resource Setup Req','NGAP'],
  ['N2','gNB','AMF','PDU Session Resource Setup Resp','NGAP'],['N1','AMF','UE','PDU Session Est. Accept','5GSM'],
  ['N4','UPF','SMF','PFCP Session Report (usage)','PFCP'],['N1','UE','AMF','Service Request','5GMM'],
];
const LIVE_NODES = ['UE','gNB','AMF','AUSF','UDM','SMF','UPF'];
const IFC_C = {N1:'#0062A1',N2:'#7C3AED',SBI:'#0F5B56',N4:'#A15C07'};
const LIVE_CHAIN = [
  ['SUPI','imsi-20801••••••4821','Registration Request (SUCI déchiffré, SBI)','EXACT'],
  ['5G-GUTI₁','208-01-02-3F-0A1B2C3D','Registration Accept #1 · seq 1 204','EXACT'],
  ['5G-GUTI₂','208-01-02-3F-0A7E91F0','Configuration Update Command · seq 1 877','EXACT'],
  ['5G-S-TMSI','3F-0A7E91F0','Service Request · seq 2 310','À PROUVER'],
];
const LIVE_JOURNAL = [['00:31:42','SD','operator','trace créée','pseudo ue-7f3a'],['00:12:09','SD','operator','recherche IMSI','empreinte sha256:9c1e…'],['23:58:30','MB','viewer','consultation historique','pseudo ue-21c0']];

function Live({role}) {
  const [target,setTarget] = useState('ue-7f3a');
  const [running,setRunning] = useState(true);
  const [msgs,setMsgs] = useState([]);
  const [buf,setBuf] = useState(0);
  const [ttl,setTtl] = useState(30*60);
  const [delay,setDelay] = useState(4);
  const [thr,setThr] = useState(()=>Array.from({length:40},(_,i)=>[40+Math.sin(i/3)*12, 6+Math.cos(i/4)*2]));
  const seq = React.useRef(0);
  useEffect(()=>{ const id=setInterval(()=>{
    const s=LIVE_SCRIPT[seq.current%LIVE_SCRIPT.length]; seq.current++;
    const m={seq:2400+seq.current, ts:new Date().toLocaleTimeString('fr-FR'), ifc:s[0], from:s[1], to:s[2], name:s[3], proto:s[4]};
    if(running) setMsgs(x=>[...x.slice(-60), m]); else setBuf(b=>b+1);
    if(running) setMsgs(x=>x); 
    setTtl(v=>Math.max(0,v-1)); setDelay(3+Math.round(Math.random()*3));
    setThr(x=>[...x.slice(1),[35+Math.random()*25, 4+Math.random()*5]]);
  },1100); return ()=>clearInterval(id); },[running]);
  const resume = () => { const n=buf; const add=[]; for(let i=0;i<n;i++){ const s=LIVE_SCRIPT[(seq.current-n+i)%LIVE_SCRIPT.length]; add.push({seq:2400+seq.current-n+i+1,ts:'(tampon)',ifc:s[0],from:s[1],to:s[2],name:s[3],proto:s[4]}); } setMsgs(x=>[...x,...add].slice(-60)); setBuf(0); setRunning(true); };
  const box = React.useRef(null);
  useEffect(()=>{ if(box.current) box.current.scrollTop=box.current.scrollHeight; },[msgs]);
  const W=640, colW=W/LIVE_NODES.length, cx=n=>colW*LIVE_NODES.indexOf(n)+colW/2;
  const ul=thr[thr.length-1][1], dl=thr[thr.length-1][0], pfcp=dl*1.03;
  const path=(k,mx)=>thr.map((p,i)=>`${i?'L':'M'}${(i*(W/39)).toFixed(1)},${(120-p[k]/mx*110).toFixed(1)}`).join(' ');
  const card="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden";
  const head=(n,extra)=><div className="h-11 px-4 flex items-center gap-2 border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{t(n)}</h3>{extra}</div>;
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-[#FAFAFA]">
      <div className="sticky top-0 z-10 bg-[#FFF7E6] border-b border-[#FCE2B0] text-[#A15C00] text-[12.5px] px-8 h-8 flex items-center gap-2"><span className="w-[7px] h-[7px] rounded-full bg-[#A15C00] animate-pulse"/>{t("Live delayed by")} {delay} s<span className="ml-auto text-[11.5px]">{t("Données de démo")} · {t("flux pris après décodage — dumpcap jamais touchés")}</span></div>
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
        <div className="flex flex-wrap items-end gap-6">
          <div><div className="text-[12px] text-[#666666]">POLARIS Live</div><h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">{t("Trace live")}</h1><div className="text-[13px] text-[#666666] mt-1">{t("Suivi en temps réel des sessions capturées.")}</div></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-[#EBEBEB] bg-white focus-within:border-[var(--app-accent)] w-[300px]">
              <span className="text-[11px] text-[#8F8F8F]">{t("Cible")}</span>
              <input value={target} onChange={e=>setTarget(e.target.value)} placeholder={role==='operator'?'pseudo, IMSI, SUPI, MSISDN':'pseudonyme'} className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-mono"/>
            </div>
            <button onClick={()=>running?setRunning(false):resume()} className="h-9 px-4 rounded-lg bg-[var(--app-accent)] hover:opacity-90 text-white text-[13px] font-medium">{running?t("Pause"):`${t("Reprendre")}${buf?` (+${buf})`:''}`}</button>
          </div>
        </div>
        {role!=='operator' && <div className="text-[12px] text-[#8F8F8F]">{t("Rôle viewer : cible par pseudonyme uniquement, identités masquées.")}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[['Traces actives','2 / 5'],['Expiration',`${Math.floor(ttl/60)}:${String(ttl%60).padStart(2,'0')}`],['Messages reçus',String(msgs.length+buf)],['En tampon (pause)',String(buf)]].map(([n,v])=>(
            <div key={n} className="bg-white rounded-xl border border-[#EBEBEB] px-4 py-3"><div className="text-[12px] text-[#8F8F8F]">{t(n)}</div><div className="text-[20px] font-semibold tabular-nums text-[#171717] mt-0.5">{v}</div></div>))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          <div className={card}>
            {head("Signalisation live",<span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-[#666666]"><span className={`w-[7px] h-[7px] rounded-full ${running?'bg-[#15803D] animate-pulse':'bg-[#D4D4D4]'}`}/>{running?t("en direct"):t("en pause")}</span>)}
            <div className="grid px-0" style={{gridTemplateColumns:`repeat(${LIVE_NODES.length},1fr)`}}>{LIVE_NODES.map(n=><div key={n} className="text-center text-[11.5px] font-semibold text-[#4D4D4D] py-2 border-b border-[#F2F2F2]">{n}</div>)}</div>
            <div ref={box} className="h-[380px] overflow-auto scroll-thin">
              <svg viewBox={`0 0 ${W} ${Math.max(1,msgs.length)*28+10}`} className="w-full">
                {LIVE_NODES.map(n=><line key={n} x1={cx(n)} x2={cx(n)} y1={0} y2={msgs.length*28+10} stroke="#EBEBEB"/>)}
                {msgs.map((m,i)=>{const y=i*28+20,a=cx(m.from),b=cx(m.to),c=IFC_C[m.ifc]||'#666';return <g key={m.seq+'-'+i}>
                  <line x1={a} x2={b} y1={y} y2={y} stroke={c} strokeWidth="1.4"/><path d={b>a?`M${b},${y} l-6,-3 v6z`:`M${b},${y} l6,-3 v6z`} fill={c}/>
                  <text x={(a+b)/2} y={y-5} fontSize="9.5" textAnchor="middle" fill="#171717">{m.name}</text>
                  <text x={4} y={y+3} fontSize="8.5" fill="#A3A3A3" fontFamily="monospace">{m.seq}</text>
                  <text x={W-4} y={y+3} fontSize="8.5" textAnchor="end" fill={c}>{m.ifc}</text></g>;})}
              </svg>
            </div>
            <div className="px-4 py-2.5 border-t border-[#F2F2F2] text-[11.5px] text-[#8F8F8F]">{t("Ordre (capture_id, seq) — chaque message est retrouvable à l'identique dans l'Analyzer.")}</div>
          </div>

          <div className="space-y-4">
            <div className={card}>
              {head("Chaîne d'identité")}
              <div className="p-4 space-y-3">
                {LIVE_CHAIN.map(([k,v,p,st],i)=>(<div key={k} className="flex gap-3">
                  <div className="flex flex-col items-center"><span className={`w-2.5 h-2.5 rounded-full mt-1 ${st==='EXACT'?'bg-[var(--app-accent)]':'border-2 border-[#A15C07]'}`}/>{i<LIVE_CHAIN.length-1&&<span className="flex-1 w-px bg-[#EBEBEB]"/>}</div>
                  <div className="min-w-0 pb-1"><div className="flex items-center gap-2"><span className="text-[12px] font-semibold text-[#171717]">{k}</span><span className={`text-[10px] font-medium rounded px-1 ${st==='EXACT'?'bg-[#ECFDF3] text-[#15803D]':'bg-[#FFF7E6] text-[#A15C07]'}`}>{st}</span></div>
                  <div className="font-mono text-[11.5px] text-[#4D4D4D] truncate">{role==='operator'||i>0?v:t('masqué')}</div><div className="text-[11px] text-[#8F8F8F]">{p}</div></div></div>))}
              </div>
            </div>
            <div className={card}>
              {head("Débit live",<span className="ml-auto text-[11px] text-[#8F8F8F]">PDU #1 · QFI 9 · DNN internet</span>)}
              <div className="p-4">
                <div className="flex gap-6 text-[12px]"><span><span className="text-[#8F8F8F]">DL </span><b className="tabular-nums">{dl.toFixed(1)} Mb/s</b></span><span><span className="text-[#8F8F8F]">UL </span><b className="tabular-nums">{ul.toFixed(1)} Mb/s</b></span><span className="text-[#8F8F8F]">cell 0A1F</span></div>
                <svg viewBox={`0 0 ${W} 125`} className="w-full h-[110px] mt-2"><path d={path(0,70)} fill="none" stroke="var(--app-accent)" strokeWidth="2"/><path d={path(1,70)} fill="none" stroke="#A3A3A3" strokeWidth="1.5"/></svg>
                <div className="mt-2 flex items-center justify-between text-[11.5px] rounded-md bg-[#FFF7E6] text-[#A15C00] px-2.5 py-1.5"><span>{t("Rapport d'usage PFCP")} {pfcp.toFixed(1)} Mb/s</span><span>{t("écart")} +3,0 % · {t("OUVERT")}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={card}>
            {head("RTP live",<span className="ml-auto text-[10.5px] font-medium text-[#8F8F8F] border border-[#EBEBEB] rounded px-1.5">LIVE-2</span>)}
            <div className="p-4 grid grid-cols-3 gap-3 text-[12px]">
              {[['Codec','AMR-WB 23.85'],['Bearer','5QI 1 · N3'],['Débit',`${(24+Math.random()).toFixed(1)} kb/s`],['Pertes','0,4 %'],['Gigue','7 ms'],['Déséquencement','0,1 %']].map(([n,v])=><div key={n}><div className="text-[#8F8F8F]">{t(n)}</div><div className="font-semibold tabular-nums text-[#171717]">{v}</div></div>)}
              <div className="col-span-3 flex items-center gap-2 pt-2 border-t border-[#F2F2F2]"><span className="text-[#8F8F8F]">MOS</span><b className="text-[16px]">4,1</b><span className="text-[10.5px] rounded bg-[#F5F5F5] px-1.5 text-[#666666]">{t("estimation G.107")}</span><span className="ml-auto text-[11px] text-[#8F8F8F]">{t("En-têtes seulement — aucune charge audio lue ni stockée.")}</span></div>
            </div>
          </div>
          <div className={card}>
            {head("Journal des traces")}
            <div className="divide-y divide-[#F2F2F2]">{LIVE_JOURNAL.map(([h,u,r,a,c])=>(<div key={h} className="px-4 py-2.5 flex items-center gap-3 text-[12px]"><span className="font-mono text-[#8F8F8F]">{h}</span><span className="font-semibold">{u}</span><span className={`text-[10.5px] rounded px-1 ${r==='operator'?'bg-[#A15C07] text-white':'bg-[#F2F2F2] text-[#666666]'}`}>{r}</span><span className="text-[#4D4D4D]">{t(a)}</span><span className="ml-auto font-mono text-[11px] text-[#8F8F8F]">{c}</span></div>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Traffic (flux, santé TCP, applications, congestion) — démo ---------------- */
const TR_CATS = [['Vidéo',41.2,'#0062A1'],['Web',22.8,'#0F5B56'],['Transfert',11.5,'#7C3AED'],['Messagerie',7.9,'#A15C07'],['Voix',4.1,'#15803D'],['Jeu',2.6,'#DB2777'],['DNS',0.4,'#666666'],['Non identifié',9.5,'#D4D4D4']];
const TR_APPS = [['YouTube',28.4,'SNI *.googlevideo.com · r3'],['Netflix',9.1,'SNI *.nflxvideo.net · r3'],['Meta',8.7,'SNI *.fbcdn.net · r3'],['Google',7.6,'SNI *.google.com · r2'],['WhatsApp',5.2,'SNI *.whatsapp.net · r3'],['Steam',2.4,'port 27015-27050 · r1']];
const TR_CELLS = ['0A1F','0B07','0C12','0D3E','0E44','0F01'];
const TR_V = {RADIO:['Radio','#B42318'],CORE:['Cœur/Internet','#A15C07'],QOS:['Limite QoS','#7C3AED'],RCV:['Limite récepteur','#0062A1'],APP:['Limite application','#0F5B56'],IND:['INDÉTERMINÉ','#8F8F8F'],OK:['OK','#15803D']};
const TR_FLOWS = [
  ['ue-7f3a','TCP','10.45.0.12:51544','142.250.75.14:443','YouTube','Vidéo','r3 SNI','PDU#1 · 5QI 9','0A1F',38.2,24,0.2,'OK','RTT 24 ms, retrans 0,2 %, débit < AMBR'],
  ['ue-21c0','QUIC','10.45.0.31:60112','157.240.21.35:443','Meta','Vidéo','r3 SNI','PDU#1 · 5QI 9','0B07',12.1,96,3.8,'RADIO','RTT UE 81 ms ≫ RTT réseau 15 ms, pertes 3,8 %'],
  ['ue-9b44','TCP','10.45.0.18:44210','151.101.1.69:443','—','Web','r1 port','PDU#1 · 5QI 9','0C12',4.9,41,0.6,'QOS','débit 5,0 Mb/s = AMBR session'],
  ['ue-7f3a','UDP','10.45.0.12:40000','10.46.0.2:5004','—','Voix','r2 port RTP','PDU#2 · 5QI 1','0A1F',0.05,18,0.1,'OK','5QI 1, gigue 7 ms'],
  ['ue-c812','TCP','10.45.0.44:52001','34.120.4.11:443','Google','Transfert','r2 SNI','PDU#1 · 5QI 8','0D3E',2.2,178,5.1,'CORE','RTT réseau 160 ms ≫ RTT UE 18 ms'],
  ['ue-5e10','TCP','10.45.0.52:49330','52.84.3.20:443','—','Transfert','r1 port','PDU#1 · 5QI 9','0E44',0.3,22,0.0,'RCV','fenêtre nulle ×14 côté UE'],
  ['ue-0d7a','TCP','10.45.0.60:50112','203.0.113.9:8443','—','Non identifié','aucune','PDU#1 · 5QI 9','0F01',1.4,55,1.2,'IND','mesures insuffisantes (capture partielle)'],
];
function Traffic({setPage}){
  const [sel,setSel]=useState(0); const [by,setBy]=useState('cat');
  const f=TR_FLOWS[sel]; const card="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden";
  const head=(n,x)=><div className="h-11 px-4 flex items-center gap-2 border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{t(n)}</h3>{x}</div>;
  const r=seedRand('flow'+sel); const W=600; const pts=k=>Array.from({length:40},()=>r()*k);
  const line=(d,mx)=>d.map((v,i)=>`${i?'L':'M'}${(i*W/39).toFixed(1)},${(70-v/mx*62).toFixed(1)}`).join(' ');
  const bars = by==='cat'?TR_CATS.map(([n,v,c])=>[n,v,c]):by==='app'?TR_APPS.map(([n,v])=>[n,v,'var(--app-accent)']):by==='cell'?TR_CELLS.map((c,i)=>['Cellule '+c,[31,24,18,12,9,6][i],'var(--app-accent)']):by==='dnn'?[['internet',84.1,'var(--app-accent)'],['ims',4.3,'var(--app-accent)'],['iot',2.1,'var(--app-accent)']]:[['5QI 9',82.4,'var(--app-accent)'],['5QI 8',9.9,'var(--app-accent)'],['5QI 1',4.1,'var(--app-accent)'],['5QI 5',0.6,'var(--app-accent)']];
  const mx=Math.max(...bars.map(b=>b[1]));
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-[#FAFAFA]">
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
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
const KPI_CATS = [
  ['Santé sonde', [
    ['kpi.probe.dumpcap','Dumpcap actifs','1.0.0','%','dumpcap actifs','dumpcap attendus','heartbeat sonde (60 s)','nœud','1 valeur / nœud / minute','actifs ≤ attendus',"SELECT minute, node, count(*) FILTER (WHERE dumpcap_up) / count(*) FROM probe_heartbeat GROUP BY 1, 2"],
    ['kpi.probe.segments','Segments ignorés','1.0.0','segments','segments ignorés','segments reçus','journal d\u2019import','nœud, interface','compteur monotone','ignorés ≤ reçus',"SELECT minute, node, sum(segments_dropped), sum(segments_received) FROM import_journal GROUP BY 1, 2"],
    ['kpi.probe.lag','Retard d\u2019import','1.0.0','s','now() − dernier segment importé','—','horodatage d\u2019import','nœud','max par minute','retard ≥ 0',"SELECT minute, node, max(extract(epoch from now() - last_segment_at)) FROM import_state GROUP BY 1, 2"],
    ['kpi.probe.disk','Disque disponible','1.0.0','%','espace libre','espace total','sonde disque','nœud, volume','dernière mesure / minute','libre ≤ total',"SELECT minute, node, volume, avg(free_bytes) / avg(total_bytes) FROM disk_probe GROUP BY 1, 2, 3"],
  ]],
  ['Procédures 5G', [
    ['kpi.5g.registration','Succès Registration','1.0.0','%','Registration Accept','Registration Request','N1/N2 (NAS 5GMM)','RAT, cellule, TAC, DNN, S-NSSAI, run','1ère tentative / UE / procédure','succès + échec = total',"SELECT minute, count(*) FILTER (WHERE msg='RegistrationAccept') / count(*) FILTER (WHERE msg='RegistrationRequest') FROM msg WHERE ifc IN ('N1','N2') GROUP BY 1"],
    ['kpi.5g.pdu','Succès PDU Session','1.0.0','%','PDU Session Establishment Accept','PDU Session Establishment Request','N1/N2 (NAS 5GSM)','RAT, DNN, S-NSSAI, run','1ère tentative / PDU session','succès + échec = total',"SELECT minute, count(*) FILTER (WHERE msg='PDUSessionEstablishmentAccept') / count(*) FILTER (WHERE msg='PDUSessionEstablishmentRequest') FROM msg GROUP BY 1"],
    ['kpi.5g.servicereq','Succès Service Request','1.0.0','%','Service Accept','Service Request','N1/N2 (NAS 5GMM)','RAT, cellule, run','1ère tentative / UE','succès + échec = total',"SELECT minute, count(*) FILTER (WHERE msg='ServiceAccept') / count(*) FILTER (WHERE msg='ServiceRequest') FROM msg GROUP BY 1"],
  ]],
  ['Procédures 4G', [
    ['kpi.4g.attach','Succès Attach','1.0.0','%','Attach Accept','Attach Request','S1-MME (NAS EMM)','cellule, TAC, run','1ère tentative / UE','succès + échec = total',"SELECT minute, count(*) FILTER (WHERE msg='AttachAccept') / count(*) FILTER (WHERE msg='AttachRequest') FROM msg WHERE ifc='S1-MME' GROUP BY 1"],
    ['kpi.4g.erab','Succès E-RAB Setup','1.0.0','%','E-RAB Setup Response','E-RAB Setup Request','S1-MME (S1AP)','cellule, run','par E-RAB id','succès + échec = total',"SELECT minute, count(*) FILTER (WHERE msg='ERABSetupResponse') / count(*) FILTER (WHERE msg='ERABSetupRequest') FROM msg WHERE ifc='S1-MME' GROUP BY 1"],
  ]],
  ['Session N4', [
    ['kpi.n4.session','Succès établissement N4','1.0.0','%','PFCP Session Establishment Response (cause=Accepted)','PFCP Session Establishment Request','N4 (PFCP)','NF, run','par SEID','réponses ≤ requêtes',"SELECT minute, count(*) FILTER (WHERE msg='PFCPSessionEstablishmentResponse' AND cause='Accepted') / count(*) FILTER (WHERE msg='PFCPSessionEstablishmentRequest') FROM msg WHERE ifc='N4' GROUP BY 1"],
  ]],
  ['Erreurs', [
    ['kpi.err.s6a','Erreurs S6a','1.0.0','err/min','réponses S6a avec code erreur Diameter','—','S6a (Diameter)','code, run','par (capture_id, seq)','compteur ≥ 0',"SELECT minute, result_code, count(*) FROM msg WHERE ifc='S6a' AND result_code >= 3000 GROUP BY 1, 2"],
    ['kpi.err.sbi','Erreurs SBI par NF','1.0.0','err/min','réponses SBI HTTP ≥ 400','—','SBI (HTTP/2)','NF, code, run','par (capture_id, seq)','compteur ≥ 0',"SELECT minute, nf, status, count(*) FROM msg WHERE ifc='SBI' AND status >= 400 GROUP BY 1, 2, 3"],
  ]],
  ['Latence', [
    ['kpi.lat.proc','Latence par procédure','1.0.0','ms','seq(réponse) − seq(requête), même capture','—','toutes interfaces','procédure, run','paire req/resp unique','intra-capture uniquement, jamais ts',"SELECT minute, proc, percentile_cont(0.5) WITHIN GROUP (ORDER BY resp_seq - req_seq) FROM pairs WHERE same_capture GROUP BY 1, 2"],
  ]],
  ['TCP / Traffic', [
    ['kpi.tcp.setup','Taux d\u2019établissement TCP','1.0.0','%','SYN-ACK + ACK reçus','SYN émis','N3 / S1-U (IP interne GTP-U)','cellule, DNN, 5QI, run','par 5-uplet','établis + RST + sans réponse = SYN',"SELECT minute, count(*) FILTER (WHERE established) / count(*) FROM tcp_flow GROUP BY 1"],
    ['kpi.tcp.rtt','RTT TCP','1.0.0','ms','médiane SYN → SYN-ACK','—','N3 / S1-U','cellule, côté (réseau/UE)','par 5-uplet','intra-capture, même interface',"SELECT minute, cell, percentile_cont(0.5) WITHIN GROUP (ORDER BY rtt_net_ms) FROM tcp_flow GROUP BY 1, 2"],
    ['kpi.tcp.retrans','Retransmissions TCP','1.0.0','%','segments retransmis','segments total','N3 / S1-U','cellule, application','par 5-uplet','retransmis ≤ total',"SELECT minute, sum(retrans) / sum(segments) FROM tcp_flow GROUP BY 1"],
    ['kpi.tcp.congested','Flux congestionnés','1.0.0','%','flux avec verdict ≠ OK/INDÉTERMINÉ','flux total','moteur de verdicts','cellule, verdict','par 5-uplet','somme verdicts = total',"SELECT minute, cell, count(*) FILTER (WHERE verdict NOT IN ('OK','IND')) / count(*) FROM flow_verdict GROUP BY 1, 2"],
  ]],
  ['Corrélation', [
    ['kpi.corr.exact','Taux de liens EXACT','1.0.0','%','liens EXACT','liens total (EXACT + À PROUVER + ABSENT)','moteur de corrélation','interface, run','par paire de messages','EXACT + À PROUVER + ABSENT = total',"SELECT minute, count(*) FILTER (WHERE link='EXACT') / count(*) FROM correlation GROUP BY 1"],
  ]],
];
const ALL_KPIS = KPI_CATS.flatMap(([c,ks]) => ks.map(k => ({cat:c, id:k[0], name:k[1], ver:k[2], unit:k[3], num:k[4], den:k[5], src:k[6], dims:k[7], dedup:k[8], inv:k[9], q:k[10]})));
const ANOM_N1 = [
  ['Invariant de comptage','succès + échec = total, par procédure et par minute'],
  ['Cause obligatoire','toute procédure en échec porte une cause (NAS, Diameter, HTTP…)'],
  ['Ordre canonique','seq strictement croissant dans une capture (capture_id, seq)'],
];
const ANOM_N2 = [
  ['Cause jamais vue','une cause d\u2019échec absente du référentiel historique'],
  ['Séquence hors flux 3GPP','enchaînement de messages incompatible avec la procédure'],
];


/* ---- Données de démo (mock) ---- */
const seedRand = (str) => { let h=2166136261; for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return () => { h^=h<<13; h^=h>>>17; h^=h<<5; return ((h>>>0)%10000)/10000; }; };
const MOCK_BASE = {'%':[97,2.5],'segments':[12,10],'s':[4,3],'err/min':[6,5],'ms':[38,15]};
const GRAN_N = {'1 min':60,'15 min':48,'1 h':24,'1 j':14};
function mockSeries(k, gran){
  const r=seedRand(k.id+gran); const [b,v]=MOCK_BASE[k.unit]||[50,10]; const n=GRAN_N[gran]||48;
  return Array.from({length:n},(_,i)=>{ let x=b+(r()-0.5)*2*v+Math.sin(i/4)*v*0.4; if(r()>0.94) x+= (k.unit==='%'?-v*3:v*2.5); if(k.unit==='%') x=Math.min(100,x); return Math.max(0,+x.toFixed(1)); });
}
const fmtV = (v,u) => u==='%'?v.toFixed(1)+' %':u==='ms'?Math.round(v)+' ms':u==='s'?v.toFixed(1)+' s':String(Math.round(v));
const mockNow = (k) => { const s=mockSeries(k,'15 min'); return s[s.length-1]; };
const MOCK_CAUSES = ['5GMM #7','5GMM #11','5GSM #27','5GSM #33','EMM #15','DIA 5001','HTTP 404','HTTP 503'];
const MOCK_TOP = [['Cellule 208-01-0A1F',0],['Cellule 208-01-0B07',0],['DNN internet',0],['DNN ims',0],['S-NSSAI 1-000001',0],['Run 5G #482',0],['Run 4G #219',0]];
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

function Kpis({setPage}) {
  const [kid,setKid] = useState('kpi.probe.dumpcap');
  const [q,setQ] = useState('');
  const [dv,setDv] = useState('series');
  const [gran,setGran] = useState('15 min');
  const k = ALL_KPIS.find(x=>x.id===kid) || ALL_KPIS[0];
  const ql = q.trim().toLowerCase();
  const series = mockSeries(k, gran);
  const match = x => !ql || (x.name+' '+x.id+' '+x.src+' '+x.dims).toLowerCase().includes(ql);
  return (
    <div className="flex-1 overflow-auto scroll-thin bg-[#FAFAFA]">
      <div className="max-w-[1480px] mx-auto px-8 py-7 space-y-5">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[12px] text-[#666666]">POLARIS KPI</div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#171717] mt-1">{t("KPI & Anomalies")}</h1>
            <div className="text-[13px] text-[#666666] mt-1">{t("Indicateurs par procédure et détection d'écarts.")}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] font-medium text-[#A15C00] bg-[#FFF7E6] border border-[#FCE2B0] rounded px-1.5 py-[1px]">{t("Données de démo")}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-[#666666]"><span className="w-[7px] h-[7px] rounded-full bg-[#15803D]"/>{t("Fraîcheur : 4 s")}</span>
            <div className="flex rounded-lg border border-[#EBEBEB] bg-white overflow-hidden">
              {['1 min','15 min','1 h','1 j'].map(g=>(
                <button key={g} onClick={()=>setGran(g)} className={`h-8 px-3 text-[12.5px] ${gran===g?'bg-[var(--app-accent)] text-white font-medium':'text-[#4D4D4D] hover:bg-[#FAFAFA]'}`}>{g}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] gap-4 items-start">
          {/* Catalogue */}
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            <div className="p-3 border-b border-[#F2F2F2]">
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-[#EBEBEB] focus-within:border-[var(--app-accent)]">
                <I d={ic.search} c="w-3.5 h-3.5 text-[#8F8F8F]"/>
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder={t("Rechercher un KPI…")} className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] placeholder:text-[#A3A3A3]"/>
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto scroll-thin py-1">
              {KPI_CATS.map(([c,ks])=>{
                const list = ks.filter(x=>match({name:x[1],id:x[0],src:x[6],dims:x[7]}));
                if(!list.length) return null;
                return <div key={c}>
                  <div className="px-3 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8F8F8F]">{t(c)}</div>
                  {list.map(x=>(
                    <button key={x[0]} onClick={()=>setKid(x[0])} className={`w-full text-left px-3 py-2 flex items-center gap-2 ${kid===x[0]?'bg-[#FAFAFA] border-l-2 border-l-[var(--app-accent)]':'border-l-2 border-l-transparent hover:bg-[#FAFAFA]'}`}>
                      <span className="min-w-0"><span className={`block truncate text-[12.5px] ${kid===x[0]?'font-semibold text-[#171717]':'text-[#4D4D4D]'}`}>{t(x[1])}</span><span className="block truncate font-mono text-[10.5px] text-[#A3A3A3]">{x[0]} · v{x[2]}</span></span>
                      <span className="ml-auto shrink-0 text-[12px] tabular-nums text-[#4D4D4D]">{fmtV(mockNow({id:x[0],unit:x[3]}),x[3])}</span>
                    </button>
                  ))}
                </div>;
              })}
            </div>
          </div>

          {/* Dataviews */}
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            <div className="h-11 px-4 flex items-center gap-1 border-b border-[#F2F2F2]">
              {[['series','Séries'],['heat','Heatmap causes × temps'],['top','Top-N']].map(([k2,n])=>(
                <button key={k2} onClick={()=>setDv(k2)} className={`h-7 px-3 rounded-md text-[12.5px] ${dv===k2?'bg-[#F2F2F2] font-semibold text-[#171717]':'text-[#666666] hover:text-[#171717]'}`}>{t(n)}</button>
              ))}
              <span className="ml-auto text-[11.5px] text-[#A3A3A3]">{t("Granularité")} {gran}</span>
            </div>
            <div className="h-[340px] p-4">
              {dv==='series' && <div className="h-full flex flex-col"><div className="flex items-baseline gap-3 mb-1"><span className="text-[22px] font-semibold tabular-nums text-[#171717]">{fmtV(series[series.length-1],k.unit)}</span><span className="text-[12px] text-[#8F8F8F]">{t("moyenne")} {fmtV(series.reduce((a,b)=>a+b,0)/series.length,k.unit)}</span></div><div className="flex-1 min-h-0"><MockChart data={series} unit={k.unit}/></div></div>}
              {dv==='heat' && <div className="h-full overflow-auto scroll-thin"><table className="text-[11px] w-full"><tbody>{MOCK_CAUSES.map(c=>{const r=seedRand(k.id+c+gran);return <tr key={c}><td className="pr-2 py-[3px] font-mono text-[#B42318] whitespace-nowrap">{c}</td>{Array.from({length:24},(_,i)=>{const v=Math.pow(r(),3);return <td key={i} className="p-[1px]"><div title={Math.round(v*40)+' '+t('échecs')} className="h-6 rounded-[3px] bg-[var(--app-accent)]" style={{opacity:0.06+v*0.94}}/></td>;})}</tr>;})}</tbody></table><div className="mt-2 flex justify-between text-[10.5px] text-[#A3A3A3]"><span>−24 × {gran}</span><span>{t("maintenant")}</span></div></div>}
              {dv==='top' && <div className="space-y-2.5">{MOCK_TOP.map(([n],i)=>{const r=seedRand(k.id+n);const v=Math.round(20+r()*400)/(i+1);return [n,v];}).sort((a,b)=>b[1]-a[1]).map(([n,v],i,arr)=>(<div key={n} className="flex items-center gap-3 text-[12.5px]"><span className="w-5 text-[#A3A3A3] tabular-nums">{i+1}</span><span className="w-44 truncate text-[#4D4D4D]">{n}</span><div className="flex-1 h-2 rounded-full bg-[#F2F2F2]"><div className="h-2 rounded-full bg-[var(--app-accent)]" style={{width:(v/arr[0][1]*100)+'%'}}/></div><span className="w-12 text-right tabular-nums text-[#171717]">{Math.round(v)}</span></div>))}</div>}
            </div>
            <div className="border-t border-[#F2F2F2] px-4 py-3">
              <Lbl>{t("Requête générée")}</Lbl>
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#4D4D4D] bg-[#FAFAFA] border border-[#F2F2F2] rounded-md p-3 overflow-x-auto scroll-thin whitespace-pre-wrap">{k.q}</pre>
            </div>
          </div>

          {/* Fiche KPI */}
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            <div className="h-11 px-4 flex items-center border-b border-[#F2F2F2]"><h3 className="text-[13px] font-semibold text-[#171717]">{t("Fiche KPI")}</h3><span className="ml-auto font-mono text-[11px] text-[#8F8F8F]">v{k.ver}</span></div>
            <div className="p-4 space-y-4 text-[12.5px]">
              <div><div className="text-[14px] font-semibold text-[#171717]">{t(k.name)}</div><div className="font-mono text-[11px] text-[#8F8F8F] mt-0.5">{k.id}</div></div>
              {[['Formule',`${k.num} / ${k.den}`],['Événements sources',k.src],['Dimensions',k.dims],['Unité',k.unit],['Règle de dédup',k.dedup],['Invariant',k.inv]].map(([n,v])=>(
                <div key={n}><Lbl>{t(n)}</Lbl><div className="text-[#4D4D4D] leading-snug">{v}</div></div>
              ))}
              <button onClick={()=>setPage('sessions')} className="w-full h-9 rounded-md bg-[var(--app-accent)] hover:opacity-90 text-white text-[12.5px] font-medium">{t("Explorer dans l'Analyzer →")}</button>
            </div>
          </div>
        </div>

        {/* Anomalies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[['N1',t("Règles et invariants"),ANOM_N1],['N2',t("Nouveauté"),ANOM_N2]].map(([lv,sub,rules])=>(
            <div key={lv} className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
              <div className="h-11 px-4 flex items-center gap-2 border-b border-[#F2F2F2]">
                <h3 className="text-[13px] font-semibold text-[#171717]">{t("Anomalies")} {lv}</h3>
                <span className="text-[11.5px] text-[#8F8F8F]">{sub}</span>
                <span className="ml-auto flex items-center gap-3 text-[11.5px]"><span className="flex items-center gap-1.5 text-[#8F8F8F]"><span className="w-[7px] h-[7px] rounded-full bg-[#D4D4D4]"/>{t("OUVERT")} {lv==='N1'?2:1}</span><span className="flex items-center gap-1.5 text-[#8F8F8F]"><span className="w-[7px] h-[7px] rounded-full bg-[#15803D]"/>{t("FERMÉ")} {lv==='N1'?5:3}</span></span>
              </div>
              <div className="divide-y divide-[#F2F2F2]">
                {rules.map(([n,d],ri)=>(
                  <div key={n} className="px-4 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 w-[7px] h-[7px] rounded-full shrink-0 ${ri%2===0?'bg-[#B42318]':'bg-[#15803D]'}`}/>
                    <div className="min-w-0"><div className="text-[12.5px] font-medium text-[#171717]">{t(n)}</div><div className="text-[12px] text-[#666666]">{t(d)}</div></div>
                    <span className={`ml-auto shrink-0 text-[11px] font-medium ${ri%2===0?'text-[#B42318]':'text-[#15803D]'}`}>{ri%2===0?`${t("OUVERT")} · ${t("il y a")} ${6+ri*7} min`:`${t("FERMÉ")} · ${t("preuve")} #${310+ri}`}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-[#F2F2F2] text-[12px] text-[#8F8F8F]">{t("Une anomalie se ferme avec une preuve, ou reste OUVERTE.")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [role,setRole] = useState('viewer');
  const [lang,setLangS] = useState(()=>{ try { return localStorage.getItem('polaris-lang')||'fr'; } catch(e) { return 'fr'; } });
  const setLang = l => { try { localStorage.setItem('polaris-lang',l); } catch(e) {} setLangS(l); };
  LANG = lang;
  const [theme,setThemeS] = useState(()=>{ try { return localStorage.getItem('polaris-theme')||'blue'; } catch(e) { return 'blue'; } });
  const setTheme = t => { try { localStorage.setItem('polaris-theme',t); } catch(e) {} setThemeS(t); };
  const accent = THEMES.find(t=>t[0]===theme)?.[2] || '#0062A1';
    const readP = () => { const h=(location.hash||'').replace('#',''); return ['sessions','nodes','settings','templates','kpi','live','trafic'].includes(h) ? h : 'home'; };
  const [page,setPageS] = useState(readP);
  const setPage = p => { try { location.hash = p; } catch(e) {} setPageS(p); };
  useEffect(()=>{ const f=()=>setPageS(readP()); window.addEventListener('hashchange',f); return ()=>window.removeEventListener('hashchange',f); },[]);
  const [tabs,setTabs] = useState(()=>[
    {id:'t1',k:'Requête',n:'Échecs · run 482',conds:[['Résultat','Échec']]},
    {id:'t2',k:'Session',n:'UE-9b14 · PDU Session',conds:[['UE','UE-9b14']]},
    {id:'t3',k:'Comparaison',n:'UE-9b14 ↔ UE-7f3a',ue:['UE-9b14','UE-7f3a'],conds:[]},
    {id:'t4',k:'Trace',n:'UE-7f3a',ue:['UE-7f3a'],conds:[],live:true},
  ]);
  const [tabId,setTabId] = useState('t1');
  const [saved,setSaved] = useState(SAVED);
  const [aview,setAview] = useState('queries');
  const active = tabs.find(x=>x.id===tabId);
  const view = aview==='queries' || !active ? 'library' : (active.mode==='edit' ? 'edit' : 'results');
  const conds = active ? active.conds : [];
  const setConds = c => active && setTabs(ts=>ts.map(x=>x.id===active.id?{...x,conds:c.map(y=>y.length>2?y:[y[0],y[1],'='])}:x));
  const rows = useMemo(()=>{
    if (!active) return [];
    const ue = active.ue;
    return SESS.filter(s=>(!ue || (Array.isArray(ue)?ue.includes(s.ue):s.ue===ue)) && matchQ(s,active.conds,active.join));
  },[active]);
  const [sel,setSel] = useState(3);
  const s = rows.find(r=>r.id===sel) || rows[0] || SESS[0];
  const nameOf = c => `${c.length?c.map(x=>x[1]).join(' · '):'Toutes les sessions'} · run 482`;
  const patch = (id,o) => setTabs(ts=>ts.map(x=>x.id===id?{...x,...o}:x));
  const newTab = (draft=mkDraft(),title) => { const id='q'+Date.now(); setTabs(ts=>[...ts,{id,k:'Requête',n:title||'Nouvelle requête',conds:[],mode:'edit',draft,dirty:!!title}]); setTabId(id); setAview('tab'); };
  const openSaved = q => { const id='q'+Date.now(); const c=q.c.map(y=>[y[0],y[1],y[2]||'=']); setTabs(ts=>[...ts,{id,k:'Requête',n:q.n,conds:c,join:'ET',mode:'results',draft:mkDraft({tpl:q.g,scope:q.p,conds:c,name:q.n})}]); setTabId(id); setAview('tab'); };
  const editActive = () => { if (!active) return; patch(active.id,{mode:'edit',draft:active.draft||mkDraft({conds:active.conds,name:active.n,join:active.join||'ET'})}); };
  const setDraft = d => patch(active.id,{draft:d,dirty:true,n:d.name||'Nouvelle requête'});
  const runQuery = () => { const d=active.draft; patch(active.id,{conds:d.conds,join:d.join,n:d.name||nameOf(d.conds),mode:'results',ran:true}); };
  const saveQuery = () => { const d=active.draft; const n=d.name||nameOf(d.conds);
    setSaved(sv=>[{n,g:d.tpl,p:d.scope,c:d.conds,last:"à l'instant",r:SESS.filter(x=>matchQ(x,d.conds,d.join)).length,fav:false},...sv.filter(x=>x.n!==n)]);
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
  const [msg,setMsg] = useState(4);
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
  useEffect(()=>{ setMsg(s.d===KO5?4:Math.min(14,s.d.msgs.length-1)); setLens(null); },[s.id]);
  return (
    <div style={{"--app-accent":accent}} className="h-screen flex flex-col bg-[#FAFAFA] text-[#171717] text-[13px]">
      <TopBar role={role} setRole={setRole} page={page} setPage={setPage} onAnalyzer={()=>setAview('queries')} accent={accent} onSettings={()=>setPage('settings')}/>
      {role==='operator' && <div className="h-7 shrink-0 bg-[#FDF6E7] border-b border-[#F1D9A8] text-[#7A4505] text-[12px] flex items-center px-4">Rôle operator actif · les identités sont visibles · chaque consultation est journalisée</div>}
      {page==='settings' ? <Settings theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} onClose={()=>setPage('home')}/> : page==='home' ? <Home setPage={setPage} onNew={()=>{ setPage('sessions'); newTab(); }}/> : page==='kpi' ? <KpiModule t={t} role={role} setPage={setPage} KPIS={ALL_KPIS} mockSeries={mockSeries} MockChart={MockChart} fmtV={fmtV}/> : page==='live' ? <LiveModule t={t} role={role} setPage={setPage}/> : page==='trafic' ? <Traffic setPage={setPage}/> : page==='nodes' ? <Nodes/> : page==='templates' ? <QueryLibrary saved={saved} onNew={(d,tt)=>{setPage('sessions'); newTab(d,tt);}} onOpen={q=>{setPage('sessions'); openSaved(q);}}/> : <>
      {!full && <Tabs tabs={tabs} active={tabId} active={view==='library'?null:tabId} home={view==='library'} onPick={pickTab} onClose={closeTab} onHome={()=>setAview('queries')} onNew={()=>newTab()}/>}
      {view==='library' ? <QueryLibrary saved={saved} onNew={newTab} onOpen={openSaved}/> : view==='edit' ? <QueryEditor key={active.id} draft={active.draft} setDraft={setDraft} dirty={active.dirty} run={runQuery} save={saveQuery} cancel={cancelEdit} role={role}/> : <div className="flex-1 flex min-h-0 p-3 bg-[#FAFAFA]">
        <main ref={mainRef} className="flex-1 min-w-0 flex flex-col">
          {!full && !gridHidden && <>
            <Grid rows={rows} sel={s.id} setSel={setSel} role={role} conds={conds} setConds={setConds} onEdit={editActive} height={`${gridPct}%`}/>
            <div onMouseDown={e=>drag(e,'h')} onDoubleClick={()=>setGridPct(42)} title="Glisser pour redimensionner · double-clic pour réinitialiser" className="group h-3 shrink-0 cursor-row-resize relative"><div className="absolute left-1/2 -translate-x-1/2 top-[5px] h-[2px] w-10 rounded-full bg-[#E0E0E0] group-hover:bg-[var(--app-accent)] group-hover:w-full transition-all"/></div>
          </>}
          <Detail s={s} sel={msg} setSel={setMsg} lens={lens} ui={ui}/>
        </main>
        {!full && (insHidden
          ? <button onClick={()=>setInsHidden(false)} title="Afficher le panneau" className="ml-3 w-9 shrink-0 bg-white rounded-xl border border-[#EBEBEB] flex flex-col items-center pt-3 gap-3 text-[#666666] hover:text-[#171717]"><I d="M9 4v16M4 4h16v16H4z" c="w-4 h-4"/><span className="[writing-mode:vertical-rl] text-[12px]">Décodage</span></button>
          : <><div onMouseDown={e=>drag(e,'v')} onDoubleClick={()=>setInsW(360)} title="Glisser pour redimensionner" className="group w-3 shrink-0 cursor-col-resize relative"><div className="absolute top-1/2 -translate-y-1/2 left-[5px] w-[2px] h-10 rounded-full bg-[#E0E0E0] group-hover:bg-[var(--app-accent)] group-hover:h-full transition-all"/></div>
            <Inspector s={s} sel={msg} role={role} lens={lens} setLens={setLens} width={insW} onHide={()=>setInsHidden(true)}/></>)}
      </div>}</>}
      <footer className="h-7 shrink-0 bg-white border-t border-[#EBEBEB] flex items-center gap-5 px-4 text-[11.5px] text-[#666666]">
        <span className="flex items-center gap-1.5"><span className="w-[6px] h-[6px] rounded-full bg-[#15803D]"/>12/12 dumpcap</span><span>Import à jour</span><span>Segments ignorés : 0</span>
        <span>{rows.length} sessions · requête 0,8 s</span><span className="ml-auto font-mono">OIRAN 2.10.2 · Analyzer 0.8.1 · données fictives</span>
      </footer>
    </div>
  );
}
export default App;
