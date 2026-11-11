import { describe, expect, it } from 'vitest';
import { available, toLegacySession, toLegacyCallflow, healthKpi, canCapture, querySupport, filterBody } from './adapters';
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
  it('never reorders returned events by timestamp', () => {
    const d = toLegacyCallflow([{event_id:'b',seq:2,message:'second capture',timestamp:'2026-11-11T10:00:00',source:'AMF',destination:'UE'}, {event_id:'a',seq:1,message:'earlier time',timestamp:'2026-11-11T09:00:00',source:'UE',destination:'AMF'}], [], []);
    expect(d.msgs.map(m => m[1])).toEqual(['second capture', 'earlier time']);
    expect(d.evidence.map(e=>e.event_id)).toEqual(['b','a']);
  });
  it('only renders EXACT/OUVERT links and preserves matched_rules', () => {
    const d = toLegacyCallflow([], [], [{status:'EXACT',matched_rules:['r1']},{status:'OUVERT',matched_rules:[]},{status:'probable'}]);
    expect(d.links.map(l=>l[5])).toEqual(['EXACT','OUVERT']); expect(d.links[0]?.[6]).toEqual(['r1']);
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
