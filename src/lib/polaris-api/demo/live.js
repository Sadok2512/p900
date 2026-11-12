import { INTERFACE_FAMILY_HEX, interfaceFamilyOf } from '../../polaris-ui/interfaceColors';

/* Interface colours come from the shared family map, so a ladder line, a chip
 * and a badge never disagree about what N2 or SBI looks like. */
const ifcColor = name => INTERFACE_FAMILY_HEX[interfaceFamilyOf(name)].fg;

const S5G = [
  ['N2','NGAP/NAS-5GMM','UE','AMF','Registration Request','Registration','—','', 'start'],
  ['SBI','HTTP/2','AMF','AUSF','POST /ue-authentications','Authentication','—','', ''],
  ['SBI','HTTP/2','AUSF','UDM','POST /generate-auth-data','Authentication','201','', ''],
  ['N2','NGAP/NAS-5GMM','AMF','UE','Authentication Request','Authentication','—','', ''],
  ['N2','NGAP/NAS-5GMM','UE','AMF','Authentication Response','Authentication','Succès','', 'end'],
  ['N2','NGAP/NAS-5GMM','AMF','UE','Security Mode Command','Security Mode','—','', 'start'],
  ['N2','NGAP/NAS-5GMM','UE','AMF','Security Mode Complete','Security Mode','Succès','', 'end'],
  ['N2','NGAP/NAS-5GMM','AMF','UE','Registration Accept','Registration','Succès','', 'end'],
  ['N2','NGAP/NAS-5GSM','UE','AMF','PDU Session Establishment Request','PDU Session Establishment','—','', 'start'],
  ['SBI','HTTP/2','AMF','SMF','POST /sm-contexts','PDU Session Establishment','201','', ''],
  ['N4','PFCP','SMF','UPF','PFCP Session Establishment Request','PDU Session Establishment','—','', ''],
  ['N4','PFCP','UPF','SMF','PFCP Session Establishment Response','PDU Session Establishment','Accepted','', ''],
  ['N2','NGAP','AMF','gNB','PDU Session Resource Setup Request','PDU Session Establishment','—','', ''],
  ['N2','NGAP','gNB','AMF','PDU Session Resource Setup Response','PDU Session Establishment','Succès','', ''],
  ['N2','NGAP/NAS-5GSM','AMF','UE','PDU Session Establishment Accept','PDU Session Establishment','Succès','', 'end'],
  ['N2','NGAP/NAS-5GSM','UE','AMF','PDU Session Establishment Request','PDU Session Establishment','—','', 'start'],
  ['N2','NGAP/NAS-5GSM','AMF','UE','PDU Session Establishment Reject','PDU Session Establishment','Échec','5GSM #27 missing or unknown DNN', 'end'],
  ['N2','NGAP/NAS-5GMM','UE','AMF','Service Request','Service Request','—','', 'start'],
  ['N2','NGAP/NAS-5GMM','AMF','UE','Service Accept','Service Request','Succès','', 'end'],
  ['N4','PFCP','SMF','UPF','PFCP Session Modification Request','Session Modification','—','', 'start'],
  ['N4','PFCP','UPF','SMF','PFCP Session Modification Response','Session Modification','Accepted','', 'end'],
];
const SLTE = [
  ['S1-MME','S1AP/NAS-EMM','UE','MME','Attach Request','Attach','—','', 'start'],
  ['S6a','Diameter','MME','HSS','Authentication-Information-Request','Authentication','—','', 'start'],
  ['S6a','Diameter','HSS','MME','Authentication-Information-Answer','Authentication','2001','', ''],
  ['S1-MME','S1AP/NAS-EMM','MME','UE','Authentication Request','Authentication','—','', ''],
  ['S1-MME','S1AP/NAS-EMM','UE','MME','Authentication Response','Authentication','Succès','', 'end'],
  ['S1-MME','S1AP/NAS-EMM','MME','UE','Security Mode Command','Security Mode','—','', 'start'],
  ['S1-MME','S1AP/NAS-EMM','UE','MME','Security Mode Complete','Security Mode','Succès','', 'end'],
  ['S6a','Diameter','MME','HSS','Update-Location-Request','Attach','—','', ''],
  ['S6a','Diameter','HSS','MME','Update-Location-Answer','Attach','2001','', ''],
  ['S11','GTPv2-C','MME','SGW','Create Session Request','Attach','—','', ''],
  ['S5','GTPv2-C','SGW','PGW','Create Session Request','Attach','—','', ''],
  ['S5','GTPv2-C','PGW','SGW','Create Session Response','Attach','Accepted','', ''],
  ['S11','GTPv2-C','SGW','MME','Create Session Response','Attach','Accepted','', ''],
  ['S1-MME','S1AP','MME','eNB','Initial Context Setup Request','Attach','—','', ''],
  ['S1-MME','S1AP','eNB','MME','Initial Context Setup Response','Attach','Succès','', ''],
  ['S1-MME','S1AP/NAS-EMM','MME','UE','Attach Accept','Attach','Succès','', 'end'],
  ['S1-MME','S1AP/NAS-EMM','UE','MME','Tracking Area Update Request','TAU','—','', 'start'],
  ['S1-MME','S1AP/NAS-EMM','MME','UE','Tracking Area Update Reject','TAU','Échec','EMM #9 UE identity cannot be derived', 'end'],
];
const NODES = { '5G': ['UE','gNB','AMF','AUSF','UDM','SMF','UPF'], 'LTE': ['UE','eNB','MME','HSS','SGW','PGW'] };
const IFC_C = { N2: ifcColor('N2'), SBI: ifcColor('SBI'), N4: ifcColor('N4'), 'S1-MME': ifcColor('S1-MME'), S6a: ifcColor('S6a'), S11: ifcColor('S11'), S5: ifcColor('S5') };
/* Known identities (demo lookup table, stands in for the correlated identity chain API) */
const DIR = {
  'ue-7f3a': { tech:'5G', st:'Trouvé', imsiMask:'masqué', proof:'Registration Request · SUCI→SUPI (SBI Nausf, capture 482 seq 1 204)', cap:482,
    info: { 'Technologie':['5G SA',1204], 'PLMN':['001-01',1204], 'Site':['Lab-Paris',null], 'Cell Name':[null,null], 'NR-CGI':['001-01-0000A1F01',1205], 'TAC':['0x000101',1205], 'gNB ID':['0x0A1F',1205],
      'AMF':['amf-1 (GUAMI 001-01-02-3F)',1211], 'SMF':['smf-1',1222], 'UPF':['upf-1',1224], 'DNN':['internet',1220], 'S-NSSAI':['1-000001',1220], 'PDU Session ID':['1',1220], '5QI':['9',1228], 'QFI':['1',1228] } },
  'ue-21c0': { tech:'LTE', st:'OUVERT', imsiMask:'masqué', proof:'User-Name S6a observé, GUTI non relié (EXACT manquant)', cap:219,
    info: { 'Technologie':['LTE',801], 'PLMN':['001-01',801], 'Site':['Lab-Paris',null], 'Cell Name':[null,null], 'ECGI':['001-01-0B07A1',802], 'TAC':['0x0102',802], 'eNB ID':['0x0B07',802],
      'MME':['mme-1',801], 'SMF':[null,null], 'SGW':['sgw-1',810], 'APN':['internet',810], 'S-NSSAI':[null,null], 'Bearer ID':['5',812], 'QCI':['9',812], 'QFI':[null,null] } },
};

export { S5G, SLTE, NODES, IFC_C, DIR };
