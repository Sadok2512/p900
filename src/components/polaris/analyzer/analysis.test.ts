import { describe, it, expect } from 'vitest';
import { verdict, steps, overall, failures, sessionKpis, type Flow } from './analysis';
const flow = (msgs: Flow['msgs'], procs: Flow['procs'], evidence: Record<string, unknown>[] = []): Flow => ({ msgs, procs, evidence });
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
