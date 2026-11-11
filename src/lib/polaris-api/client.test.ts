import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, relativeBase, redact } from './client';
afterEach(() => vi.unstubAllGlobals());
describe('POLARIS client', () => {
  it('unwraps data and meta using relative API paths and proxy credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { pending_segments: 7 }, meta: { total: 1 } })));
    vi.stubGlobal('fetch', fetcher);
    expect(await request('/metrics')).toEqual({ data: { pending_segments: 7 }, meta: { total: 1 } });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/metrics');
    expect(fetcher.mock.calls[0]?.[1].credentials).toBe('same-origin');
    expect(fetcher.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  });
  it('maps HTTP 403 to the role error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })));
    await expect(request('/probes')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'Accès refusé (rôle)' });
  });
  it('maps failed network to POLARIS non connecté', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(request('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0, message: 'POLARIS non connecté' });
  });
  it('maps the preview missing API response to disconnected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Only HTML requests are supported here' }), { status: 406 })));
    await expect(request('/health')).rejects.toMatchObject({ status: 406, message: 'POLARIS non connecté' });
  });
  it('does not accept preview HTML as an API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html/>')));
    await expect(request('/health')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects absolute and protocol-relative API bases', () => {
    expect(() => relativeBase(['https:', '', 'example.test', 'api', 'v1'].join('/'))).toThrow();
    expect(() => relativeBase('//example.test/api/v1')).toThrow();
    expect(relativeBase('/api/v1')).toBe('/api/v1');
  });
  it('masks every forbidden identity field, including name/value decoding pairs', () => {
    expect(redact({ imsi: '001010000000101', supi: 'private', guti: 'private', tmsi: 'private', imei: 'private', K: 'private', OPc: 'private', pseudonym: 'ue-7f3a', decoded: [{ name: 'GUTI', value: 'private' }] })).toEqual({ imsi:'masqué', supi:'masqué', guti:'masqué', tmsi:'masqué', imei:'masqué', K:'masqué', OPc:'masqué', pseudonym:'ue-7f3a', decoded:[{name:'GUTI',value:'masqué'}] });
  });
});
