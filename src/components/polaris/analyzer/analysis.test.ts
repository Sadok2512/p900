import { describe, it, expect } from 'vitest';
import { verdict, steps, overall, failures, sessionKpis, sessionNumberLabel, type Flow } from './analysis';
const flow = (msgs: Flow['msgs'], procs: Flow['procs'], evidence: Record<string, unknown>[] = []): Flow => ({ msgs, procs, evidence });

describe('sessionNumberLabel — ANR1 #10 6884587508 (2.3.1 FAIL)', () => {
  it('returns c<cap> · <seq> when cap and seq are real values', () => {
    expect(sessionNumberLabel({ id: 'any', cap: 103, seq: 417, session_id: '5g-session-xxx' }))
      .toBe('c103 · 417');
    expect(sessionNumberLabel({ id: 'any', cap: 'sha256:abc', seq: 42, session_id: '5g-session-xxx' }))
      .toBe('csha256:abc · 42');
  });
  it('falls back to session_id when cap is the tiret long placeholder — preuve prod ANR1', () => {
    // Payload réelle pour 5g-session-c330d205adafa233 : anchor_capture_id
    // et first_packet_number absents → `available()` renvoie '—' (U+2014).
    // L'ancien check `r.cap!=null && r.seq!=null` passait → `c— · —`.
    expect(sessionNumberLabel({ id: '5g-session-c330d205adafa233', cap: '—', seq: '—', session_id: '5g-session-c330d205adafa233' }))
      .toBe('5g-session-c330d205adafa233');
  });
  it('falls back to session_id when only seq is the tiret long placeholder', () => {
    expect(sessionNumberLabel({ id: 'any', cap: 103, seq: '—', session_id: '5g-session-aaa' }))
      .toBe('5g-session-aaa');
  });
  it('falls back to session_id when cap/seq are null (defensive)', () => {
    expect(sessionNumberLabel({ id: 'any', cap: null, seq: null, session_id: '5g-session-bbb' }))
      .toBe('5g-session-bbb');
  });
  it('returns #<id> when both cap/seq AND session_id are unavailable', () => {
    expect(sessionNumberLabel({ id: 42, cap: '—', seq: '—' })).toBe('#42');
  });
  it('returns "identifiant absent" when id itself is missing', () => {
    expect(sessionNumberLabel({ cap: 1, seq: 2, session_id: 'x' })).toBe('identifiant absent');
    expect(sessionNumberLabel({ id: '', cap: 1, seq: 2 })).toBe('identifiant absent');
  });
  it('rejects empty string cap or seq like it rejects —', () => {
    expect(sessionNumberLabel({ id: 'any', cap: '', seq: '', session_id: 's1' })).toBe('s1');
  });
});
describe('session analysis', () => {
  it('maps states to the four results', () => {
    expect(verdict('Succès')).toBe('SUCCESS'); expect(verdict('Échec')).toBe('FAILED');
    expect(verdict('partial')).toBe('PARTIAL'); expect(verdict('—')).toBe('UNKNOWN'); expect(verdict('ACTIVE')).toBe('UNKNOWN');
  });
  it('does not call a step SUCCESS on a request alone', () => {
    expect(steps(flow([['N2', 'Registration Request', 'UE → AMF', null, null, null]], [['Registration', 0, 0]]))[0]!.result).toBe('PARTIAL');
  });
  it('marks a step SUCCESS only when it ends with a completion message', () => {
    expect(steps(flow([['N2', 'Registration Request', 'UE → AMF', null, null, null], ['N2', 'Registration Accept', 'AMF → UE', null, null, null]], [['Registration', 0, 1]]))[0]!.result).toBe('SUCCESS');
  });
  it('reports a proven failure with its cause and message', () => {
    const f = flow([['N2', 'PDU Session Request', 'UE → AMF', null, null, null], ['N2', 'PDU Session Reject', 'SMF → UE', null, 'cause 5GSM', '#27']], [['PDU Session', 0, 1]]);
    expect(steps(f)[0]!.result).toBe('FAILED'); expect(failures(f)[0]).toMatchObject({ index: 1, cause: '#27', procedure: 'PDU Session', entity: 'SMF' });
    expect(overall('ACTIVE', steps(f))).toBe('FAILED');
  });
  it('reads epoch-second timestamps', () => {
    expect(sessionKpis({ start_timestamp: '1794158356.5', end_timestamp: '1794158357.75Z' }, flow([], [])).durationMs).toBe(1250);
  });
  it('shows no throughput when the server provides none', () => {
    expect(sessionKpis({}, flow([], [])).dlAvg).toBeNull();
    expect(sessionKpis({ start_timestamp: '2026-01-01T00:00:00Z', end_timestamp: '2026-01-01T00:00:02Z' }, flow([], [])).durationMs).toBe(2000);
  });
});
import { pageItems, pageSlice } from './analysis';
describe('sessions pagination', () => {
  it('splits 142 rows into pages of 25 without loss or duplicates', () => {
    const rows = Array.from({ length: 142 }, (_, i) => i);
    const pages = Array.from({ length: 6 }, (_, p) => pageSlice(rows, p + 1, 25));
    expect(pages[5]).toHaveLength(17); expect(pages.flat()).toEqual(rows);
  });
  it('shows first, last and neighbours with gaps', () => {
    expect(pageItems(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageItems(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
  });
});
import { visibleMessages, filterOptions, emptyFilter, OTHER_EVENTS } from './analysis';
describe('ladder message filter', () => {
  const f: Flow = { msgs: [['N2', 'Initial UE Message', 'gNB → AMF', null, null, null], ['N4', 'PFCP Session Establishment Request', 'SMF → UPF', null, null, null], ['N3', 'G-PDU', 'gNB → UPF', null, null, null]],
    procs: [['Background / Lifecycle', 0, 0], ['PFCP Session', 1, 1]], evidence: [{ protocol: 'NGAP', direction: 'RAN_TO_CORE' }, { protocol: 'PFCP' }, { protocol: 'GTP-U' }] };
  it('groups Background / Lifecycle and unassigned messages under Autres événements', () => {
    expect(filterOptions(f).procs).toEqual(['PFCP Session', OTHER_EVENTS]);
  });
  it('hides an excluded procedure but keeps the other messages', () => {
    expect(visibleMessages(f, [], { ...emptyFilter(), procs: [OTHER_EVENTS] })).toEqual([1]);
  });
  it('combines interface toggles with name search', () => {
    expect(visibleMessages(f, ['N3'], { ...emptyFilter(), text: 'pfcp' })).toEqual([1]);
    expect(visibleMessages(f, [], { ...emptyFilter(), dir: 'UL' })).toEqual([0]);
  });
});
import { sessionSummary, backgroundSteps } from './analysis';
describe('0.10.1 session result and durations', () => {
  const acc = (cap: string, t: number) => ({ capture_id: cap, observed_epoch_ms: 1_793_017_327_000 + t });
  it('derives SUCCESS from procedures when the server state is unknown', () => {
    const f = flow([['N2', 'Registration Request', 'UE → AMF', null, null, null], ['N2', 'Registration Accept', 'AMF → UE', null, null, null]], [['Registration', 0, 1]], [acc('c1', 1000), acc('c1', 1326)]);
    expect(sessionSummary({ state: 'HISTORICAL_CONTEXT' }, f)).toMatchObject({ res: 'SUCCESS', durationMs: 326, multiCapture: false });
  });
  it('gives PARTIAL when one procedure is partial, UNKNOWN when none', () => {
    const f = flow([['N2', 'Registration Accept', 'AMF → UE', null, null, null], ['N2', 'PDU Session Request', 'UE → AMF', null, null, null]], [['Registration', 0, 0], ['PDU', 1, 1]]);
    expect(sessionSummary({}, f).res).toBe('PARTIAL'); expect(sessionSummary({}, flow([], [])).res).toBe('UNKNOWN');
  });
  it('never compares timestamps across captures', () => {
    const f = flow([['N2', 'A Request', '', null, null, null], ['N2', 'A Response', '', null, null, null]], [['A', 0, 1]], [acc('c1', 0), acc('c2', 9_900_000)]);
    expect(sessionSummary({ start_timestamp: '0', end_timestamp: '9900' }, f)).toMatchObject({ durationMs: null, multiCapture: true });
    expect(steps(f)[0]).toMatchObject({ durationMs: null, multiCapture: true });
  });
  it('keeps background events out of the chronology and the duration', () => {
    const f = flow([['N2', 'A Request', '', null, null, null], ['N2', 'A Response', '', null, null, null], ['N2', 'NG Setup', '', null, null, null]], [['A', 0, 1], ['Background / Lifecycle', 2, 2]], [acc('c1', 0), acc('c1', 326), acc('c1', 663_000)]);
    expect(steps(f).map(x => x.name)).toEqual(['A']); expect(backgroundSteps(f)).toHaveLength(1);
    expect(sessionSummary({}, f).durationMs).toBe(326);
  });
});
describe('procedure duration ignores interleaved events', () => {
  it('measures only the events of the procedure itself', () => {
    const T = 1_793_017_327_000;
    const ev = [{ capture_id: 'c', procedure_group: 'Reg', observed_epoch_ms: T }, { capture_id: 'c', procedure_group: 'Background / Lifecycle', observed_epoch_ms: T + 663_000 }, { capture_id: 'c', procedure_group: 'Reg', observed_epoch_ms: T + 300 }];
    const f = flow([['N2', 'Registration Request', '', null, null, null], ['N2', 'NG Setup', '', null, null, null], ['N2', 'Registration Accept', '', null, null, null]], [['Reg', 0, 2]], ev);
    expect(steps(f)[0]!.durationMs).toBe(300);
  });
});
