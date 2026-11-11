import { describe, expect, it } from 'vitest';
import { emptyProbeDraft, probeDraftErrors, probeDraftFromRecord, probeIdFor, probePayload, probeUpdatePayload } from './probeRegistration';

describe('probe registration contract', () => {
  it('normalizes the generated id and exact OIRAN payload casing', () => {
    const draft={...emptyProbeDraft(),name:'Lab vProbe · Site À',host:'namespace.local',mgmt_ip:'10.77.0.1',site:'Lab A'};
    expect(probeIdFor(draft)).toBe('vprobe-lab-vprobe-site-a');
    expect(probePayload(draft)).toEqual({probe_id:'vprobe-lab-vprobe-site-a',probe_type:'virtual',name:'Lab vProbe · Site À',host:'namespace.local',mgmt_ip:'10.77.0.1',site:'Lab A',interfaces:[{interface:'ens3',role:'N2',bpf_filter:'sctp port 38412'}]});
  });
  it('fails closed until every field required by the published registry is present', () => {
    expect(probeDraftErrors(emptyProbeDraft())).toEqual(expect.arrayContaining(['Name is required','Host / namespace is required','Site is required by OIRAN','Management address is required by OIRAN']));
  });
  it('hydrates and saves every editable probe and interface field',()=>{
    const draft=probeDraftFromRecord({probe_type:'Virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab'},[{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412'}]);
    expect(probeUpdatePayload('oiran-local',draft)).toEqual({probe_id:'oiran-local',probe_type:'virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab',interfaces:[{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412'}]});
  });
});
