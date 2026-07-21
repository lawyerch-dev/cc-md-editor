// @workspace reading
import type { Article, FeedViewType, MediaItem } from '../../types'

import { generateArticleId, generateContentHash } from '../../utils/articleId'
import { fetchFeedViaProxy, netlifyFunctionPath, netlifyFunctionsAvailable } from './proxy'
import { getRsshubBaseUrl } from './rss-hub'
import { cleanShortcodes } from './utils'

// ── Folo API（代理 rsshub:// 请求）──────────────────────

const FOLO_API = 'https://api.folo.is'

interface FoloFeedResponse {
  code: number
  data: {
    feed: { id: string, title: string, description?: string, siteUrl?: string, image?: string }
    entries: Array<{
      id: string
      title: string
      url: string
      content?: string
      description?: string
      summary?: string
      publishedAt: string
      author?: string
      media?: Array<{ url: string, type: string, width?: number, height?: number, preview_image_url?: string, duration_in_seconds?: number }>
      attachments?: Array<{ url: string, mime_type?: string, duration_in_seconds?: number, size_in_bytes?: number, title?: string }> | null
    }>
    analytics?: { view?: number }
  }
}

interface FoloEntriesResponse {
  code: number
  data: Array<{
    read: boolean
    feeds: { id: string, title: string }
    entries: {
      id: string
      title: string
      url: string
      content?: string
      description?: string
      summary?: string
      publishedAt: string
      author?: string
      media?: Array<{ url: string, type: string, width?: number, height?: number, preview_image_url?: string, duration_in_seconds?: number }>
      attachments?: Array<{ url: string, mime_type?: string, duration_in_seconds?: number, size_in_bytes?: number, title?: string }> | null
    }
    settings?: { unread?: boolean }
  }>
}

/** Folo analytics.view → 我们的 FeedViewType 映射 */
export const FOLO_VIEW_MAP: Record<number, FeedViewType> = {
  0: 0, // Articles
  1: 4, // SocialMedia
  2: 1, // Pictures
  3: 2, // Videos
  4: 3, // Audios
}

/** 从 HTML 中提取第一张图片 URL */
function firstImageFromHtml(html: string): string | undefined {
  const m = html.match(/<img[^>]+src="([^"]+)"/i)
  return m?.[1]
}

/** 将 Folo API 返回的条目转为我们的 Article 格式 */
async function mapFoloEntry(entry: FoloFeedResponse['data']['entries'][0], sourceId: string, sourceTitle: string): Promise<Article> {
  const contentHtml = entry.content || entry.description || ''
  const media: MediaItem[] = (entry.media || []).map(m => ({
    url: m.url,
    type: (m.type === 'video' ? 'video' : m.type === 'audio' ? 'audio' : 'photo') as MediaItem['type'],
    // ponytail: fallback to first img from content for video thumbnails
    previewImageUrl: m.preview_image_url || firstImageFromHtml(contentHtml),
    durationInSeconds: m.duration_in_seconds,
    width: m.width,
    height: m.height,
  }))
  const attachments: Article['attachments'] = (entry.attachments || []).map(a => ({
    url: a.url,
    mimeType: a.mime_type,
    durationInSeconds: a.duration_in_seconds,
    sizeInBytes: a.size_in_bytes,
    title: a.title,
  }))
  const content = cleanShortcodes(entry.content || entry.description || '')
  const summary = entry.summary || content.replace(/<[^>]*>/g, '').slice(0, 200) || ''
  const title = entry.title || '无标题'
  const link = entry.url || ''
  const publishedAt = entry.publishedAt ? new Date(entry.publishedAt).getTime() : Date.now()
  return {
    id: await generateArticleId(sourceId, link, publishedAt),
    sourceId,
    sourceTitle,
    title,
    link,
    content,
    summary,
    author: entry.author || '',
    publishedAt,
    read: false,
    starred: false,
    media,
    attachments,
    contentHash: await generateContentHash(title, summary),
  }
}

/** Folo 分页参数 */
const MAX_PAGES = 2
const BATCH_SIZE = 40
const FOLO_PAGE_DELAY_MS = 300

/**
 * 通用 Folo entries 分页获取
 * 循环拉取多页，直到没有更多或达到 MAX_PAGES 上限
 */
