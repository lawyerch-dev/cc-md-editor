import type { Context } from '@netlify/functions'

/** 从 HTTP 响应头和 XML 声明中检测字符编码 */
function detectEncoding(buffer: ArrayBuffer, contentType: string | null): string {
  // 1. Content-Type 头的 charset 参数
  if (contentType) {
    const match = contentType.match(/charset=([\w-]+)/i)
    if (match)
      return match[1]
  }

  // 2. XML 声明中的 encoding（在原始字节中查找）
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 500))
  const xmlMatch = head.match(/encoding=(["'])([\w-]+)\1/i)
  if (xmlMatch)
    return xmlMatch[2]

  // 3. 默认 UTF-8
  return 'UTF-8'
}

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

    // 取原始字节，检测编码后正确解码（解决 GBK/GB2312 等非 UTF-8 源的乱码）
    const buffer = await res.arrayBuffer()
    const encoding = detectEncoding(buffer, res.headers.get('content-type'))
    const body = new TextDecoder(encoding, { fatal: false }).decode(buffer)
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
