import type { Context } from '@netlify/functions'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let domain: string
  try {
    const body = await req.json() as Record<string, unknown>
    if (typeof body.domain !== 'string' || !body.domain) {
      return Response.json({ ok: false, error: 'Missing or invalid domain' }, { status: 400 })
    }
    domain = body.domain
  }
  catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://rsshub.app/v1/website?domain=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return Response.json({ ok: false, error: `RSSHub API returned ${res.status}` }, { status: 502 })
    }

    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'routes' in data) {
      const routes = (data as Record<string, unknown>).routes
      if (Array.isArray(routes)) {
        const parsed = routes
          .filter((r): r is string => typeof r === 'string')
          .map(r => ({ name: r, path: `https://rsshub.app${r}` }))
        return Response.json({ ok: true, routes: parsed })
      }
    }
    return Response.json({ ok: true, routes: [] })
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'RSSHub API timed out (10s)'
      : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
