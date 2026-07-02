import type { Article, CollectorSelectors, Source } from './types'
import RSSParser from 'rss-parser'

// ── CORS 代理 ──────────────────────────────────────────

const CORS_PROXIES: Array<(url: string) => string> = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url='

/**
 * 带 CORS 代理回退的 fetch：先尝试直接请求，再依次尝试每个代理。
 */
export async function fetchWithProxy(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await window.fetch(url, { ...init, signal: AbortSignal.timeout(5000) })
    if (res.ok)
      return res
  }
  catch { /* CORS 拦截或超时，走代理 */ }

  let lastError: unknown
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(url)
      const res = await window.fetch(proxyUrl, { ...init, signal: AbortSignal.timeout(15000) })
      if (res.ok)
        return res
      lastError = new Error(`代理响应 ${res.status}`)
    }
    catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('所有 CORS 代理均失败')
}

// ── RSS 解析 ───────────────────────────────────────────

async function fetchFeed(url: string): Promise<{ title: string, items: Array<{ title?: string, link?: string, content?: string, contentSnippet?: string, creator?: string, author?: string, pubDate?: string, guid?: string }> }> {
  try {
    const res = await fetchWithProxy(url)
    const xml = await res.text()
    const parser = new RSSParser()
    const feed = await parser.parseString(xml)
    return { title: feed.title || '', items: feed.items }
  }
  catch { /* 走 rss2json */ }

  const res = await window.fetch(RSS2JSON_API + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) })
  if (!res.ok)
    throw new Error(`rss2json 代理请求失败: ${res.status}`)
  const data: unknown = await res.json()
  if (!data || typeof data !== 'object' || !('status' in data))
    throw new Error('rss2json 返回格式异常')
  const status = (data as Record<string, unknown>).status
  if (status !== 'ok') {
    const msg = 'message' in (data as Record<string, unknown>) ? (data as Record<string, unknown>).message : 'RSS 解析失败'
    throw new Error(String(msg))
  }
  const items = 'items' in (data as Record<string, unknown>) ? (data as Record<string, unknown>).items : []
  const feed = 'feed' in (data as Record<string, unknown>) ? (data as Record<string, unknown>).feed : null
  const feedTitle = feed && typeof feed === 'object' && 'title' in feed ? String((feed as Record<string, unknown>).title) : ''
  return {
    title: feedTitle,
    items: Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          title: typeof item.title === 'string' ? item.title : undefined,
          link: typeof item.link === 'string' ? item.link : undefined,
          content: typeof item.content === 'string' ? item.content : undefined,
          contentSnippet: typeof item.description === 'string' ? item.description.replace(/<[^>]*>/g, '').slice(0, 200) : undefined,
          creator: typeof item.author === 'string' ? item.author : undefined,
          pubDate: typeof item.pubDate === 'string' ? item.pubDate : undefined,
          guid: typeof item.guid === 'string' ? item.guid : undefined,
        }))
      : [],
  }
}

/** 探测 URL 是否为 RSS 源 */
export async function probeRSS(url: string): Promise<{ isRSS: boolean, title?: string, itemCount?: number }> {
  try {
    const feed = await fetchFeed(url)
    if (feed.items.length > 0) {
      return { isRSS: true, title: feed.title, itemCount: feed.items.length }
    }
    return { isRSS: false }
  }
  catch {
    return { isRSS: false }
  }
}

// ── HTML 采集 ──────────────────────────────────────────

/** 通过 CORS 代理获取网页 HTML */
export async function fetchPageHTML(url: string): Promise<string> {
  const res = await fetchWithProxy(url)
  return res.text()
}

/** 噪音关键词 — 导航、页脚、通用链接文本 */
const NOISE_PATTERNS = /^(?:首页|登录|注册|关于|联系我们|网站地图|首页导航|English|中文版|登录邮箱系统|公报|导航|更多|返回|下载|APP|客户端|微信|微博|RSS|订阅)$/i

/** 用 CSS 选择器从 HTML 中提取文章列表 */
function parseHTMLWithSelectors(html: string, selectors: CollectorSelectors, sourceId: string, sourceTitle: string, baseUrl = ''): Article[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const items = doc.querySelectorAll(selectors.item)
  const articles: Article[] = []

  items.forEach((el, i) => {
    const titleEl = selectors.title ? el.querySelector(selectors.title) : null
    const linkEl = selectors.link ? el.querySelector(selectors.link) : null
    const contentEl = selectors.content ? el.querySelector(selectors.content) : null
    const summaryEl = selectors.summary ? el.querySelector(selectors.summary) : null
    const authorEl = selectors.author ? el.querySelector(selectors.author) : null
    const dateEl = selectors.date ? el.querySelector(selectors.date) : null

    const title = titleEl?.textContent?.trim() || el.textContent?.trim() || ''
    // 过滤噪音：太短的标题、纯数字、导航关键词
    if (!title || title.length < 4)
      return
    if (/^\d+$/.test(title))
      return
    if (NOISE_PATTERNS.test(title))
      return

    const href = linkEl?.getAttribute('href') || (el as HTMLAnchorElement).getAttribute('href') || ''
    let link = ''
    if (href.startsWith('http')) {
      link = href
    }
    else if (href.startsWith('/') && baseUrl) {
      try { link = new URL(href, baseUrl).href }
      catch { /* ignore */ }
    }
    const content = contentEl?.innerHTML || ''
    const summary = summaryEl?.textContent?.trim() || content.replace(/<[^>]*>/g, '').slice(0, 200)
    const author = authorEl?.textContent?.trim() || ''
    const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || ''
    const publishedAt = dateStr ? new Date(dateStr).getTime() || Date.now() - i * 60000 : Date.now() - i * 60000

    articles.push({
      id: `col-${sourceId}-${link || title}-${i}`,
      sourceId,
      sourceTitle,
      title,
      link,
      content,
      summary,
      author,
      publishedAt,
      read: false,
      starred: false,
    })
  })

  return articles
}

