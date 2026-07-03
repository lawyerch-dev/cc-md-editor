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
  }>
}

interface FeedResult {
  feedTitle: string
  articles: FeedArticle[]
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
    const guid = extractTag(item, 'guid') || link || `item-${articles.length}`
    const publishedAt = pubDateStr ? new Date(pubDateStr).getTime() || Date.now() : Date.now()

    // enclosure
    const encRe = /<enclosure[^>]*>/g
    const encM = encRe.exec(item)
    let enclosureUrl = ''
    let encType = ''
    if (encM) {
      enclosureUrl = encM[0].match(/url="([^"]+)"/)?.[1] || ''
      encType = encM[0].match(/type="([^"]+)"/)?.[1] || ''
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

    const media: FeedArticle['media'] = []
    if (enclosureUrl && encType) {
      const type = encType.startsWith('image')
        ? 'photo' as const
        : encType.startsWith('video')
          ? 'video' as const
          : encType.startsWith('audio')
            ? 'audio' as const
            : 'photo' as const
      media.push({ url: enclosureUrl, type, mimeType: encType || undefined })
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
    const id = extractTag(entry, 'id') || link || `entry-${articles.length}`
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
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

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
