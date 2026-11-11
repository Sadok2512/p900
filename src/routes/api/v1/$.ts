import { createFileRoute } from '@tanstack/react-router'

// Relays same-origin /api/v1/* calls to the POLARIS lab server so the hosted preview can read lab data.
const PASS_REQ = ['accept', 'content-type', 'cookie', 'x-requested-with']
const PASS_RES = ['content-type', 'content-disposition', 'set-cookie', 'cache-control']

async function relay({ request, params }: { request: Request; params: { _splat?: string } }) {
  const upstream = (process.env['POLARIS_UPSTREAM_URL'] ?? 'http://151.242.147.49:8091').replace(/\/$/, '')
  const path = (params._splat ?? '').split('/').filter((s) => s && s !== '..').map(encodeURIComponent).join('/')
  const url = `${upstream}/api/v1/${path}${new URL(request.url).search}`
  const headers = new Headers()
  for (const h of PASS_REQ) { const v = request.headers.get(h); if (v) headers.set(h, v) }
  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    })
    const out = new Headers()
    for (const h of PASS_RES) { const v = res.headers.get(h); if (v) out.set(h, v) }
    return new Response(res.body, { status: res.status, headers: out })
  } catch {
    return Response.json({ error: { message: 'POLARIS non connecté' } }, { status: 502 })
  }
}

export const Route = createFileRoute('/api/v1/$')({
  server: { handlers: { GET: relay, POST: relay, PUT: relay, PATCH: relay, DELETE: relay } },
})
