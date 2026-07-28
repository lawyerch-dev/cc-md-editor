import type { Context } from '@netlify/functions'
import process from 'node:process'

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

const FETCH_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
]

function getRandomUA(): string {
  return FETCH_USER_AGENTS[Math.floor(Math.random() * FETCH_USER_AGENTS.length)]
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let url: string
  let adminKey: string | undefined
  try {
    const body = await req.json() as Record<string, unknown>
    if (typeof body.url !== 'string' || !body.url) {
      return Response.json({ ok: false, error: 'Missing or invalid url' }, { status: 400 })
    }
    url = body.url
    if (typeof body.adminKey === 'string')
      adminKey = body.adminKey
  }
  catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const startAt = Date.now()

  // 带重试的获取逻辑：优先用国内代理，失败则直连
  // Netlify 免费版 Function 超时 10s，单次 fetch 用 8s 留余量给编码处理
  const PROXY_URL = 'https://proxy.new-ai.cn'
  const PROXY_TOKEN = process.env.PROXY_TOKEN || 'ccmd2024proxy'
  const ADMIN_KEY = process.env.ADMIN_KEY || ''

  // 鉴权：生产环境需要 Admin Key（本地开发由 Vite proxy 控制访问）
  const isLocalDev = !ADMIN_KEY || (req.headers.get('host') || '').includes('localhost')
  if (!isLocalDev && adminKey !== ADMIN_KEY) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!PROXY_TOKEN) {
    console.warn('[rss-fetch] PROXY_TOKEN not configured')
  }

  async function tryFetch(targetUrl: string, timeoutMs: number): Promise<Response> {
    // 先尝试国内代理
    try {
      const proxyHeaders: Record<string, string> = {}
      if (PROXY_TOKEN)
        proxyHeaders['X-Proxy-Token'] = PROXY_TOKEN
      if (adminKey)
        proxyHeaders['X-Admin-Key'] = adminKey
      const proxyRes = await fetch(`${PROXY_URL}/${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: proxyHeaders,
      })
      if (proxyRes.ok)
        return proxyRes
    }
    catch { /* 代理不可用时降级 */ }
    // 降级到直连
    return fetch(targetUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await tryFetch(url, attempt === 0 ? 8_000 : 4_000)

      if (!res.ok) {
        lastError = new Error(`Upstream returned ${res.status}`)
        // 4xx 错误不重试
        if (res.status >= 400 && res.status < 500)
          break
        continue
      }

      // 取原始字节，检测编码后正确解码（解决 GBK/GB2312 等非 UTF-8 源的乱码）
      const buffer = await res.arrayBuffer()
      const encoding = detectEncoding(buffer, res.headers.get('content-type'))
      const body = new TextDecoder(encoding, { fatal: false }).decode(buffer)
      const contentType = res.headers.get('content-type') ?? 'text/plain'

      console.log(`[rss-fetch] ok url=${url} status=${res.status} duration=${Date.now() - startAt}ms`)
      return Response.json({ ok: true, body, contentType })
    }
    catch (err) {
      const message = err instanceof Error && err.name === 'TimeoutError'
        ? 'Fetch timed out (12s)'
        : String(err)
      lastError = new Error(message)
    }
  }

  console.log(`[rss-fetch] error url=${url} duration=${Date.now() - startAt}ms error=${lastError?.message}`)
  return Response.json({ ok: false, error: lastError?.message || 'Unknown error' }, { status: 502 })
}
