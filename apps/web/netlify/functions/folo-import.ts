import type { Context } from '@netlify/functions'
import Database from 'better-sqlite3'

interface SourceOutput {
  id: string
  url: string
  title: string
  category: string
  addedAt: number
  refreshInterval: number
  strategy: 'rss'
  view: number
}

interface MediaItem {
  url: string
  type: 'photo' | 'video' | 'audio'
  previewImageUrl?: string
  width?: number
  height?: number
  blurhash?: string
}

interface Attachment {
  url: string
  durationInSeconds?: number
  mimeType?: string
  sizeInBytes?: number
  title?: string
}

interface ArticleOutput {
  id: string
  sourceId: string
  sourceTitle: string
  title: string
  link: string
  content: string
  summary: string
  author: string
  publishedAt: number
  read: boolean
  starred: boolean
  media: MediaItem[]
  attachments: Attachment[]
}

// ── OPML 解析 ─────────────────────────────────────────

const VIEW_MAP: Record<string, number> = {
  Articles: 0,
  Pictures: 1,
  Videos: 2,
  Audios: 3,
  SocialMedia: 4,
}

function extractAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')
  const m = attrs.match(re)
  return m ? m[1] : null
}

function parseOpml(xml: string): Array<{ xmlUrl: string, title: string, view: number, category: string }> {
  const entries: Array<{ xmlUrl: string, title: string, view: number, category: string }> = []

  // Walk all <outline> tags in document order (handles single-line OPML, any line breaks)
  // Use depth tracking so </outline> only pops a group when it closes a depth-1 (group-level) tag,
  // not depth-2+ (feed-level) tags which use non-self-closing <outline>...</outline> form.
  const tagRe = /<\/?outline\s*([^>]*?)\/?\s*>/gi
  const groupStack: string[] = ['Articles']
  let depth = 0

  let match: RegExpExecArray | null
  while ((match = tagRe.exec(xml)) !== null) {
    const full = match[0]
    const attrs = match[1]

    // <\/outline>
    if (full.startsWith('<\/')) {
      // Only pop group when closing a depth-1 tag (group level), not depth-2+ (feed level)
      if (depth === 1 && groupStack.length > 1) groupStack.pop()
      depth--
      continue
    }

    depth++

    const text = extractAttr(attrs, 'text')
    const title = extractAttr(attrs, 'title')
    const xmlUrl = extractAttr(attrs, 'xmlUrl')
    const isSelfClose = full.endsWith('/>')

    if (xmlUrl) {
      // Feed entry
      const category = groupStack[groupStack.length - 1]
      entries.push({
        xmlUrl,
        title: text || title || xmlUrl,
        view: VIEW_MAP[category] ?? 0,
        category,
      })
    }
    else if (text && depth === 1) {
      // Group outline at depth 1
      groupStack.push(text)
    }

    if (isSelfClose) {
      // Self-closing empty group — pop immediately
      if (depth === 1 && text && !xmlUrl && groupStack.length > 1) groupStack.pop()
      depth--
    }
  }

  return entries
}

// ── 规范化 ────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.replace('https://rsshub.app/', 'rsshub://')
}

