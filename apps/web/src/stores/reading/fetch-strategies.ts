import type { Article, CollectorSelectors, FeedViewType, MediaItem, Source } from './types'

// ── CORS 代理 ──────────────────────────────────────────

const CORS_PROXIES: Array<(url: string) => string> = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url='

/** 通过 Netlify Function 服务端代理获取资源（无 CORS 限制） */
async function fetchViaNetlifyFunction(url: string): Promise<Response | null> {
  try {
    const fnUrl = `${window.location.origin}/.netlify/functions/rss-fetch`
    const res = await window.fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok)
      return null
    const data = await res.json() as { ok?: boolean, body?: string, contentType?: string, error?: string }
    if (data.ok && typeof data.body === 'string') {
      return new Response(data.body, {
        headers: { 'Content-Type': data.contentType ?? 'text/plain' },
      })
    }
    return null
  }
  catch {
    return null
  }
}

/**
 * 带 CORS 代理回退的 fetch：先尝试直接请求，再并行尝试所有代理（取最快成功的）。
 */
export async function fetchWithProxy(url: string, init?: RequestInit): Promise<Response> {
  // 1) 直接请求（同源或允许 CORS 的资源）
  try {
    const res = await window.fetch(url, { ...init, signal: AbortSignal.timeout(8_000) })
    if (res.ok)
      return res
  }
  catch { /* CORS 拦截或超时，走服务端代理 */ }

  // 2) 优先使用自有服务端代理（更可靠，不受 CORS 限制）
  const serverResult = await fetchViaNetlifyFunction(url)
  if (serverResult)
    return serverResult

  // 3) 兜底：并行尝试免费 CORS 代理
  const abortCtrl = new AbortController()
  const proxyAttempts: Promise<Response>[] = CORS_PROXIES.map(async (buildProxyUrl) => {
    const proxyUrl = buildProxyUrl(url)
    const res = await window.fetch(proxyUrl, { ...init, signal: AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(8_000)]) })
    if (!res.ok)
      throw new Error(`代理响应 ${res.status}`)
    return res
  })

  try {
    const result = await Promise.any(proxyAttempts)
    abortCtrl.abort()
    return result
  }
  catch {
    abortCtrl.abort()
    throw new Error('所有代理均失败')
  }
}

/** 从一批 articles 中检测出最适合的 FeedViewType */
export function detectFeedViewType(articles: Article[]): FeedViewType {
  // 只看前 10 条判断
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
  }
  const total = sample.length || 1
  // 如果 80%+ 条目有音频 → Audios
  if (audioCount / total >= 0.8)
    return 3
  // 如果 60%+ 有视频 → Videos
  if (videoCount / total >= 0.6)
    return 2
  // 如果 60%+ 有图片且平均每篇 >= 2 张 → Pictures
  if (imageCount / total >= 0.6 && imageCount >= 6)
    return 1
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
    const content = encodedContent || description
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
  try {
    const res = await fetchWithProxy(url)
    const xml = await res.text()
    return parseRSSWithDOMParser(xml)
  }
  catch { /* 走 rss2json */ }

  // rss2json 作为最终回退
  const res = await window.fetch(RSS2JSON_API + encodeURIComponent(url), { signal: AbortSignal.timeout(8_000) })
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
          enclosure: item.enclosure && typeof item.enclosure === 'object'
            ? (() => {
                const enc = item.enclosure as Record<string, unknown>
                return {
                  url: typeof enc.url === 'string' ? enc.url : undefined,
                  type: typeof enc.type === 'string' ? enc.type : undefined,
                  length: typeof enc.length === 'string' ? enc.length : undefined,
                }
              })()
            : undefined,
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
      id: `col-${sourceId}-${link || title.replace(/[^\w\u4E00-\u9FFF]/g, '').slice(0, 40) || i}`,
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
        media: [],
        attachments: [],
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
  'cctv-law': fetchCctvLaw,
}

/** 央视网·法治频道 */
async function fetchCctvLaw(): Promise<Article[]> {
  try {
    const res = await fetchWithProxy('https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/law_1.jsonp?cb=law')
    let text = await res.text()
    text = text.replace(/^law\(/, '').replace(/\);?$/, '')
    const data: unknown = JSON.parse(text)
    const dataObj = data && typeof data === 'object' ? data as Record<string, unknown> : null
    const dataInner = dataObj?.data && typeof dataObj.data === 'object' ? dataObj.data as Record<string, unknown> : null
    const items = Array.isArray(dataInner?.list) ? dataInner.list : []
    return items.slice(0, 20).map((item: Record<string, unknown>, i: number) => {
      const url = typeof item.url === 'string' ? item.url : ''
      return {
        id: `cctv-law-${url.match(/ARTI[\w-]+/)?.[0] || i}`,
        sourceId: 'cctv-law',
        sourceTitle: '央视网·法治',
        title: typeof item.title === 'string' ? item.title : '无标题',
        link: url,
        content: '',
        summary: typeof item.brief === 'string' ? item.brief : '',
        author: '',
        publishedAt: typeof item.focus_date === 'string' ? new Date(item.focus_date).getTime() : Date.now(),
        read: false,
        starred: false,
        media: [],
        attachments: [],
      }
    })
  }
  catch (e) {
    console.warn('[CctvLaw] Fetch failed:', e)
    return []
  }
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
  const feed = await fetchFeed(source.url)
  const srcTitle = feed.title || source.title
  return feed.items.map((item, i) => ({
    id: `art-${source.id}-${item.guid || item.link || `item-${i}`}`,
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
    media: extractMediaFromItem(item),
    attachments: [],
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
  // 15秒超时，避免单个源卡住整个队列
  let timer: number
  return Promise.race([
    handler(source),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('获取超时')), 15_000)
    }),
  ]).finally(() => clearTimeout(timer!))
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
    '.news-content',
    '[class*="article"]',
    '[class*="content"]',
    '[class*="detail"]',
    '.main-content',
    '#main-content',
    '.page-content',
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
