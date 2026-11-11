const SYS_DASH = [
  { id:'sys.5g', lib:'SYSTEM', name:'5G SA Overview', kpis:['kpi.5g.registration','kpi.5g.pdu','kpi.5g.servicereq','kpi.lat.proc','kpi.err.sbi','kpi.n4.session'] },
  { id:'sys.lte', lib:'SYSTEM', name:'LTE Overview', kpis:['kpi.4g.attach','kpi.4g.erab','kpi.err.s6a'] },
  { id:'sys.up', lib:'SYSTEM', name:'User Plane Performance', kpis:['kpi.tcp.setup','kpi.tcp.rtt','kpi.tcp.retrans','kpi.tcp.congested'] },
  { id:'sys.probe', lib:'SYSTEM', name:'Probe Health', kpis:['kpi.probe.dumpcap','kpi.probe.lag','kpi.probe.segments','kpi.probe.disk','kpi.corr.exact'] },
].map(d => ({ ...d, widgets: d.kpis.map((k, i) => ({ id: d.id + i, kpi: k, type: i === 0 ? 'card' : 'series', title: '', x: (i % 3) * 4, y: Math.floor(i / 3) * 3, w: 4, h: 3, inherit: true, color: '', thr: '' })) }));


const ANOMS = [
  { id: 'AN-0142', kpi: 'kpi.5g.pdu', lvl: 'N1', sev: 'Critique', st: 'OUVERT', rule: 'Cause obligatoire', at: '00:31', ev: [['00:31', 'Détectée : 3 PDU Session Reject sans cause 5GSM (capture 482, seq 1 902-1 940)']] },
  { id: 'AN-0141', kpi: 'kpi.4g.attach', lvl: 'N1', sev: 'Majeure', st: 'OUVERT', rule: 'Invariant de comptage', at: '00:12', ev: [['00:12', 'succès 412 + échec 21 ≠ total 436 (minute 00:11)']] },
  { id: 'AN-0139', kpi: 'kpi.err.sbi', lvl: 'N2', sev: 'Mineure', st: 'OUVERT', rule: 'Cause jamais vue', at: '23:48', ev: [['23:48', 'HTTP 429 sur Nudm_UECM, absent du référentiel']] },
  { id: 'AN-0131', kpi: 'kpi.n4.session', lvl: 'N1', sev: 'Majeure', st: 'FERMÉ', rule: 'Ordre canonique', at: 'hier', ev: [['hier 14:02', 'seq non croissant capture 479'], ['hier 15:10', 'Fermée — preuve #311 : réimport du segment 12']] },
];

export { SYS_DASH, ANOMS };
