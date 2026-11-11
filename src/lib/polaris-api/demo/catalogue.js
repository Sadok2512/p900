const N5 = ['gNB','AMF','AUSF/UDM','SMF','UPF'];
const N4n = ['eNB','MME','HSS','SGW-C','PGW-C','SGW-U'];


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
  links:[[12,14,'N4','N2','UL TEID 0x0000a1f2','EXACT'],[12,19,'N4','N3','UL TEID 0x0000a1f2','EXACT'],[17,20,'N4','N3','DL TEID 0x00000b07','EXACT'],[13,14,'SBI','N2','n2SmInfo UL TEID','OUVERT'],[10,11,'SBI','N4','smContextRef ↔ SEID','OUVERT']],
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
  links:[[1,null,'SBI','N4','smContextRef → SEID','OUVERT']],
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
  {id:1,cap:41,seq:18204,ue:'UE-7f3a',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'412 ms',d:OK5},
  {id:2,cap:41,seq:18877,ue:'UE-2c90',rat:'LTE',proc:'Attach + bearer par défaut',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'5/5',comp:100,dur:'538 ms',d:LTE},
  {id:3,cap:41,seq:20511,ue:'UE-9b14',rat:'5G SA',proc:'PDU Session',res:'Échec',cause:'5GSM #27 Missing or unknown DNN',cell:'gNB-1 / 0x001',ex:'0/1',comp:100,dur:'96 ms',d:KO5},
  {id:4,cap:42,seq:311,ue:'UE-7f3a',rat:'5G SA',proc:'Service Request',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/3',comp:92,dur:'58 ms',d:OK5},
  {id:5,cap:42,seq:1290,ue:'UE-51de',rat:'LTE',proc:'Attach',res:'Échec',cause:'S6a 5001 USER_UNKNOWN',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'38 ms',d:LTE},
  {id:6,cap:42,seq:2044,ue:'UE-2c90',rat:'LTE',proc:'Tracking Area Update',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'44 ms',d:LTE},
  {id:7,cap:42,seq:3315,ue:'UE-c6e2',rat:'5G SA',proc:'Registration',res:'Échec',cause:'5GMM #7 5GS services not allowed',cell:'gNB-1 / 0x001',ex:'0/1',comp:88,dur:'71 ms',d:KO5},
  {id:8,cap:42,seq:4102,ue:'UE-0ae7',rat:'LTE',proc:'Dedicated Bearer Activation',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'4/4',comp:100,dur:'120 ms',d:LTE},
  {id:9,cap:43,seq:77,ue:'UE-9b14',rat:'5G SA',proc:'Deregistration',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'2/2',comp:100,dur:'64 ms',d:OK5},
  {id:10,cap:43,seq:812,ue:'UE-51de',rat:'LTE',proc:'Detach',res:'Succès',cause:'',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'31 ms',d:LTE},
  {id:11,cap:43,seq:1555,ue:'UE-44f0',rat:'5G SA',proc:'Registration + PDU Session',res:'Succès',cause:'',cell:'gNB-1 / 0x001',ex:'3/5',comp:96,dur:'398 ms',d:OK5},
  {id:12,cap:43,seq:2210,ue:'UE-0ae7',rat:'LTE',proc:'E-RAB Release',res:'Succès',cause:'S1AP radio #20 user-inactivity',cell:'eNB-1 / 0x007',ex:'1/1',comp:100,dur:'22 ms',d:LTE},
];

const NODES = [
  {n:'polaris-capture-01',role:'Capture',st:'ok',ver:'—',exp:'',cpu:31,mem:[2.1,4],disk:76,seen:'il y a 2 s',info:'12/12 dumpcap · PID stables'},
  {n:'polaris-import-01',role:'Import et décodage',st:'ok',ver:'—',exp:'',cpu:58,mem:[2.9,4],disk:76,seen:'il y a 2 s',info:'retard 4 s · 0 segment ignoré'},
  {n:'polaris-dataset',role:'Base / dataset',st:'warn',ver:'schéma 7',exp:'7',cpu:22,mem:[1.4,4],disk:76,seen:'il y a 5 s',info:'~1,5 M événements · disque en hausse'},
  {n:'analyzer-api',role:'API Analyzer',st:'ok',ver:'—',exp:'',cpu:9,mem:[0.4,1],disk:41,seen:'il y a 1 s',info:'p95 requête 0,8 s'},
  {n:'polaris-control',role:'Orchestrateur',st:'ok',ver:'—',exp:'',cpu:12,mem:[0.6,2],disk:41,seen:'il y a 3 s',info:'run 5G #482 terminé'},
  {n:'open5gs-core',role:'Cœur 5G / EPC (observé)',st:'ok',ver:'Open5GS 2.8.0',exp:'2.8.0',cpu:null,mem:null,disk:null,seen:'trafic vu il y a 1 s',info:'AMF, SMF, UPF, MME actifs'},
];

const SAVED = [
  {n:'Échecs · run 482',g:'Parcourir',p:'Run 5G #482',c:[['Résultat','Échec']],last:'il y a 12 min',r:3,fav:true},
  {n:'PDU Session 5G · toutes causes',g:'Parcourir',p:'Captures c41 → c43',c:[['Procédure','PDU Session'],['RAT','5G SA']],last:'il y a 1 h',r:1,fav:true},
  {n:'Attach LTE · certification',g:'Parcourir',p:'lte-run-976bd44b',c:[['Procédure','Attach'],['RAT','LTE']],last:'hier',r:2},
  {n:'Sessions passant par N4',g:'Inspecter',p:'Run 5G #482',c:[['Interface','N4']],last:'hier',r:4,shared:true},
  {n:'Erreurs S6a',g:'Parcourir',p:'Captures c41 → c43',c:[['Cause','S6a 5001']],last:'il y a 3 j',r:1,shared:true},
];

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
    ['kpi.corr.exact','Taux de liens EXACT','1.0.0','%','liens EXACT','liens total (EXACT + OUVERT + OUVERT)','moteur de corrélation','interface, run','par paire de messages','EXACT + OUVERT + OUVERT = total',"SELECT minute, count(*) FILTER (WHERE link='EXACT') / count(*) FROM correlation GROUP BY 1"],
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

const mockNow = (k) => { const s=mockSeries(k,'15 min'); return s[s.length-1]; };
const MOCK_CAUSES = ['5GMM #7','5GMM #11','5GSM #27','5GSM #33','EMM #15','DIA 5001','HTTP 404','HTTP 503'];
const MOCK_TOP = [['Cellule 001-01-0A1F',0],['Cellule 001-01-0B07',0],['DNN internet',0],['DNN ims',0],['S-NSSAI 1-000001',0],['Run 5G #482',0],['Run 4G #219',0]];

export { SESS, NODES, SAVED, ALL_KPIS, mockSeries, seedRand };

for (const session of SESS) for (const link of session.d.links) { if (!link[6]) link[6] = []; }
