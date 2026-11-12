import { describe, expect, it } from 'vitest';
import { emptyProbeDraft, isProbeRole, probeDraftErrors, probeDraftFromRecord, probeFieldErrors, probeIdFor, probeInterfaceErrors, probePayload, probeUpdatePayload } from './probeRegistration';

describe('probe registration contract', () => {
  it('normalizes the generated id and exact OIRAN payload casing', () => {
    const draft={...emptyProbeDraft(),name:'Lab vProbe · Site À',host:'namespace.local',mgmt_ip:'10.77.0.1',site:'Lab A'};
    expect(probeIdFor(draft)).toBe('vprobe-lab-vprobe-site-a');
    expect(probePayload(draft)).toEqual({probe_id:'vprobe-lab-vprobe-site-a',probe_type:'virtual',name:'Lab vProbe · Site À',host:'namespace.local',mgmt_ip:'10.77.0.1',site:'Lab A',interfaces:[{interface:'ens3',role:'N2',bpf_filter:'sctp port 38412'}]});
  });
  it('fails closed until every field required by the published registry is present', () => {
    expect(probeDraftErrors(emptyProbeDraft())).toEqual(expect.arrayContaining([
      'Le nom de la sonde est obligatoire.',
      'Le serveur / namespace est obligatoire.',
      'Le site est exigé par OIRAN.',
      "L'adresse de gestion est exigée par OIRAN.",
    ]));
  });
  it('hydrates and saves every editable probe and interface field',()=>{
    const draft=probeDraftFromRecord({probe_type:'Virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab'},[{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412'}]);
    expect(probeUpdatePayload('oiran-local',draft)).toEqual({probe_id:'oiran-local',probe_type:'virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab',interfaces:[{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412'}]});
  });
  it('keeps a server role outside the offered enumeration instead of rewriting it to N2',()=>{
    const draft=probeDraftFromRecord({probe_type:'virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab'},
      [{interface:'sbi0',role:'S6a',bpf_filter:'tcp port 36412'},{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412'}]);
    expect(draft.interfaces.map(item=>item.role)).toEqual(['S6a','N2']);
    expect(isProbeRole('S6a')).toBe(false);
    expect(probePayload(draft).interfaces[0]).toEqual({interface:'sbi0',role:'S6a',bpf_filter:'tcp port 36412'});
  });
  it('shows the server protocol without sending it in the payload',()=>{
    const draft=probeDraftFromRecord({probe_type:'virtual',name:'Local',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab'},[{interface:'br-n2',role:'N2',bpf_filter:'sctp port 38412',protocol:'NGAP'}]);
    expect(draft.interfaces[0]?.protocol).toBe('NGAP');
    expect(JSON.stringify(probePayload(draft))).not.toContain('NGAP');
  });
  it('marks the affected control instead of one generic message',()=>{
    const draft={...emptyProbeDraft(),name:'',host:'localhost',mgmt_ip:'10.77.0.1',site:'Lab A'};
    expect(probeFieldErrors(draft)).toEqual({name:'Le nom de la sonde est obligatoire.'});
    expect(probeFieldErrors({...draft,mgmt_ip:'tcp port 9'})).toEqual({name:'Le nom de la sonde est obligatoire.',mgmt_ip:"L'adresse de gestion doit être une adresse IP."});
    expect(probeInterfaceErrors({...draft,interfaces:[{interface:'',role:'',bpf_filter:''}]})).toEqual([{interface:'Nom de l’interface requis.',role:'Rôle de capture requis.',bpf_filter:'Filtre BPF requis.'}]);
  });
});
