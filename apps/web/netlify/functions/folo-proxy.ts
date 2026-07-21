import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 500
const ENTRIES_CACHE_TTL_MS = 60_000

/**
 * Sleep helper — no `new Promise` executor form per project convention.
 */
function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

/**
 * Retry-able fetch against Folo API.
 * TLS/connection errors get an exponential-backoff retry.
 */
async function fetchWithRetry(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) })
  }
  catch (err) {
    const isTlsError
      = err instanceof Error
        && (err.message.includes('Client network socket')
          || err.message.includes('TLS')
          || err.message.includes('ECONNRESET')
          || err.message.includes('ENETUNREACH')
          || err.message.includes('socket hang up')
          || err.message.includes('network'))

    // Non-retryable / last attempt → rethrow
    if (attempt >= MAX_RETRIES || !isTlsError)
      throw err

    await sleep(BASE_DELAY_MS * attempt)
    return fetchWithRetry(url, init, attempt + 1)
  }
}

interface CacheEntry {
  data: unknown
  cachedAt: number
}

/** 对 /entries 请求生成缓存键 */
function entriesCacheKey(path: string, body: unknown): string {
  const params = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
  const feedId = String(params.feedId || '')
  const publishedAfter = String(params.publishedAfter || '')
  const limit = String(params.limit || '')
  return `entries:${feedId}:${publishedAfter}:${limit}`
}

/** 读取缓存 */
async function getCachedEntries(key: string): Promise<unknown | null> {
  try {
    const store = getStore('folo-proxy-cache')
    const entry = await store.get(key, { type: 'json' }) as CacheEntry | null
    if (!entry)
      return null
    if (Date.now() - entry.cachedAt > ENTRIES_CACHE_TTL_MS) {
      await store.delete(key).catch(() => {})
      return null
    }
    return entry.data
  }
  catch {
    return null
  }
}

/** 写入缓存 */
async function setCachedEntries(key: string, data: unknown): Promise<void> {
  try {
    const store = getStore('folo-proxy-cache')
    await store.setJSON(key, { data, cachedAt: Date.now() })
  }
  catch {
    // 缓存失败不影响主流程
  }
}

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
  const isEntries = path === '/entries' && method === 'POST'
  const cacheKey = isEntries ? entriesCacheKey(path, body) : ''
  const startAt = Date.now()

  try {
    // /entries 请求先读缓存
    if (isEntries) {
      const cached = await getCachedEntries(cacheKey)
      if (cached) {
        console.log(`[folo-proxy] cache hit ${cacheKey}`)
        return Response.json(cached)
      }
    }

    const fetchInit: RequestInit = {
      method,
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

    const res = await fetchWithRetry(apiUrl, fetchInit)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.log(`[folo-proxy] error path=${path} status=${res.status} duration=${Date.now() - startAt}ms`)
      return Response.json(
        { ok: false, error: `Folo API returned ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data: unknown = await res.json()
    console.log(`[folo-proxy] ok path=${path} status=${res.status} duration=${Date.now() - startAt}ms`)

    if (isEntries)
      await setCachedEntries(cacheKey, data)

    return Response.json(data)
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'Folo API timed out'
      : String(err)
    console.log(`[folo-proxy] exception path=${path} duration=${Date.now() - startAt}ms error=${message}`)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
