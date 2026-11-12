import { describe, expect, it } from 'vitest';
import { basicAuthEnabled, basicAuthorized, csrfForToken, forwardedHeaders, targetFor } from '../../ops/p900-proxy.mjs';

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

  it('replaces browser credentials and derives the OIRAN CSRF proof server-side', () => {
    const target=targetFor('/api/v1/probes');
    const headers=forwardedHeaders({authorization:'browser-secret','x-csrf-token':'browser-proof'},target!,'POST','server-token');
    expect(headers['authorization']).toBe('Bearer server-token');
    expect(headers['x-csrf-token']).toBe(csrfForToken('server-token'));
    expect(headers['x-csrf-token']).not.toBe('browser-proof');
  });

  it('accepts only the configured Basic account without exposing the password', () => {
    const good=`Basic ${Buffer.from('sadok:test-password').toString('base64')}`;
    const bad=`Basic ${Buffer.from('sadok:wrong').toString('base64')}`;
    expect(basicAuthorized({authorization:good},'sadok','test-password')).toBe(true);
    expect(basicAuthorized({authorization:bad},'sadok','test-password')).toBe(false);
    expect(basicAuthorized({},'sadok','test-password')).toBe(false);
  });

  it('allows Basic authentication to be disabled explicitly while remaining enabled by default', () => {
    expect(basicAuthEnabled()).toBe(true);
    expect(basicAuthEnabled('0')).toBe(false);
    expect(basicAuthEnabled('false')).toBe(false);
    expect(basicAuthEnabled('1')).toBe(true);
  });
});
