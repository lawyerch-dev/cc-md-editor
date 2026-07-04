import type { Context } from '@netlify/functions'

/**
 * Proxy requests to Folo API (api.folo.is)
 * Avoids CORS issues when calling from the browser
 *
 * Usage:
 *   POST /.netlify/functions/folo-proxy
 *   Body: { "path": "/feeds?url=rsshub%3A%2F%2F...", "method": "GET" }
 *   or:   { "path": "/entries", "method": "POST", "body": {"view":0,"feedId":"..."} }
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let path: string
  let method: string
  let body: unknown

  try {
    const input = await req.json() as Record<string, unknown>
    path = String(input.path || '')
    method = String(input.method || 'GET').toUpperCase()
    body = input.body
  }
  catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!path || !path.startsWith('/')) {
    return Response.json({ ok: false, error: 'Missing or invalid path' }, { status: 400 })
  }

  const apiUrl = `https://api.folo.is${path}`

  try {
    const fetchInit: RequestInit = {
      method,
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }

    if (method === 'POST' && body) {
      fetchInit.headers = {
        ...fetchInit.headers as Record<string, string>,
        'Content-Type': 'application/json',
      }
      fetchInit.body = JSON.stringify(body)
    }

    const res = await fetch(apiUrl, fetchInit)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return Response.json(
        { ok: false, error: `Folo API returned ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data: unknown = await res.json()
    return Response.json(data)
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'Folo API timed out (15s)'
      : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
