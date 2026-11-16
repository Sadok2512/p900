import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchQueryCatalog, fetchSessionColumns, supportsQueryApi } from '@/lib/polaris-api';

afterEach(() => vi.unstubAllGlobals());

describe('oiran-api 2.19 query contract', () => {
  it('enables the routes only for backend_api 2.19.0 or newer', () => {
    expect(supportsQueryApi({ backend_api: '2.18.12' })).toBe(false);
    expect(supportsQueryApi({ data: { backend_api: '2.19.0' }, meta: {} })).toBe(true);
    expect(supportsQueryApi({ backend_api: '2.19.0-rc.1' })).toBe(true);
    expect(supportsQueryApi({ platform_core: '3.0.0' })).toBe(true);
    expect(supportsQueryApi({ backend_api: 'inconnue' })).toBe(false);
  });

  it('loads only the catalog returned by the API', async () => {
    const catalog = { messages: [{ name: 'TEST.Message', fields: [{ path: 'test.field', type: 'integer' }] }] };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: catalog, meta: {} }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchQueryCatalog()).resolves.toMatchObject({ data: catalog });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/query/catalog', expect.objectContaining({ method: 'GET' }));
  });

  it('posts the typed column request without rerunning the session filter', async () => {
    const result = { rows: [{ session_id: 'session-test', values: { cause: { value: 16, event_id: 'event-test' } } }] };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: result, meta: {} }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const body = { session_ids: ['session-test'], columns: [{ id: 'cause', message_name: 'TEST.Message', parameter_path: 'test.cause', aggregation: 'last' as const }] };
    await expect(fetchSessionColumns(body)).resolves.toMatchObject({ data: result });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/sessions/columns', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/sessions/filter'))).toBe(false);
  });
});
