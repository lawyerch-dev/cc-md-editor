import type { Article, CollectorSelectors, FeedViewType, MediaItem, Source } from './types'

/** 清理内容中的视频/音频短代码 */
function cleanShortcodes(html: string): string {
  return html.replace(/\[!--begin:\w+--\][\s\S]*?\[!--end:\w+--\]/g, '')
}

/** 基于内容的简易哈希，用于无 guid/link 时生成稳定 ID */
function hashContent(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++)
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(36)}`
}

// ── RSSHub 配置 ────────────────────────────────────

let _rsshubBaseUrl = ''

/** 设置自建 RSSHub 地址（有值时跳过 Folo API，直接走 RSSHub） */
export function setRsshubBaseUrl(url: string) {
  _rsshubBaseUrl = url.replace(/\/+$/, '')
}

/** 获取 RSSHub 地址 */
export function getRsshubBaseUrl(): string {
  return _rsshubBaseUrl
}

// ── 服务端代理（Netlify Function，类似 Folo 的 api.folo.is）──────────

/**
 * 判断 Netlify Functions 是否可用
 *  部署环境：basepath=/，函数路径正确
 *  本地 dev 无 Functions：base=/md/，函数路径 404
 *  本地 dev + proxy：base=/（SERVER_ENV=NETLIFY），无 <base> 标签
 */
function netlifyFunctionsAvailable(): boolean {
  if (typeof window === 'undefined')
    return false
  const host = window.location.hostname
  // 非 localhost → 已部署
  if (!host.includes('localhost') && !host.includes('127.0.0.1'))
    return true
  // localhost：有 <base> 且不是 /md/，或无 <base>（默认 /）= proxy 模式
  const base = document.querySelector('base')
  if (!base)
    return true // 无 base 标签 = path 从根开始
  const href = base.getAttribute('href')
  return href !== '/md/'
}

/** 获取 Netlify Function 完整 URL（考虑 base path） */
function netlifyFunctionPath(name: string): string {
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
async function fetchViaNetlify(url: string, timeoutMs = 15_000): Promise<Response> {
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
async function fetchFeedViaProxy(url: string): Promise<{
  feedTitle: string
  articles: Array<{
    id: string
    title: string
    link: string
    content: string
    summary: string
    author: string
    publishedAt: number
    media: Array<{ url: string, type: string, previewImageUrl?: string, mimeType?: string, width?: number, height?: number }>
  }>
}> {
  if (!netlifyFunctionsAvailable())
    throw new Error('本地环境：Netlify Function 不可用')
  const fnUrl = netlifyFunctionPath('rss-feed-proxy')
  const res = await window.fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Feed 代理返回 ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json()
  if (!data.ok || !Array.isArray(data.articles)) {
    throw new Error(`Feed 代理返回异常: ${data.error || '数据格式错误'}`)
  }
  return { feedTitle: data.feedTitle || '', articles: data.articles }
}

/**
 * 直接浏览器请求（仅在同源或目标允许 CORS 时有效）
 * 浏览器不允许修改 User-Agent，但 Accept header 可设置
 * 作为 Netlify 代理失败后的回退方案
 */
async function fetchDirect(url: string, timeoutMs = 10_000): Promise<Response> {
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
const CORS_PROXIES = [
  { name: 'proxy.cors.sh', build: (u: string) => `https://proxy.cors.sh/${u}` },
  { name: 'allorigins', build: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'corsproxy.io', build: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
]

/**
 * 逐级尝试公共 CORS 代理
 */
