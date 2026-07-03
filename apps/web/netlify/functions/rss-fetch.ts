import type { Context } from '@netlify/functions'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let url: string
  try {
    const body = await req.json() as Record<string, unknown>
    if (typeof body.url !== 'string' || !body.url) {
      return Response.json({ ok: false, error: 'Missing or invalid url' }, { status: 400 })
    }
    url = body.url
  }
  catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; md-editor/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
      },
    })

    if (!res.ok) {
      return Response.json({ ok: false, error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const body = await res.text()
    const contentType = res.headers.get('content-type') ?? 'text/plain'

    return Response.json({ ok: true, body, contentType })
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'Fetch timed out (10s)'
      : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
