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

export { TR_CATS, TR_APPS, TR_CELLS, TR_V, TR_FLOWS };