// ── Handler ──────────────────────────────────────────

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const formData = await req.formData()
    const opmlField = formData.get('opml')
    const dbField = formData.get('db')

    if (!opmlField || typeof opmlField !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing OPML data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!dbField || typeof dbField === 'string') {
      return new Response(JSON.stringify({ error: 'Missing follow.db file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const dbFile = dbField as unknown as Blob
    const dbBuffer = Buffer.from(await dbFile.arrayBuffer())

    // 1. 解析 OPML
    const opmlEntries = parseOpml(opmlField as string)

    // 2. 打开 SQLite
    const db = new Database(dbBuffer)

    // 3. 读取 feeds
    const feedRows = db.prepare('SELECT id, url, title, site_url FROM feeds').all() as Array<{
      id: string
      url: string
      title: string | null
      site_url: string | null
    }>

    // 4. 匹配 OPML → feed
    const matchedFeeds: Array<{ source: Omit<SourceOutput, 'id' | 'addedAt'>, feedId: string }> = []
    let skippedFeeds = 0

    for (const entry of opmlEntries) {
      const normUrl = normalizeUrl(entry.xmlUrl)
      let matched = feedRows.find(f => f.url === entry.xmlUrl || f.url === normUrl)
      if (!matched) {
        matched = feedRows.find(f =>
          f.site_url && f.site_url.replace(/\/$/, '') === entry.xmlUrl.replace(/\/$/, ''),
        )
      }
      if (!matched) {
        matched = feedRows.find(f =>
          f.title && f.title.trim() === entry.title.trim(),
        )
      }

      if (!matched) {
        skippedFeeds++
        continue
      }

      matchedFeeds.push({
        source: {
          url: entry.xmlUrl,
          title: entry.title || matched.title || entry.xmlUrl,
          category: entry.category || 'Articles',
          refreshInterval: 30,
          strategy: 'rss' as const,
          view: entry.view,
        },
        feedId: matched.id,
      })
    }

    // 5. 构建 sources
    const srcIdByFeed: Record<string, string> = {}
    const srcTitleByFeed: Record<string, string> = {}
    const sources: SourceOutput[] = matchedFeeds.map((m, i) => {
      const id = `import-folo-${m.feedId.slice(0, 12)}`
      srcIdByFeed[m.feedId] = id
      srcTitleByFeed[m.feedId] = m.source.title
      return {
        ...m.source,
        id,
        addedAt: Date.now(),
      }
    })

    // 6. 读取 entries
    const articles: ArticleOutput[] = []
    if (matchedFeeds.length > 0) {
      const feedIds = matchedFeeds.map(m => m.feedId)
      const placeholders = feedIds.map(() => '?').join(',')
      const entryStmt = db.prepare(
        `SELECT id, title, url, content, description, guid, author,
         published_at, media, attachments, extra, feed_id, read
         FROM entries WHERE feed_id IN (${placeholders})
         ORDER BY published_at DESC`,
      )
      const entryRows = entryStmt.all(...feedIds) as Array<Record<string, unknown>>

      for (const row of entryRows) {
        const feedId = String(row.feed_id ?? '')
        const srcId = srcIdByFeed[feedId]
        if (!srcId) continue

        let mediaItems: MediaItem[] = []
        try {
          const raw = row.media
          if (raw && typeof raw === 'string') {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              mediaItems = parsed.map((m: Record<string, unknown>) => ({
                url: String(m.url ?? ''),
                type: (m.type === 'video' ? 'video' : m.type === 'audio' ? 'audio' : 'photo') as MediaItem['type'],
                previewImageUrl: m.preview_image_url ? String(m.preview_image_url) : undefined,
                width: m.width ? Number(m.width) : undefined,
                height: m.height ? Number(m.height) : undefined,
                blurhash: m.blurhash ? String(m.blurhash) : undefined,
              }))
            }
          }
        }
        catch { /* skip invalid media */ }

        let attachments: Attachment[] = []
        try {
          const raw = row.attachments
          if (raw && typeof raw === 'string') {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              attachments = parsed.map((a: Record<string, unknown>) => ({
                url: String(a.url ?? ''),
                durationInSeconds: a.duration_in_seconds ? Number(a.duration_in_seconds) : a.durationInSeconds ? Number(a.durationInSeconds) : undefined,
                mimeType: a.mime_type ? String(a.mime_type) : a.mimeType ? String(a.mimeType) : undefined,
                sizeInBytes: a.size_in_bytes ? Number(a.size_in_bytes) : a.sizeInBytes ? Number(a.sizeInBytes) : undefined,
                title: a.title ? String(a.title) : undefined,
              }))
            }
          }
        }
        catch { /* skip invalid attachments */ }

        let pubTs = Number(row.published_at ?? 0)
        if (pubTs > 1e15) pubTs = Math.floor(pubTs / 1000000)
        else if (pubTs < 1e10 && pubTs > 0) pubTs *= 1000

        articles.push({
          id: `art-${row.id}`,
          sourceId: srcId,
          sourceTitle: srcTitleByFeed[feedId] || '',
          title: String(row.title ?? ''),
          link: String(row.url ?? ''),
          content: String(row.content ?? ''),
          summary: String(row.description ?? '').slice(0, 200),
          author: String(row.author ?? ''),
          publishedAt: pubTs,
          read: row.read === 1 || row.read === true || row.read === '1',
          starred: false,
          media: mediaItems,
          attachments,
        })
      }
    }

    db.close()

    return new Response(JSON.stringify({
      sources,
      articles,
      stats: {
        sources: sources.length,
        articles: articles.length,
        skippedFeeds,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
