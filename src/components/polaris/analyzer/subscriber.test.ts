import { describe, it, expect } from 'vitest';
import { toJourney, toTmsiList, groupBySubscriber, procKind } from './subscriber';
describe('subscriber journey', () => {
  it('groups sessions by subscriber pseudonym and leaves unknown ones apart', () => {
    const g = groupBySubscriber([{ subscriber_pseudonym: 'B', cap: 'c', seq: 2 }, { subscriber_pseudonym: 'A', cap: 'c', seq: 9 }, {}, { subscriber_pseudonym: 'A', cap: 'c', seq: 3 }]);
    expect(g.map(x => [x.key, x.rows.length])).toEqual([['A', 2], ['B', 1], [null, 1]]);
    expect(g[0]!.rows.map(r => r.seq)).toEqual([3, 9]);
  });
  it('orders the timeline by (capture_id, seq), never by time', () => {
    const j = toJourney({ sessions: [{ session_id: 's2', capture_id: 'c1', seq: 50, start_timestamp: '1' }, { session_id: 's1', capture_id: 'c1', seq: 4, start_timestamp: '9' }] });
    expect(j.sessions.map(x => x.session_id)).toEqual(['s1', 's2']);
  });
  it('keeps only EXACT or OUVERT links and gives an open link its reason', () => {
    const j = toJourney({ links: [{ from: 'a', to: 'b', status: 'EXACT', proof: 'TMSI attribué…' }, { from: null, to: 'c', status: 'OPEN' }, { from: 'a', to: 'd', status: 'PROBABLE' }] });
    expect(j.links.map(l => l.status)).toEqual(['EXACT', 'OUVERT']); expect(j.links[1]!.reason).toBe('attribution non capturée');
  });
  it('marks a TMSI presented without observed assignment as not captured and hides clear values for viewers', () => {
    const clear=['0x','C0','FF','EE','01'].join('');
    const t = toTmsiList([{ tmsi: clear, tmsi_pseudonym: 'tmsi-abcdef1234567890', assigned: null, presented: [{ session_id: 's', capture_id: 'c', seq: 3 }] }], false);
    expect(t[0]).toMatchObject({ status: 'attribution non capturée', label: 'tmsi-abcde…7890' });
    expect(toTmsiList([{ tmsi: clear, assigned: { seq: 1 }, status: 'replaced' }], true)[0]).toMatchObject({ label: clear, status: 'remplacé' });
  });
  it('colours procedures by kind', () => {
    expect(['Attach', 'PDU Session Establishment', 'Service Request', 'Tracking Area Update', 'Detach'].map(procKind)).toEqual(['attach', 'pdu', 'service', 'tau', 'detach']);
  });
});
