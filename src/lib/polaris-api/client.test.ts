import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, requestFrom, relativeBase, redact } from './client';
afterEach(() => vi.unstubAllGlobals());
describe('POLARIS client', () => {
  const subscriber=()=>['001','01','012','345','6789'].join('');
  it('unwraps data and meta using relative API paths and proxy credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { pending_segments: 7 }, meta: { total: 1 } })));
    vi.stubGlobal('fetch', fetcher);
    expect(await request('/metrics')).toEqual({ data: { pending_segments: 7 }, meta: { total: 1 } });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/metrics');
    expect(fetcher.mock.calls[0]?.[1].credentials).toBe('same-origin');
    expect(fetcher.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  });
  it('maps HTTP 403 to a neutral inline-ready server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })));
    await expect(request('/probes')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'Action refusée par le serveur (HTTP 403)' });
  });
  it('uses a distinct same-origin base for the Simulator topology', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [] }, meta: {} })));
    vi.stubGlobal('fetch', fetcher);
    await requestFrom('/polaris-api/v1', '/nodes');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/polaris-api/v1/nodes');
    expect(fetcher.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  });
  it('reports the failed network request instead of an HTTP 0 label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(request('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0, message: 'Erreur réseau pour GET /health' });
  });
  it('reports the real preview HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Only HTML requests are supported here' }), { status: 406 })));
    await expect(request('/health')).rejects.toMatchObject({ status: 406, message: 'GET /health · HTTP 406' });
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
    expect(redact({ imsi: subscriber(), supi: 'private', guti: 'private', tmsi: 'private', imei: 'private', pei:'private', gpsi:'private', K: 'private', OPc: 'private', pseudonym: 'ue-7f3a', decoded: [{ name: 'GUTI', value: 'private' }] })).toEqual({ imsi:'masqué', supi:'masqué', guti:'masqué', tmsi:'masqué', imei:'masqué', pei:'masqué', gpsi:'masqué', K:'masqué', OPc:'masqué', pseudonym:'ue-7f3a', decoded:[{name:'GUTI',value:'masqué'}] });
  });
  it('admits clear identities whenever the caller requests the clear identity route', async () => {
    const clear=subscriber();
    const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({data:{imsi:clear},meta:{}})));
    vi.stubGlobal('fetch',fetcher);
    expect((await request<{imsi:string}>('/sessions/test/identities',{clearIdentityResponse:true})).data.imsi).toBe(clear);
    expect((await request<{imsi:string}>('/sessions/test/identities')).data.imsi).toBe('masqué');
  });
  it('keeps opaque temporary-identity pseudonyms while masking clear TMSI fields', () => {
    expect(redact({ tmsi: 'private', tmsi_pseudonym: 'psn-temporary-a' })).toEqual({ tmsi: 'masqué', tmsi_pseudonym: 'psn-temporary-a' });
  });
  it('does not require role metadata on an explicitly clear response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { imsi: 'test-value' }, meta: {} })));
    vi.stubGlobal('fetch', fetcher);
    expect((await request('/sessions/s/identities', { clearIdentityResponse: true })).data).toEqual({ imsi: 'test-value' });
  });
  it('limits concurrency to four and lets an opened-session detail jump the queue', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>(resolve => resolvers.push(resolve)));
    vi.stubGlobal('fetch', fetcher);
    const normal = Array.from({ length: 6 }, (_, index) => request(`/background-${index}`, { priority: 'background' }));
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(4);
    const detail = request('/sessions/opened', { priority: 'detail' });
    resolvers.shift()?.(new Response(JSON.stringify({ data: {}, meta: {} })));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
    expect(fetcher.mock.calls[4]?.[0]).toBe('/api/v1/sessions/opened');
    while (resolvers.length) resolvers.shift()?.(new Response(JSON.stringify({ data: {}, meta: {} })));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(7));
    while (resolvers.length) resolvers.shift()?.(new Response(JSON.stringify({ data: {}, meta: {} })));
    await Promise.all([...normal, detail]);
  });
  it('keeps navigation cancellation as AbortError', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(request('/sessions/left', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

import { it as itU, expect as expectU, vi as viU } from 'vitest';
itU('reports the relay unreachable marker with its real cause (502)', async () => {
  viU.stubGlobal('fetch', viU.fn(async () => new Response(JSON.stringify({ error: { code: 'BACKEND_UNREACHABLE' } }), { status: 200, headers: { 'x-polaris-unreachable': '1' } })));
  const { request } = await import('./client');
  await expectU(request('/health')).rejects.toMatchObject({ status: 502, message: 'Relais indisponible pour GET /health (HTTP 502)' });
  viU.unstubAllGlobals();
});