async function fetchViaCorsProxy(url: string): Promise<Response> {
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
async function fetchViaServer(url: string, timeoutMs = 15_000): Promise<Response> {
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
export function detectFeedViewType(articles: Article[]): FeedViewType {
  const sample = articles.slice(0, 10)
  let audioCount = 0
  let videoCount = 0
  let imageCount = 0
  for (const a of sample) {
    for (const m of a.media) {
      if (m.type === 'audio')
        audioCount++
      else if (m.type === 'video')
        videoCount++
      else if (m.type === 'photo')
        imageCount++
    }
    // 也检查 attachments 中的音频（播客可能存放在 attachments）
    for (const att of a.attachments) {
      if (att.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(att.url))
        audioCount++
      else if (att.mimeType?.startsWith('video/') || /\.(?:mp4|webm|mov)(?:\?|$)/i.test(att.url))
        videoCount++
    }
  }
  const total = sample.length || 1
  if (audioCount / total >= 0.8)
    return 3 // Audios
  if (videoCount / total >= 0.6)
    return 2 // Videos
  if (imageCount / total >= 0.5 && imageCount >= 3)
    return 1 // Pictures
  return 0 // Articles
}

// ── RSS 解析 ───────────────────────────────────────────

interface FeedItem {
  'title'?: string
  'link'?: string
  'content'?: string
  'contentSnippet'?: string
  'creator'?: string
  'author'?: string
  'pubDate'?: string
  'guid'?: string
  'enclosure'?: { url?: string, type?: string, length?: string }
  'media:content'?: { url?: string, type?: string, medium?: string, width?: string, height?: string }
  'media:thumbnail'?: { url?: string }
}

/** 从 XML 元素中提取文本内容（支持 CDATA） */
function getText(el: Element | null): string {
  if (!el)
    return ''
  return (el.textContent || '').trim()
}

/** 从 XML 元素中按标签名获取第一个子元素 */
function getEl(parent: Element, tag: string): Element | null {
  return parent.querySelector(tag)
}

/** 纯浏览器 DOMParser 解析 RSS 2.0 / Atom，无 Node.js 依赖 */
function parseRSSWithDOMParser(xml: string): { title: string, items: FeedItem[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError)
    throw new Error('XML 解析错误')

  const root = doc.documentElement

  // Atom feed
  if (root.localName === 'feed' || root.tagName === 'feed') {
    const title = getText(getEl(root, 'title'))
    const entries = root.querySelectorAll('entry')
    const items: FeedItem[] = Array.from(entries).map((entry) => {
      const linkEl = entry.querySelector('link[href]')
      const contentEl = getEl(entry, 'content') || getEl(entry, 'summary')
      const authorEl = entry.querySelector('author name') || getEl(entry, 'author')
      return {
        title: getText(getEl(entry, 'title')),
        link: linkEl?.getAttribute('href') || getText(getEl(entry, 'link')),
        content: getText(contentEl),
        contentSnippet: getText(getEl(entry, 'summary'))?.replace(/<[^>]*>/g, '').slice(0, 200),
        author: getText(authorEl),
        pubDate: getText(getEl(entry, 'published')) || getText(getEl(entry, 'updated')),
        guid: getText(getEl(entry, 'id')),
      }
    })
    return { title, items }
  }

  // RSS 2.0 / RSS 1.0
  const channel = getEl(root, 'channel') || root
  const title = getText(getEl(channel, 'title'))
  const itemEls = channel.querySelectorAll('item')
  const items: FeedItem[] = Array.from(itemEls).map((item) => {
    // content:encoded 不在标准 querySelectorAll 范围内，用迭代查找
    let encodedContent = ''
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if ((child.localName === 'encoded' && child.namespaceURI?.includes('content')) || child.tagName === 'content:encoded') {
        encodedContent = getText(child)
        break
      }
    }
    const description = getText(getEl(item, 'description'))
    const content = cleanShortcodes(encodedContent || description)
    const encEl = getEl(item, 'enclosure')
    let mediaContent: FeedItem['media:content']
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if (child.localName === 'content' && child.namespaceURI?.includes('medi')) {
        mediaContent = {
          url: child.getAttribute('url') || undefined,
          type: child.getAttribute('type') || undefined,
          medium: child.getAttribute('medium') || undefined,
          width: child.getAttribute('width') || undefined,
          height: child.getAttribute('height') || undefined,
        }
        break
      }
    }
    let mediaThumbnail: FeedItem['media:thumbnail']
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if (child.localName === 'thumbnail' && child.namespaceURI?.includes('medi')) {
        mediaThumbnail = { url: child.getAttribute('url') || undefined }
        break
      }
    }
    return {
      'title': getText(getEl(item, 'title')),
      'link': getText(getEl(item, 'link')),
      content,
      'contentSnippet': description?.replace(/<[^>]*>/g, '').slice(0, 200),
      'creator': getText(getEl(item, 'dc\\:creator')) || getText(getEl(item, 'author')),
      'pubDate': getText(getEl(item, 'pubDate')) || getText(getEl(item, 'date')),
      'guid': getText(getEl(item, 'guid')),
      'enclosure': encEl
        ? {
            url: encEl.getAttribute('url') || undefined,
            type: encEl.getAttribute('type') || undefined,
            length: encEl.getAttribute('length') || undefined,
          }
        : undefined,
      'media:content': mediaContent,
      'media:thumbnail': mediaThumbnail,
    }
  })
  return { title, items }
}

