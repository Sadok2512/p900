import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalogParam, fetchQueryCatalog, fetchSessionColumns, searchQueryCatalog, supportsQueryApi } from '@/lib/polaris-api';

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
    const catalog = { protocol_tree: [{ interface:'N2', protocols:[{ protocol:'NGAP', messages:[{ message:'TEST.Message', detail:{occurrences:1,params:[]} }] }] }], network_elements:[], columns:[], filters:{}, always_present_columns:[], session_count:1, scope:{} };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: catalog, meta: {} }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchQueryCatalog()).resolves.toMatchObject({ data: catalog });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/sessions/catalog', expect.objectContaining({ method: 'GET' }));
  });

  it('uses the observed search and parameter-detail routes', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: String(input).includes('/param?') ? { param_path:'cause',type:'enum',occurrences:2,observed_values:[],decoded_from_octets:true,example_sessions:[] } : { results:[],total:0,query:{} }, meta: {} }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    await searchQueryCatalog('cause',['N2']);
    await fetchCatalogParam({interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'cause'});
    expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions/catalog/search?q=cause&interfaces=N2&limit=50'))).toBe(true);
    expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions/catalog/param?interface=N2&protocol=NGAP&message=TEST.Message&param_path=cause'))).toBe(true);
  });

  it('posts the typed column request without rerunning the session filter', async () => {
    const result = [{ session_id: 'session-test', fields: [{ interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',mode:'last',value:16,proof:[{event_id:'event-test',capture_id:'capture-test',seq:1}] }] }];
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: result, meta: {} }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const body = { session_ids: ['session-test'], columns: [], fields: [{ interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',mode:'last' as const }] };
    await expect(fetchSessionColumns(body)).resolves.toMatchObject({ data: result });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/sessions/columns', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/sessions/filter'))).toBe(false);
  });
});