async function fetchFoloEntriesPaginated(feedId: string, _view: number, publishedAfter: string | null = null): Promise<Article[]> {
  const allArticles: Article[] = []
  let cursor = publishedAfter
  for (let page = 0; page < MAX_PAGES; page++) {
    const json: FoloEntriesResponse = await fetchFoloJSON(`${FOLO_API}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        view: -1, // -1 = all views; avoids Folo vs local FeedViewType numbering mismatch
        feedId,
        read: false,
        insertedAfter: null,
        publishedAfter: cursor,
        limit: BATCH_SIZE,
      }),
    })
    if (json.code !== 0)
      throw new Error(`Folo entries API 错误: code=${json.code}`)

    const batch = await Promise.all(json.data.map(async (item) => {
      const art = await mapFoloEntry(item.entries, item.feeds.id, item.feeds.title)
      art.read = !!item.read
      return art
    }))

    if (batch.length === 0)
      break

    allArticles.push(...batch)

    // 用最后一条的 publishedAt 作为下一页游标
    cursor = new Date(batch[batch.length - 1].publishedAt).toISOString()

    // 返回少于 limit → 没有更多了
    if (batch.length < BATCH_SIZE)
      break

    // 页间延迟，避免触发 Folo rate limit
    if (page < MAX_PAGES - 1)
      await new Promise(resolve => setTimeout(resolve, FOLO_PAGE_DELAY_MS))
  }
  return allArticles
}

/** 通过 Folo API 获取 rsshub:// 源的订阅信息和文章 */
export async function fetchFoloFeed(rsshubUrl: string): Promise<{ feed: FoloFeedResponse['data']['feed'], articles: Article[], foloView?: number }> {
  const apiUrl = `${FOLO_API}/feeds?url=${encodeURIComponent(rsshubUrl)}`
  const json: FoloFeedResponse = await fetchFoloJSON(apiUrl)
  if (json.code !== 0 || !json.data?.feed)
    throw new Error(`Folo API 错误: code=${json.code}`)

  const { feed, entries, analytics } = json.data
  let articles = await Promise.all(entries.map(e => mapFoloEntry(e, feed.id, feed.title)))

  // 首次拉取后，继续翻页获取更多历史文章
  if (articles.length > 0) {
    try {
      const more = await fetchFoloEntriesPaginated(
        feed.id,
        -1,
        new Date(articles[articles.length - 1].publishedAt).toISOString(),
      )
      articles = articles.concat(more)
    }
    catch {
      // 翻页失败不影响已有结果
    }
  }

  return { feed, articles, foloView: analytics?.view }
}

/** 通过 Folo API 获取更多文章（分页/刷新） */
export async function fetchFoloEntries(feedId: string, view = -1): Promise<Article[]> {
  return fetchFoloEntriesPaginated(feedId, view)
}

/** 通过 CORS 代理请求 Folo JSON API */
async function fetchFoloJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method || 'GET'
  const body = init?.body ? JSON.parse(init.body as string) : undefined
  const foloPath = url.replace('https://api.folo.is', '')
  const lastErrors: string[] = []

  // 1. Vite 本地代理（开发环境，/api/folo → api.folo.is）
  if (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.port) {
    try {
      const proxyUrl = `/api/folo${foloPath}`
      const res = await window.fetch(proxyUrl, {
        ...init,
        signal: AbortSignal.timeout(6_000),
      })
      if (res.ok)
        return await res.json() as T
    }
    catch (e) {
      lastErrors.push(`vite-proxy: ${e instanceof Error ? e.message : e}`)
    }
  }

  // 2. Netlify Function 代理（生产环境，GET/POST 均支持）
  if (netlifyFunctionsAvailable()) {
    try {
      const fnUrl = netlifyFunctionPath('folo-proxy')
      const res = await window.fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: foloPath, method, body }),
        signal: AbortSignal.timeout(8_000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data && typeof data === 'object' && 'ok' in data && !data.ok)
          throw new Error(data.error || 'Folo proxy error')
        return data as T
      }
    }
    catch (e) {
      lastErrors.push(`netlify: ${e instanceof Error ? e.message : e}`)
    }
  }

  // 3. CORS 代理（GET 请求）
  if (method === 'GET') {
    const proxies = [
      { name: 'allorigins', build: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    ]
    for (const proxy of proxies) {
      try {
        const proxyUrl = proxy.build(url)
        const res = await window.fetch(proxyUrl, { signal: AbortSignal.timeout(5_000) })
        if (res.ok)
          return await res.json() as T
      }
      catch (e) {
        lastErrors.push(`${proxy.name}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // 4. 直连（最后尝试）
  try {
    const res = await window.fetch(url, { ...init, signal: AbortSignal.timeout(5_000) })
    if (res.ok)
      return await res.json() as T
  }
  catch (e) {
    lastErrors.push(`direct: ${e instanceof Error ? e.message : e}`)
  }

  throw new Error(`Folo API 请求失败: ${lastErrors.join('; ')}`)
}

/** 探测 rsshub:// 源是否可用 */
export async function probeFoloRSSHub(rsshubUrl: string): Promise<{ isRSS: boolean, title?: string, itemCount?: number, feedId?: string, view?: number }> {
  // 自建 RSSHub：直接探测
  const rsshubBaseUrl = getRsshubBaseUrl()
  if (rsshubBaseUrl) {
    const fetchUrl = `${rsshubBaseUrl}/${rsshubUrl.slice('rsshub://'.length)}`
    try {
      const result = await fetchFeedViaProxy(fetchUrl)
      if (result.articles.length > 0)
        return { isRSS: true, title: result.feedTitle, itemCount: result.articles.length }
    }
    catch { /* 降级到 Folo */ }
  }

  // 走 Folo API
  try {
    const { feed, articles, foloView } = await fetchFoloFeed(rsshubUrl)
    const mappedView = foloView != null ? (FOLO_VIEW_MAP[foloView] ?? 0) : undefined
    return { isRSS: articles.length > 0, title: feed.title, itemCount: articles.length, feedId: feed.id, view: mappedView }
  }
  catch {
    return { isRSS: false }
  }
}
