import type { Article, MediaItem, Source } from '../../types'

import type { FeedItem } from './utils'
import { generateArticleId, generateContentHash } from '../../utils/articleId'
import { fetchFoloEntries, fetchFoloFeed, FOLO_VIEW_MAP } from './folo'
import { parseHTMLWithSelectors } from './html-scraper'
import { fetchFeedViaProxy, fetchPageHTML } from './proxy'
import { buildRsshubUrl, getRsshubBases, getRsshubBaseUrl, isRsshubUrl } from './rss-hub'
import { fetchFeed } from './rss-parser'
import { cleanShortcodes, extractMediaFromItem, isRetryableError } from './utils'

// ── 策略分发 ───────────────────────────────────────────

async function fetchRSSSource(source: Source): Promise<Article[]> {
  // 优先走服务端 RSS 代理（Netlify Function），稳定且无 CORS 问题
  interface ProxyArticle {
    id: string
    title: string
    link: string
    content: string
    summary: string
    author: string
    publishedAt: number
    media: MediaItem[]
  }
  let items: ProxyArticle[] = []
  let srcTitle = source.title
  let proxyErr: unknown = null

  // 如果配置了 RSSHub 路由路径，优先使用 RSSHub；对 RSSHub URL 尝试多个镜像
  if (source.rsshubPath) {
    const rsshubPath = source.rsshubPath
    for (const base of getRsshubBases()) {
      try {
        const result = await fetchFeedViaProxy(buildRsshubUrl(base, rsshubPath))
        items = result.articles
        if (result.feedTitle)
          srcTitle = result.feedTitle
        proxyErr = null
        break
      }
      catch (e) {
        proxyErr = e
      }
    }
  }
  else if (isRsshubUrl(source.url)) {
    let path = ''
    try {
      path = new URL(source.url).pathname
    }
    catch {
      path = source.url.replace(/^https?:\/\/[^/]+/, '')
    }
    for (const base of getRsshubBases()) {
      try {
        const result = await fetchFeedViaProxy(buildRsshubUrl(base, path))
        items = result.articles
        if (result.feedTitle)
          srcTitle = result.feedTitle
        proxyErr = null
        break
      }
      catch (e) {
        proxyErr = e
      }
    }
  }
  else {
    try {
      const result = await fetchFeedViaProxy(source.url)
      items = result.articles
      if (result.feedTitle)
        srcTitle = result.feedTitle
    }
    catch (e) {
      proxyErr = e
    }
  }

  if (proxyErr) {
    // 代理失败时降级为浏览器端 RSS 解析（走 CORS fallback 链）
    console.warn(`[RSS] 服务端代理失败，降级为浏览器端解析 ${source.title}:`, proxyErr)
    try {
      const feed = await fetchFeed(source.url)
      srcTitle = feed.title || source.title
      const mapItem = async (item: FeedItem, _i: number) => {
        const link = item.link || ''
        const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
        const title = item.title || '无标题'
        const summary = item.contentSnippet?.slice(0, 200) || item.content?.replace(/<[^>]*>/g, '').slice(0, 200) || ''
        return {
          id: await generateArticleId(source.id, link, publishedAt),
          sourceId: source.id,
          sourceTitle: srcTitle,
          title,
          link,
          content: cleanShortcodes(item.content || item.contentSnippet || ''),
          summary,
          author: item.creator || item.author || '',
          publishedAt,
          read: false,
          starred: false,
          media: extractMediaFromItem(item),
          attachments: [],
          contentHash: await generateContentHash(title, summary),
        }
      }
      return await Promise.all(feed.items.map(mapItem))
    }
    catch {
      // 两层都失败，把原始代理错误抛出去（信息更完整）
      throw proxyErr instanceof Error ? proxyErr : new Error(String(proxyErr))
    }
  }

  return await Promise.all(items.map(async item => ({
    ...item,
    content: cleanShortcodes(item.content),
    summary: cleanShortcodes(item.summary),
    id: await generateArticleId(source.id, item.link, item.publishedAt),
    sourceId: source.id,
    sourceTitle: srcTitle,
    read: false,
    starred: false,
    attachments: [],
  })))
}

async function fetchCSSSource(source: Source): Promise<Article[]> {
  if (!source.selectors)
    throw new Error(`源 ${source.title} 缺少采集规则`)
  const html = await fetchPageHTML(source.url)
  return parseHTMLWithSelectors(html, source.selectors, source.id, source.title, source.url)
}

/** 获取 rsshub:// 源的文章 */
async function fetchFoloSource(source: Source): Promise<Article[]> {
  // 自建 RSSHub：转换 rsshub:// 为直连 URL，走现有 RSS 代理
  const rsshubBaseUrl = getRsshubBaseUrl()
  if (rsshubBaseUrl) {
    const rsshubUrl = source.url.startsWith('rsshub://')
      ? `${rsshubBaseUrl}/${source.url.slice('rsshub://'.length)}`
      : source.url
    const result = await fetchFeedViaProxy(rsshubUrl)
    return await Promise.all(result.articles.map(async a => ({
      ...a,
      id: await generateArticleId(source.id, a.link, a.publishedAt),
      sourceId: source.id,
      sourceTitle: source.title,
      read: false,
      starred: false,
      attachments: [],
    })))
  }

  // 原有 Folo API 流
  let articles: Article[]
  if (source.foloFeedId) {
    try {
      articles = await fetchFoloEntries(source.foloFeedId)
    }
    catch {
      const result = await fetchFoloFeed(source.url)
      articles = result.articles
    }
  }
  else {
    const result = await fetchFoloFeed(source.url)
    articles = result.articles
    const feedId = result.feed.id
    const foloView = result.foloView
    const mappedView = foloView != null ? (FOLO_VIEW_MAP[foloView] ?? 0) : undefined
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('folo-feed-id', { detail: { sourceId: source.id, feedId, view: mappedView } }))
    }
  }
  return articles.map(a => ({ ...a, sourceId: source.id, sourceTitle: source.title }))
}

const STRATEGIES: Record<string, (source: Source) => Promise<Article[]>> = {
  'rss': fetchRSSSource,
  'css-selector': fetchCSSSource,
  'folo-rsshub': fetchFoloSource,
}

/**
 * 根据源的策略获取文章
 * 注意：fetchRSSSource 内部已有服务端 proxy → 浏览器端 fallback 两级重试
 * 此处处理外层超时保护 + 可重试错误指数退避
 */
export async function fetchSourceArticles(source: Source): Promise<Article[]> {
  const handler = STRATEGIES[source.strategy]
  if (!handler)
    throw new Error(`未知的获取策略: ${source.strategy}`)

  const timeoutMs = source.strategy === 'rss' ? 25_000 : 15_000
  const maxRetries = 2
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * (2 ** (attempt - 1))
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    let timeoutReject: (reason?: unknown) => void
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutReject = reject
    })
    const timer = window.setTimeout(() => timeoutReject(new Error(`获取超时（${timeoutMs}ms）`)), timeoutMs)

    try {
      return await Promise.race([handler(source), timeoutPromise])
    }
    catch (err) {
      lastError = err
      if (attempt >= maxRetries || !isRetryableError(err))
        break
      console.warn(`[Reading] 获取源失败，第 ${attempt + 1} 次重试: ${source.title}`, err)
    }
    finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