async function fetchFeed(url: string): Promise<{ title: string, items: FeedItem[] }> {
  const res = await fetchViaServer(url)
  const xml = await res.text()
  return parseRSSWithDOMParser(xml)
}

/** 探测 URL 是否为 RSS 源 */
export async function probeRSS(url: string): Promise<{ isRSS: boolean, title?: string, itemCount?: number, view?: number }> {
  // rsshub:// 协议 → 自建 RSSHub 时直接探测，否则走 Folo API
  if (url.startsWith('rsshub://')) {
    if (_rsshubBaseUrl) {
      const fetchUrl = `${_rsshubBaseUrl}/${url.slice('rsshub://'.length)}`
      try {
        const result = await fetchFeedViaProxy(fetchUrl)
        if (result.articles.length > 0)
          return { isRSS: true, title: result.feedTitle, itemCount: result.articles.length }
      }
      catch { /* 降级到 Folo */ }
    }
    return probeFoloRSSHub(url)
  }

  // 优先走服务端 RSS 代理（无 CORS 限制，支持编码检测）
  try {
    const result = await fetchFeedViaProxy(url)
    if (result.articles.length > 0) {
      return { isRSS: true, title: result.feedTitle, itemCount: result.articles.length }
    }
    return { isRSS: false }
  }
  catch {
    // 代理失败时降级为浏览器端解析
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
}

// ── HTML 采集 ──────────────────────────────────────────

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
    // CSS 采集只提取标题和链接，不存全文
    // 用户点击文章后由 ArticleReader 通过 fetchFullText 懒加载
    const content = ''
    const summary = summaryEl?.textContent?.trim() || ''
    const author = authorEl?.textContent?.trim() || ''
    const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || ''
    const publishedAt = dateStr ? new Date(dateStr).getTime() || Date.now() - i * 60000 : Date.now() - i * 60000

    articles.push({
      id: `col-${sourceId}-${link || title.replace(/[^\w\u4E00-\u9FFF]/g, '').slice(0, 40) || hashContent(title + dateStr)}`,
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
      media: [],
      attachments: [],
    })
  })

  return articles
}

/** 预览 CSS 选择器采集结果（不保存） */
export async function previewSelectors(url: string, selectors: CollectorSelectors): Promise<Article[]> {
  const html = await fetchPageHTML(url)
  return parseHTMLWithSelectors(html, selectors, 'preview', '', url)
}

// ── 策略分发 ───────────────────────────────────────────

