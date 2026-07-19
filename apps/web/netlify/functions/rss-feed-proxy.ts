import type { Context } from '@netlify/functions'

// ── 服务端 RSS/Atom 解析器（零依赖）────────────────────

interface FeedArticle {
  id: string
  title: string
  link: string
  content: string
  summary: string
  author: string
  publishedAt: number
  media: Array<{
    url: string
    type: 'photo' | 'video' | 'audio'
    previewImageUrl?: string
    mimeType?: string
    width?: number
    height?: number
    durationInSeconds?: number
  }>
}

interface FeedResult {
  feedTitle: string
  articles: FeedArticle[]
}

/** 基于内容的简易哈希，用于无 guid 时生成稳定 ID */
function hashContent(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return `h${(h >>> 0).toString(36)}`
}

/** 提取标签内的文本，处理 CDATA */
function extractTag(xml: string, tagName: string): string {
  // 同时匹配带 namespace 和不带 namespace 的标签，处理 CDATA
  const patterns = [
    new RegExp(`<${tagName}(?:\\s[^>]*)?><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`),
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`),
  ]
  for (const re of patterns) {
    const m = xml.match(re)
    if (m)
      return m[1].trim()
  }
  return ''
}

/** 提取带 namespace 的 content:encoded */
function extractContentEncoded(xml: string): string {
  // content:encoded 可能出现在各种 namespace 形式下
  const patterns = [
    /<content:encoded[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/,
    /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/,
  ]
  for (const re of patterns) {
    const m = xml.match(re)
    if (m)
      return m[1].trim()
  }
  return ''
}

/** 解析 RSS 2.0 */
function parseRSS(xml: string): FeedResult {
  const feedTitle = extractTag(xml, 'title') || ''
  const articles: FeedArticle[] = []

  // 提取所有 <item> 块
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  for (m = itemRe.exec(xml); m !== null; m = itemRe.exec(xml)) {
    const item = m[1]
    const title = extractTag(item, 'title') || ''
    const link = extractTag(item, 'link') || ''
    const description = extractTag(item, 'description') || ''
    const encoded = extractContentEncoded(item)
    const content = encoded || description
    const summary = description.replace(/<[^>]*>/g, '').slice(0, 200)
    const author = extractTag(item, 'dc\\:creator') || extractTag(item, 'author') || ''
    const pubDateStr = extractTag(item, 'pubDate') || extractTag(item, 'date') || ''
    const rawGuid = extractTag(item, 'guid') || link
    const guid = rawGuid || hashContent(title + pubDateStr)
    const publishedAt = pubDateStr ? new Date(pubDateStr).getTime() || Date.now() : Date.now()

    // enclosure
    const encRe = /<enclosure[^>]*>/g
    const encM = encRe.exec(item)
    let enclosureUrl = ''
    let encType = ''
    if (encM) {
      enclosureUrl = encM[0].match(/url="([^"]+)"/)?.[1] || ''
      encType = encM[0].match(/type="([^"]+)"/)?.[1] || ''
      // 如果没有 type，根据 URL 扩展名推断
      if (enclosureUrl && !encType) {
        if (/\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(enclosureUrl))
          encType = 'audio/mpeg'
        else if (/\.(?:mp4|webm|mov)(?:\?|$)/i.test(enclosureUrl))
          encType = 'video/mp4'
        else if (/\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i.test(enclosureUrl))
          encType = 'image/jpeg'
      }
    }

    // media:content
    let mediaUrl = ''
    let mediaType = ''
    let mediaWidth: number | undefined
    let mediaHeight: number | undefined
    const mcRe = /<media:content[^>]*>/g
    const mcM = mcRe.exec(item)
    if (mcM) {
      mediaUrl = mcM[0].match(/url="([^"]+)"/)?.[1] || ''
      mediaType = mcM[0].match(/type="([^"]+)"/)?.[1] || mcM[0].match(/medium="([^"]+)"/)?.[1] || ''
      const w = mcM[0].match(/width="(\d+)"/)?.[1]
      const h = mcM[0].match(/height="(\d+)"/)?.[1]
      if (w)
        mediaWidth = Number(w)
      if (h)
        mediaHeight = Number(h)
    }

    // media:thumbnail
    let thumbUrl = ''
    const mtRe = /<media:thumbnail[^>]*>/g
    const mtM = mtRe.exec(item)
    if (mtM) {
      thumbUrl = mtM[0].match(/url="([^"]+)"/)?.[1] || ''
    }

    // itunes:duration（播客时长，格式可能是 HH:MM:SS, MM:SS 或秒数）
    const itunesDurationStr = extractTag(item, 'itunes\:duration') || ''
    let durationInSeconds: number | undefined
    if (itunesDurationStr) {
      const parts = itunesDurationStr.split(':').map(Number)
      if (parts.length === 3)
        durationInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
      else if (parts.length === 2)
        durationInSeconds = parts[0] * 60 + parts[1]
      else if (!Number.isNaN(Number(itunesDurationStr)))
        durationInSeconds = Number(itunesDurationStr)
    }

    // itunes:image（播客封面）
    const itunesImage = extractTag(item, 'itunes\:image') || ''
    const coverUrl = itunesImage || thumbUrl

    const media: FeedArticle['media'] = []
    if (enclosureUrl && encType) {
      const type = encType.startsWith('image')
        ? 'photo' as const
        : encType.startsWith('video')
          ? 'video' as const
          : encType.startsWith('audio')
            ? 'audio' as const
            : 'photo' as const
      const entry: FeedArticle['media'][number] = { url: enclosureUrl, type, mimeType: encType }
      if (type === 'audio' && durationInSeconds)
        entry.durationInSeconds = durationInSeconds
      if (type === 'audio' && coverUrl)
        entry.previewImageUrl = coverUrl
      media.push(entry)
    }
    if (mediaUrl) {
      const type = mediaType.startsWith('image') || mediaType === 'photo'
        ? 'photo' as const
        : mediaType.startsWith('video')
          ? 'video' as const
          : mediaType.startsWith('audio')
            ? 'audio' as const
            : 'photo' as const
      const entry: FeedArticle['media'][number] = { url: mediaUrl, type, mimeType: mediaType || undefined }
      if (mediaWidth)
        entry.width = mediaWidth
      if (mediaHeight)
        entry.height = mediaHeight
      if (thumbUrl)
        entry.previewImageUrl = thumbUrl
      if (!media.length || !media.some(x => x.url === mediaUrl)) {
        media.push(entry)
      }
    }

    articles.push({
      id: `proxy-${guid.replace(/[^\w-]/g, '').slice(0, 64) || String(articles.length)}`,
      title: title || '无标题',
      link,
      content,
      summary,
      author,
      publishedAt,
      media,
    })
  }

  return { feedTitle, articles }
}

/** 解析 Atom feed */
function parseAtom(xml: string): FeedResult {
  const feedTitle = extractTag(xml, 'title') || ''
  const articles: FeedArticle[] = []

  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  for (m = entryRe.exec(xml); m !== null; m = entryRe.exec(xml)) {
    const entry = m[1]
    const title = extractTag(entry, 'title') || ''

    // Atom link 在属性中
    let link = ''
    const linkRe = /<link[^>]*href="([^"]+)"[^>]*>/g
    const links: Array<{ href: string, rel?: string, type?: string }> = []
    for (let lm = linkRe.exec(entry); lm !== null; lm = linkRe.exec(entry)) {
      links.push({
        href: lm[1],
        rel: lm[0].match(/rel="([^"]+)"/)?.[1] || undefined,
        type: lm[0].match(/type="([^"]+)"/)?.[1] || undefined,
      })
    }
    // alternate > 第一个没有 rel 的 > 第一个 href
    const alt = links.find(l => l.rel === 'alternate')
    if (alt)
      link = alt.href
    else if (links.length > 0)
      link = links[0].href

    const content = extractTag(entry, 'content') || extractTag(entry, 'summary') || ''
    const summary = extractTag(entry, 'summary')?.replace(/<[^>]*>/g, '').slice(0, 200) || ''

    // Atom author: <author><name>...</name></author>
    let author = ''
    const authorRe = /<author[^>]*>([\s\S]*?)<\/author>/
    const am = entry.match(authorRe)
    if (am) {
      author = extractTag(am[1], 'name') || extractTag(am[1], 'email') || ''
    }
    const published = extractTag(entry, 'published') || extractTag(entry, 'updated') || ''
    const rawId = extractTag(entry, 'id') || link
    const id = rawId || hashContent(title + published)
    const publishedAt = published ? new Date(published).getTime() || Date.now() : Date.now()

    articles.push({
      id: `proxy-${id.replace(/[^\w-]/g, '').slice(0, 64) || String(articles.length)}`,
      title: title || '无标题',
      link,
      content,
      summary,
      author,
      publishedAt,
      media: [],
    })
  }

  return { feedTitle, articles }
}

/** 主入口 */
function parseFeed(xml: string): FeedResult {
  const isAtom = /<feed[> ]/.test(xml) && !/<rss[> ]/.test(xml)
  return isAtom ? parseAtom(xml) : parseRSS(xml)
}

// ── 编码检测 ───────────────────────────────────────────

function detectEncoding(buffer: ArrayBuffer, contentType: string | null): string {
  if (contentType) {
    const match = contentType.match(/charset=([\w-]+)/i)
    if (match)
      return match[1]
  }
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 500))
  const xmlMatch = head.match(/encoding=(["'])([\w-]+)\1/i)
  if (xmlMatch)
    return xmlMatch[2]
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

const MAX_RETRIES = 2
const BASE_DELAY_MS = 600

/**
 * Sleep helper — no `new Promise` executor form per project convention.
 */
function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

/** 是否属于"值得重试"的瞬断错误 */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error))
    return false
  const msg = err.message
  return msg.includes('Client network socket')
    || msg.includes('ECONNRESET')
    || msg.includes('ENETUNREACH')
    || msg.includes('socket hang up')
    || msg.includes('network')
    || msg.includes('TLS')
    || msg.includes('econnrefused')
    || msg.includes('etimedout')
    || err.name === 'TimeoutError'
}

/**
 * Retry-able fetch for RSS feeds.
 * Transient and timeout errors get an exponential-backoff retry.
 */
async function fetchFeed(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      })
      // 非 5xx 直接返回（4xx 是客户端问题，重试无意义）
      if (res.status < 500)
        return res
      // 5xx：还有重试次数就等一等
      if (attempt < MAX_RETRIES)
        await sleep(BASE_DELAY_MS * attempt + Math.random() * 400)
    }
    catch (err) {
      // 非重试性错误或已达最大次数 → 抛出去
      if (attempt >= MAX_RETRIES || !isRetryableError(err))
        throw err
      await sleep(BASE_DELAY_MS * attempt + Math.random() * 400)
    }
  }
  // 全部重试用完，最后一次 fetch 的结果（走到这里说明所有重试都 5xx）
  throw new Error('上游服务器持续返回 5xx')
}

// ── Handler ────────────────────────────────────────────

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
    const res = await fetchFeed(url)

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `上游返回 ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }

    // 编码检测 + 解码
    const buffer = await res.arrayBuffer()
    const encoding = detectEncoding(buffer, res.headers.get('content-type'))
    const xml = new TextDecoder(encoding, { fatal: false }).decode(buffer)

    // 服务端解析
    const result = parseFeed(xml)

    return Response.json({ ok: true, ...result })
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? '获取超时（10s）'
      : err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
