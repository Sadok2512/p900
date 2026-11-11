import { describe, expect, it } from 'vitest';
import { forwardedHeaders, targetFor } from '../../ops/p900-proxy.mjs';

describe('p900 proxy request target validation', () => {
  it('rejects an invalid authority-form target instead of crashing the process', () => {
    expect(targetFor('//')).toBeNull();
  });

  it('keeps the OIRAN and POLARIS same-origin routes distinct', () => {
    expect(targetFor('/api/v1/probes')).toMatchObject({ port: 49152, scope: 'oiran' });
    expect(targetFor('/polaris-api/v1/nodes')).toMatchObject({ port: 49153, scope: 'polaris', path: '/api/v1/nodes' });
  });

  it('never asks a JSON-transforming upstream for compressed bytes', () => {
    const target=targetFor('/api/v1/probes');
    expect(target).not.toBeNull();
    const headers=forwardedHeaders({'accept-encoding':'gzip, br',authorization:'browser-secret',accept:'application/json'},target!);
    expect(headers).not.toHaveProperty('accept-encoding');
    expect(headers).not.toHaveProperty('authorization');
    expect(headers['accept']).toBe('application/json');
  });
});