/** 从 RSS item 提取媒体列表 */
function extractMediaFromItem(item: FeedItem): MediaItem[] {
  const media: MediaItem[] = []
  // enclosure
  if (item.enclosure?.url) {
    const encType = item.enclosure.type || ''
    if (encType.startsWith('image') || encType.startsWith('audio') || encType.startsWith('video')) {
      const type = encType.startsWith('image')
        ? 'photo' as const
        : encType.startsWith('video')
          ? 'video' as const
          : 'audio' as const
      media.push({
        url: item.enclosure.url,
        type,
        mimeType: encType || undefined,
        durationInSeconds: item.enclosure.length ? Number(item.enclosure.length) : undefined,
      })
    }
  }
  // media:content
  const mc = item['media:content']
  if (mc?.url && typeof mc.url === 'string') {
    const medium = mc.medium || mc.type || ''
    const type = medium.startsWith('image') || medium === 'photo'
      ? 'photo' as const
      : medium.startsWith('video')
        ? 'video' as const
        : medium.startsWith('audio')
          ? 'audio' as const
          : 'photo' as const
    media.push({
      url: mc.url,
      type,
      width: mc.width ? Number(mc.width) : undefined,
      height: mc.height ? Number(mc.height) : undefined,
      mimeType: mc.type || undefined,
    })
  }
  // media:thumbnail 作为 previewImageUrl
  const mt = item['media:thumbnail']
  if (mt?.url && typeof mt.url === 'string' && media.length > 0) {
    media[0].previewImageUrl = mt.url
  }
  return media
}

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
    media: Array<{ url: string, type: string, previewImageUrl?: string, mimeType?: string, width?: number, height?: number }>
  }
  let items: ProxyArticle[] = []
  let srcTitle = source.title

  // 如果配置了 RSSHub 路由路径，优先使用 RSSHub
  const rsshubBase = _rsshubBaseUrl || 'https://rsshub.app'
  const fetchUrl = source.rsshubPath
    ? rsshubBase + (source.rsshubPath.startsWith('/') ? '' : '/') + source.rsshubPath
    : source.url

  try {
    const result = await fetchFeedViaProxy(fetchUrl)
    items = result.articles
    if (result.feedTitle)
      srcTitle = result.feedTitle
  }
  catch (proxyErr) {
    // 代理失败时降级为浏览器端 RSS 解析（走 CORS fallback 链）
    console.warn(`[RSS] 服务端代理失败，降级为浏览器端解析 ${source.title}:`, proxyErr)
    try {
      const feed = await fetchFeed(source.url)
      srcTitle = feed.title || source.title
      const mapItem = (item: FeedItem, _i: number) => ({
        id: `art-${source.id}-${item.guid || item.link || hashContent(item.title || `${item.pubDate || ''}`)}`,
        sourceId: source.id,
        sourceTitle: srcTitle,
        title: item.title || '无标题',
        link: item.link || '',
        content: cleanShortcodes(item.content || item.contentSnippet || ''),
        summary: item.contentSnippet?.slice(0, 200) || item.content?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
        author: item.creator || item.author || '',
        publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        read: false,
        starred: false,
        media: extractMediaFromItem(item),
        attachments: [],
      })
      return feed.items.map(mapItem)
    }
    catch {
      // 两层都失败，把原始代理错误抛出去（信息更完整）
      throw proxyErr instanceof Error ? proxyErr : new Error(String(proxyErr))
    }
  }

  return items.map(item => ({
    ...item,
    content: cleanShortcodes(item.content),
    summary: cleanShortcodes(item.summary),
    id: `art-${source.id}-${item.id.slice(5)}`,
    sourceId: source.id,
    sourceTitle: srcTitle,
    read: false,
    starred: false,
    attachments: [],
  }))
}

async function fetchCSSSource(source: Source): Promise<Article[]> {
  if (!source.selectors)
    throw new Error(`源 ${source.title} 缺少采集规则`)
  const html = await fetchPageHTML(source.url)
  return parseHTMLWithSelectors(html, source.selectors, source.id, source.title, source.url)
}

const STRATEGIES: Record<string, (source: Source) => Promise<Article[]>> = {
  'rss': fetchRSSSource,
  'css-selector': fetchCSSSource,
  'folo-rsshub': fetchFoloSource,
}

/** Folo analytics.view → 我们的 FeedViewType 映射 */
const FOLO_VIEW_MAP: Record<number, FeedViewType> = {
  0: 0, // Articles
  1: 4, // SocialMedia
  2: 1, // Pictures
  3: 2, // Videos
  4: 3, // Audios
}

