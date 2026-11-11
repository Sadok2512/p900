import { describe, expect, it } from 'vitest';
import { available, toLegacySession, toLegacyCallflow, healthKpi, canCapture, querySupport, filterBody, versionComponents } from './adapters';
import { demoResponse, shouldUseDemo } from './demo';
describe('POLARIS data rules', () => {
  it('uses existing isolated demo rows only when demo is on', () => {
    expect(shouldUseDemo(false)).toBe(false);
    expect(shouldUseDemo(true)).toBe(true);
    expect(demoResponse<unknown[]>('/sessions')?.data).toHaveLength(12);
    expect(demoResponse('/sessions')?.meta['demo']).toBe(true);
    expect(demoResponse('/auth/me')).toBeUndefined();
  });
  it('missing values do not become zero; measured zero remains zero', () => {
    expect(available(undefined)).toBe('—'); expect(available(null)).toBe('—'); expect(available(0)).toBe(0);
    expect(toLegacySession({}).comp).toBe('—'); expect(toLegacySession({}).dur).toBe('—');
  });
  it('maps the observed session fields and never fabricates an identifier', () => {
    const row = toLegacySession({session_id:'lte-session-a',anchor_capture_id:'cap-a',first_packet_number:67,ue_pseudonym:'psn-test',state:'ACTIVE',technology:'LTE',procedure:'Attach',decode_completeness:97,interfaces:['S1-MME','S11'],ue_ip:'198.51.100.10'});
    expect(row).toMatchObject({id:'lte-session-a',cap:'cap-a',seq:67,ue:'psn-test',res:'ACTIVE',rat:'LTE',proc:'Attach',comp:97,interfaces:['S1-MME','S11'],missingSessionId:false});
    const missing = toLegacySession({ue_pseudonym:'psn-no-id'});
    expect(missing.id).toBeUndefined();
    expect(missing.missingSessionId).toBe(true);
  });
  it('falls back to the first API-ordered callflow event when session anchors are absent', () => {
    const row = toLegacySession(
      {session_id:'session-without-anchor'},
      {event_id:'first-event',capture_id:'capture-first',packet_references:[{packet_number:73}]}
    );
    expect(row).toMatchObject({cap:'capture-first',seq:73});
    const explicit = toLegacySession(
      {session_id:'session-with-anchor',anchor_capture_id:'capture-session',first_packet_number:19},
      {event_id:'first-event',capture_id:'capture-first',packet_references:[{packet_number:73}]}
    );
    expect(explicit).toMatchObject({cap:'capture-session',seq:19});
  });
  it('never reorders returned events by timestamp', () => {
    const d = toLegacyCallflow([{event_id:'b',message_name:'second capture',source_participant:'MME',destination_participant:'eNB',procedure_group:'Attach',packet_references:[{packet_number:22}],decoding_status:'DECODED'}, {event_id:'a',message_name:'first timestamp but second API row',source_participant:'eNB',destination_participant:'MME',procedure_group:'Attach',packet_references:[{packet_number:11}],decoding_status:'PARTIAL'}], [], []);
    expect(d.msgs.map(m => m[1])).toEqual(['second capture', 'first timestamp but second API row']);
    expect(d.evidence.map(e=>e.event_id)).toEqual(['b','a']);
    expect(d.evidence.map(e=>e.packet_number)).toEqual([22,11]);
    expect(d.nodes).toEqual(['MME','eNB']);
  });
  it('keys repeated procedure groups by their first event id', () => {
    const d = toLegacyCallflow([
      {event_id:'pfcp-a',procedure_group:'PFCP Session'},
      {event_id:'registration',procedure_group:'UE Registration and Context'},
      {event_id:'pfcp-b',procedure_group:'PFCP Session'},
    ], [], []);
    expect(d.procs).toEqual([
      ['PFCP Session',0,0,'pfcp-a'],
      ['UE Registration and Context',1,1,'registration'],
      ['PFCP Session',2,2,'pfcp-b'],
    ]);
  });
  it('maps observed correlation edges to EXACT/OUVERT with rules', () => {
    const d = toLegacyCallflow([], [], {edges:[
      {edge_id:'edge-1',confidence:'EXACT',evidence_type:'EXACT_TUNNEL_MATCH',rule_id:'s5c-s5u-teid',matching_identifiers:['teid=0x0000be90'],matched_rules:['s5c-s5u-teid']},
      {edge_id:'edge-2',confidence:'OPEN',evidence_type:'OPEN_MISSING_KEY',rule_id:'s1mme-s6a-pseudonym',matched_rules:[]},
      {edge_id:'edge-3',confidence:'probable',rule_id:'forbidden'}
    ]});
    expect(d.links.map(l=>l[5])).toEqual(['EXACT','OUVERT']);
    expect(d.links[0]?.[4]).toContain('s5c-s5u-teid');
    expect(d.links[0]?.[4]).toContain('teid=0x0000be90');
    expect(d.links[0]?.[6]).toEqual(['s5c-s5u-teid']);
  });
  it('lists every observed version component and package UI version', () => {
    const rows = versionComponents({backend_api:'2.11.6',web_frontend:'2.11.6',platform_core:'2.11.6',session_engine:'0.5.7',correlation_engine:'0.6.6',event_schema:'1.6.1',callflow_schema:'1.3.2',decoders:{diameter:'0.2.6',gtpu:'0.2.1'}},'0.9.1');
    expect(Object.fromEntries(rows)).toMatchObject({'POLARIS':'2.11.6','API':'2.11.6','Web frontend':'2.11.6','UI package.json':'0.9.1','Session engine':'0.5.7','Correlation engine':'0.6.6','Event schema':'1.6.1','Callflow schema':'1.3.2',diameter:'0.2.6',gtpu:'0.2.1'});
  });
  it('computes only available probe health metrics, with guarded denominators', () => {
    expect(healthKpi('kpi.probe.dumpcap',{dumpcap_active:6,dumpcap_expected:12})).toBe(50);
    expect(healthKpi('kpi.probe.disk',undefined,{free_bytes:25,total_bytes:100})).toBe(25);
    expect(healthKpi('kpi.probe.segments',{segments_dropped:0})).toBe(0);
    expect(healthKpi('kpi.probe.dumpcap',{dumpcap_active:6})).toBeNull();
    expect(healthKpi('kpi.probe.segments',{zero_event_segments:3})).toBeNull();
    expect(healthKpi('kpi.5g.pdu',{dumpcap_active:6,dumpcap_expected:12})).toBeNull();
  });
  it('capture is operator-only and remains closed until coordination opens it', () => {
    expect(canCapture('operator',true)).toBe(true); expect(canCapture('operator',false)).toBe(false);
    expect(canCapture('administrator',true)).toBe(false); expect(canCapture('viewer',true)).toBe(false); expect(canCapture(null,true)).toBe(false);
  });
  it('rejects unsupported grouping, OR, inequality and templates outside demo', () => {
    expect(querySupport({conds:[],group:'Cause'},false)).not.toBeNull();
    expect(querySupport({conds:[],join:'OU'},false)).not.toBeNull();
    expect(querySupport({conds:[['Cause','#27','≠']]},false)).not.toBeNull();
    expect(querySupport({conds:[],tpl:'Capture'},false)).not.toBeNull();
    expect(querySupport({conds:[['Interface','N4','=']]},false)).toBeNull();
    expect(filterBody({conds:[['Interface','N4'],['UE','ue-7f3a']]})).toEqual({interface:'N4',pseudonym:'ue-7f3a'});
  });
});
