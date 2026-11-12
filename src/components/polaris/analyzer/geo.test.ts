import { describe, it, expect } from 'vitest';
import { extractGeo, coords, radioContext } from './geo';
describe('geolocation extraction', () => {
  it('returns nothing when no coordinates exist', () => { expect(extractGeo({ technology: '5G', cell_id: '42', timing_advance: 3 }, [{ message_name: 'X' }]).points).toEqual([]); });
  it('never treats a serving cell site as the UE position', () => { const g = extractGeo({ serving_cell: { cell_id: 'C1', latitude: 48.8, longitude: 2.3 } }); expect(g.points).toHaveLength(1); expect(g.points[0]?.kind).toBe('cell'); });
  it('marks GNSS UE positions actual and others estimated', () => {
    const g = extractGeo({}, [{ ue_location: { latitude: 48, longitude: 2, source: 'GNSS' } }, { ue_location: { latitude: 48.1, longitude: 2.1, source: 'E-CID' } }]);
    expect(g.points.map(p => p.kind)).toEqual(['ue-actual', 'ue-estimated']); expect(g.trajectory).toHaveLength(2);
  });
  it('rejects invalid or null-island coordinates', () => { expect(coords({ lat: 0, lon: 0 })).toBeNull(); expect(coords({ lat: 91, lon: 2 })).toBeNull(); });
  it('uses an event index carried by the data to build the trajectory', () => {
    const g = extractGeo({ ue_track: [{ latitude: 48.89, longitude: 2.24, source: 'GNSS', event_index: 0 }, { latitude: 48.9, longitude: 2.23, source: 'GNSS', event_index: 8 }] });
    expect(g.points.map(p => p.eventIndex)).toEqual([0, 8]); expect(g.trajectory).toHaveLength(2);
  });
  it('reads radio identifiers from IE trees without inventing them', () => { const r = radioContext({ ies: [{ name: 'PCI', value: 301 }, { name: 'TAC', value: '0x01' }] }); expect(r.pci).toBe('301'); expect(r.tac).toBe('0x01'); expect(r.cellId).toBeNull(); });
});