/** 获取 rsshub:// 源的文章 */
async function fetchFoloSource(source: Source): Promise<Article[]> {
  // 自建 RSSHub：转换 rsshub:// 为直连 URL，走现有 RSS 代理
  if (_rsshubBaseUrl) {
    const rsshubUrl = source.url.startsWith('rsshub://')
      ? `${_rsshubBaseUrl}/${source.url.slice('rsshub://'.length)}`
      : source.url
    const result = await fetchFeedViaProxy(rsshubUrl)
    return result.articles.map(a => ({
      ...a,
      id: `art-${source.id}-${a.id.replace(/^proxy-/, '').slice(0, 40)}`,
      sourceId: source.id,
      sourceTitle: source.title,
      read: false,
      starred: false,
      attachments: [],
    }))
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

/**
 * 根据源的策略获取文章
 * 注意：fetchRSSSource 内部已有服务端 proxy → 浏览器端 fallback 两级重试
 * 此处只处理最外层超时保护
 */
export async function fetchSourceArticles(source: Source): Promise<Article[]> {
  const handler = STRATEGIES[source.strategy]
  if (!handler)
    throw new Error(`未知的获取策略: ${source.strategy}`)

  const timeoutMs = source.strategy === 'rss' ? 25_000 : 15_000

  const { promise: timeoutPromise, reject } = Promise.withResolvers<never>()
  const timer = window.setTimeout(() => reject(new Error(`获取超时（${timeoutMs}ms）`)), timeoutMs)

  try {
    return await Promise.race([handler(source), timeoutPromise])
  }
  finally {
    clearTimeout(timer)
  }
}

// ── 全文提取 ───────────────────────────────────────────

/** 从文章链接获取完整正文 */
export async function fetchFullText(url: string): Promise<string> {
  const html = await fetchPageHTML(url)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  // 移除所有噪音元素
  const noise = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', '.ad', '.advertisement', '.sidebar', '.comment', '.nav', '.menu', '.header', '.footer', '.sidebar', '.related', '.recommend', '.comment', '.toolbar']
  doc.querySelectorAll(noise.join(',')).forEach(el => el.remove())
  // 尝试正文选择器
  const selectors = [
    'article',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post-body',
    '.article-body',
    '.rich_media_content', // 微信
    '.article-detail',
    '.detail-content',
    '.detail_txt', // 中国法院网
    '.detail-text',
    '.news-content',
    '.news_txt',
    '[class*="article"]',
    '[class*="content"]',
    '[class*="detail"]',
    '.main-content',
    '#main-content',
    '.page-content',
    '.text-content',
  ]
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el && el.textContent && el.textContent.trim().length > 200) {
      return el.innerHTML
    }
  }
  // 回退：取 body 内文本最多的子元素
  let best: Element | null = null
  let maxLen = 0
  for (const el of doc.body?.children || []) {
    const len = el.textContent?.trim().length || 0
    if (len > maxLen) {
      maxLen = len
      best = el
    }
  }
  return best?.innerHTML || doc.body?.innerHTML || ''
}

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

/** 从 HTML 中提取第一张图片 URL */
function firstImageFromHtml(html: string): string | undefined {
  const m = html.match(/<img[^>]+src="([^"]+)"/i)
  return m?.[1]
}

/** 将 Folo API 返回的条目转为我们的 Article 格式 */
function mapFoloEntry(entry: FoloFeedResponse['data']['entries'][0], sourceId: string, sourceTitle: string): Article {
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
  return {
    id: `folo-${sourceId}-${entry.id}`,
    sourceId,
    sourceTitle,
    title: entry.title || '无标题',
    link: entry.url || '',
    content,
    summary,
    author: entry.author || '',
    publishedAt: entry.publishedAt ? new Date(entry.publishedAt).getTime() : Date.now(),
    read: false,
    starred: false,
    media,
    attachments,
  }
}

/** Folo 分页参数 */
const MAX_PAGES = 3
const BATCH_SIZE = 40

/**
 * 通用 Folo entries 分页获取
 * 循环拉取多页，直到没有更多或达到 MAX_PAGES 上限
 */
async function fetchFoloEntriesPaginated(feedId: string, view: number, publishedAfter: string | null = null): Promise<Article[]> {
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

    const batch = json.data.map((item) => {
      const art = mapFoloEntry(item.entries, item.feeds.id, item.feeds.title)
      art.read = !!item.read
      return art
    })

    if (batch.length === 0)
      break

    allArticles.push(...batch)

    // 用最后一条的 publishedAt 作为下一页游标
    cursor = new Date(batch[batch.length - 1].publishedAt).toISOString()

    // 返回少于 limit → 没有更多了
    if (batch.length < BATCH_SIZE)
      break
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
  let articles = entries.map(e => mapFoloEntry(e, feed.id, feed.title))

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
  if (_rsshubBaseUrl) {
    const fetchUrl = `${_rsshubBaseUrl}/${rsshubUrl.slice('rsshub://'.length)}`
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

// ── RSSHub 发现 ────────────────────────────────────────

/** 输入 URL，查询 RSSHub API 获取可用的 RSS 路由 */
export async function discoverRSSHubRoutes(url: string): Promise<Array<{ name: string, path: string }>> {
  try {
    const domain = new URL(url).hostname

    // 优先使用 Netlify Function 代理
    try {
      const fnUrl = `${window.location.origin}/.netlify/functions/rsshub-discover`
      const fnRes = await window.fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
        signal: AbortSignal.timeout(12_000),
      })
      if (fnRes.ok) {
        const data = await fnRes.json() as { ok?: boolean, routes?: Array<{ name: string, path: string }> }
        if (data.ok && Array.isArray(data.routes))
          return data.routes
      }
    }
    catch { /* 回退到直接请求 */ }

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
