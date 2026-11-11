import { describe, expect, it } from 'vitest';
import { captureLinkTone } from './NetworkTopology';

describe('administration topology capture badges', () => {
  it('uses green only for an active capture with ingested segments', () => {
    expect(captureLinkTone('N2', [{ interface: 'N2', status: 'CAPTURING' }], { segments_ingested: 12, pending_segments: 0 })).toBe('ok');
  });
  it('uses orange for backlog and red for stopped capture', () => {
    expect(captureLinkTone('N2', [{ interface: 'N2', status: 'CAPTURING' }], { segments_ingested: 12, pending_segments: 2 })).toBe('warn');
    expect(captureLinkTone('N3', [{ interface: 'N3', status: 'STOPPED' }], { segments_ingested: 12, pending_segments: 0 })).toBe('error');
  });
});