/** 预览 CSS 选择器采集结果（不保存） */
export async function previewSelectors(url: string, selectors: CollectorSelectors): Promise<Article[]> {
  const html = await fetchPageHTML(url)
  return parseHTMLWithSelectors(html, selectors, 'preview', '', url)
}

// ── JSON API 源 ────────────────────────────────────────

/** 中国政府网·最新政策 */
async function fetchGovPolicy(): Promise<Article[]> {
  try {
    const res = await fetchWithProxy('https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json')
    const data: unknown = await res.json()
    const items = Array.isArray(data) ? data : []
    return items.slice(0, 20).map((item: Record<string, unknown>, i: number) => {
      const url = typeof item.URL === 'string' ? item.URL : ''
      return {
        id: `gov-policy-${url.match(/content_(\d+)\.htm/)?.[1] || i}`,
        sourceId: 'gov-policy',
        sourceTitle: '中国政府网',
        title: typeof item.TITLE === 'string' ? item.TITLE : '无标题',
        link: url,
        content: '',
        summary: typeof item.SUB_TITLE === 'string' ? item.SUB_TITLE : '',
        author: '',
        publishedAt: typeof item.DOCRELPUBTIME === 'string' ? new Date(item.DOCRELPUBTIME).getTime() : Date.now(),
        read: false,
        starred: false,
      }
    })
  }
  catch (e) {
    console.warn('[GovPolicy] Fetch failed:', e)
    return []
  }
}

/** JSON API 解析器注册表（可扩展） */
const JSON_PARSERS: Record<string, () => Promise<Article[]>> = {
  'gov-policy': fetchGovPolicy,
}

// ── 策略分发 ───────────────────────────────────────────

async function fetchRSSSource(source: Source): Promise<Article[]> {
  const feed = await fetchFeed(source.url)
  const srcTitle = feed.title || source.title
  return feed.items.map(item => ({
    id: `art-${source.id}-${item.guid || item.link || Date.now()}`,
    sourceId: source.id,
    sourceTitle: srcTitle,
    title: item.title || '无标题',
    link: item.link || '',
    content: item.content || item.contentSnippet || '',
    summary: item.contentSnippet?.slice(0, 200) || item.content?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
    author: item.creator || item.author || '',
    publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
    read: false,
    starred: false,
  }))
}

async function fetchCSSSource(source: Source): Promise<Article[]> {
  if (!source.selectors)
    throw new Error(`源 ${source.title} 缺少采集规则`)
  const html = await fetchPageHTML(source.url)
  return parseHTMLWithSelectors(html, source.selectors, source.id, source.title, source.url)
}

async function fetchJSONSource(source: Source): Promise<Article[]> {
  const parser = JSON_PARSERS[source.id]
  if (!parser)
    throw new Error(`未知的 JSON API 源: ${source.id}`)
  return parser()
}

const STRATEGIES: Record<string, (source: Source) => Promise<Article[]>> = {
  'rss': fetchRSSSource,
  'css-selector': fetchCSSSource,
  'json-api': fetchJSONSource,
}

/** 根据源的策略获取文章 */
export async function fetchSourceArticles(source: Source): Promise<Article[]> {
  const handler = STRATEGIES[source.strategy]
  if (!handler)
    throw new Error(`未知的获取策略: ${source.strategy}`)
  return handler(source)
}

// ── 全文提取 ───────────────────────────────────────────

/** 从文章链接获取完整正文 */
export async function fetchFullText(url: string): Promise<string> {
  const html = await fetchPageHTML(url)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript, nav, footer, header, aside, iframe, .ad, .advertisement, .sidebar, .comment').forEach(el => el.remove())
  const selectors = ['article', 'main', '.post-content', '.article-content', '.entry-content', '.content', '#content', '.post-body']
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el && el.textContent && el.textContent.trim().length > 200) {
      return el.innerHTML
    }
  }
  return doc.body?.innerHTML || ''
}

// ── RSSHub 发现 ────────────────────────────────────────

/** 输入 URL，查询 RSSHub API 获取可用的 RSS 路由 */
export async function discoverRSSHubRoutes(url: string): Promise<Array<{ name: string, path: string }>> {
  try {
    const domain = new URL(url).hostname
    const res = await window.fetch(`https://rsshub.app/v1/website?domain=${domain}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok)
      return []
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'routes' in data) {
      const routes = (data as Record<string, unknown>).routes
      if (Array.isArray(routes)) {
        return routes.filter((r): r is string => typeof r === 'string').map(r => ({
          name: r,
          path: `https://rsshub.app${r}`,
        }))
      }
    }
    return []
  }
  catch {
    return []
  }
}
