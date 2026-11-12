import { describe, it, expect } from 'vitest';
import { buildLinks, nodeStateOf, canonical } from './topologyModel';

describe('topology links', () => {
  it('draws nothing without lab evidence', () => { expect(buildLinks({})).toEqual([]); });
  it('draws a configured interface between its 3GPP endpoints', () => {
    const [n2] = buildLinks({ interfaces: [{ name: 'N2' }] });
    expect([n2.name, n2.from, n2.to]).toEqual(['N2', 'gNB', 'AMF']);
  });
  it('a running capture never makes the network link operational', () => {
    const [s6a] = buildLinks({ runtime: [{ interface: 'S6a', active: true, state: 'CAPTURING' }] });
    expect(s6a.capture).toBe('active');
    expect(s6a.network).toBe('unknown');
  });
  it('network state comes from observed topology', () => {
    expect(buildLinks({ observedLinks: [{ name: 'N4', active: false }] })[0].network).toBe('unavailable');
  });
  it('associates probes by capture point and aliases', () => {
    const links = buildLinks({ probes: [{ id: 'p1', interfaces: ['NG-C'] }] });
    expect(links.map(l => [l.name, l.evidence.probes])).toEqual([['N2', ['p1']]]);
    expect(canonical('s1-mme')).toBe('S1-MME');
  });
  it('maps node states to four levels', () => {
    expect(['running', 'degraded', 'stopped', undefined, 'weird'].map(nodeStateOf)).toEqual(['operational', 'degraded', 'failed', 'unknown', 'unknown']);
  });
});
