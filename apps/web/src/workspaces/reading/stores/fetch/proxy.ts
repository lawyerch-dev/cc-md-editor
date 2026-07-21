// @workspace reading
import type { MediaItem } from '../../types'

// ── 服务端代理（Netlify Function，类似 Folo 的 api.folo.is）──────────

/**
 * 判断 Netlify Functions 是否可用
 * - 部署环境（Netlify）：自带 Functions
 * - 本地 dev：Vite server.proxy 将 /api/* 转发到 localhost:9999/.netlify/functions/*
 */
export function netlifyFunctionsAvailable(): boolean {
  return typeof window !== 'undefined'
}

/** 获取 Netlify Function 完整 URL（考虑 base path） */
export function netlifyFunctionPath(name: string): string {
  const host = window.location.hostname
  // 本地开发统一走 /api/*，由 Vite proxy 转发
  if (host.includes('localhost') || host.includes('127.0.0.1'))
    return `${window.location.origin}/api/${name}`
  let base = '/'
  const baseEl = document.querySelector('base')
  if (baseEl?.href) {
    try { base = new URL(baseEl.href).pathname }
    catch { /* ignore */ }
  }
  base = base.replace(/\/$/, '') || ''
  return `${window.location.origin}${base}/.netlify/functions/${name}`
}

/**
 * 通过 Netlify Function 服务端代理获取 RSS/HTML
 * 服务端无 CORS 限制，可设置任意 UA，是首选方案
 */
export async function fetchViaNetlify(url: string, timeoutMs = 15_000): Promise<Response> {
  if (!netlifyFunctionsAvailable())
    throw new Error('本地环境：Netlify Function 不可用')
  const fnUrl = netlifyFunctionPath('rss-fetch')
  const res = await window.fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, adminKey: localStorage.getItem('proxy_admin_key') || undefined }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`服务端代理返回 ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json() as { ok?: boolean, body?: string, contentType?: string, error?: string }
  if (!data.ok || typeof data.body !== 'string')
    throw new Error(`服务端代理返回异常: ${data.error || '未知错误'}`)
  return new Response(data.body, {
    headers: { 'Content-Type': data.contentType ?? 'text/plain' },
  })
}

/**
 * 专门用于 RSS 采集的 Netlify Function 代理
 * 服务端完成 XML 抓取 + 解析，直接返回结构化 Article[]，浏览器端无需解析 XML
 * 无 CORS 问题，支持编码检测，支持 retry
 * @returns 解析后的文章数组（不含 sourceId / sourceTitle，由调用方补充）
 */
export interface ProxyFeedResult {
  feedTitle: string
  articles: Array<{
    id: string
    title: string
    link: string
    content: string
    summary: string
    author: string
    publishedAt: number
    media: MediaItem[]
  }>
}

export async function fetchFeedViaProxy(url: string): Promise<ProxyFeedResult> {
  if (!netlifyFunctionsAvailable())
    throw new Error('本地环境：Netlify Function 不可用')
  const fnUrl = netlifyFunctionPath('rss-feed-proxy')
  const res = await window.fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, adminKey: localStorage.getItem('proxy_admin_key') || undefined }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Feed 代理返回 ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json() as ProxyFeedResult & { ok?: boolean, error?: string }
  if (!data.ok || !Array.isArray(data.articles)) {
    throw new Error(`Feed 代理返回异常: ${data.error || '数据格式错误'}`)
  }
  // 服务端返回的 type 为字符串，运行时值域与 MediaItem 一致
  for (const a of data.articles) {
    a.media = a.media.map(m => ({ ...m, type: m.type as MediaItem['type'] }))
  }
  return { feedTitle: data.feedTitle || '', articles: data.articles }
}

/**
 * 直接浏览器请求（仅在同源或目标允许 CORS 时有效）
 * 浏览器不允许修改 User-Agent，但 Accept header 可设置
 * 作为 Netlify 代理失败后的回退方案
 */
export async function fetchDirect(url: string, timeoutMs = 10_000): Promise<Response> {
  const isMixedContent = typeof location !== 'undefined' && location.protocol === 'https:' && url.startsWith('http:')
  if (isMixedContent)
    throw new Error('混合内容限制，无法直接请求 HTTP')
  const res = await window.fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    mode: 'cors',
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
    },
  })
  if (!res.ok)
    throw new Error(`直接请求返回 ${res.status}`)
  return res
}

/**
 * CORS 代理列表（按优先级尝试）
 * 已验证可用的服务：proxy.cors.sh（返回 200 + CORS headers + RSS XML）
 */
export const CORS_PROXIES = [
  { name: 'proxy.cors.sh', build: (u: string) => `https://proxy.cors.sh/${u}` },
  { name: 'allorigins', build: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'corsproxy.io', build: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
]

/**
 * 逐级尝试公共 CORS 代理
 */
export async function fetchViaCorsProxy(url: string): Promise<Response> {
  let lastError: Error | null = null
  for (const { name, build } of CORS_PROXIES) {
    try {
      const res = await window.fetch(build(url), {
        signal: AbortSignal.timeout(6_000),
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!res.ok) {
        lastError = new Error(`${name} 返回 ${res.status}`)
        continue
      }
      return res
    }
    catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.warn(`[Reading] CORS proxy ${name} failed:`, lastError.message)
    }
  }
  throw lastError || new Error('所有 CORS 代理均失败')
}

/**
 * 多层代理策略：优先使用 Netlify Function，失败则回退到其他方案
 * 类似 Folo 的 @follow-app/client-sdk → api.folo.is 模式，但增加了回退机制
 *
 * 优先级：Netlify（服务端代理，无 CORS 限制）→ 直接请求（CORS 友好源）→ CORS 代理
 */
export async function fetchViaServer(url: string, timeoutMs = 15_000): Promise<Response> {
  const strategies = [
    { name: 'netlify', fn: () => fetchViaNetlify(url, timeoutMs) },
    { name: 'direct', fn: () => fetchDirect(url, timeoutMs) },
    { name: 'cors-proxy', fn: () => fetchViaCorsProxy(url) },
  ]

  let lastError: Error | null = null
  for (const { name, fn } of strategies) {
    try {
      const res = await fn()
      return res
    }
    catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.warn(`[Reading] Proxy ${name} failed for ${url}:`, lastError.message)
    }
  }
  throw lastError || new Error('所有代理方案均失败')
}

/** 通过 CORS 代理获取网页 HTML（仅 CSS 选择器采集源使用） */
export async function fetchPageHTML(url: string): Promise<string> {
  const isMixedContent = typeof location !== 'undefined' && location.protocol === 'https:' && url.startsWith('http:')
  if (!isMixedContent) {
    try {
      const res = await window.fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (res.ok)
        return res.text()
    }
    catch { /* 走服务端代理 */ }
  }
  const res = await fetchViaServer(url, 12_000)
  return res.text()
}
