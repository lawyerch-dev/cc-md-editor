import type { Article, Source } from './types'
import initSqlJs from 'sql.js'
import { saveArticles, saveLists, saveSources } from './persistence'
import { FeedViewType } from './types'

// ── OPML 解析 ─────────────────────────────────────────

interface OpmlEntry {
  xmlUrl: string
  title: string
  view: FeedViewType
}

/** Follow app 的 view 编号 → 本应用 FeedViewType */
const FOLLOW_VIEW_MAP: Record<number, FeedViewType> = {
  0: FeedViewType.Articles,
  1: FeedViewType.SocialMedia,
  2: FeedViewType.Pictures,
  3: FeedViewType.Videos,
  4: FeedViewType.Audios,
}

/** OPML 分组名 → FeedViewType（用于纯 OPML 导入） */
const GROUP_VIEW_MAP: Record<string, FeedViewType> = {
  Articles: FeedViewType.Articles,
  SocialMedia: FeedViewType.SocialMedia,
  Pictures: FeedViewType.Pictures,
  Videos: FeedViewType.Videos,
  Audios: FeedViewType.Audios,
}

function parseOpml(xml: string): OpmlEntry[] {
  // text/xml 避免 HTML 解析器把 OPML 的 <head> 当文档头处理
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const body = doc.documentElement.querySelector('body')
  if (!body)
    throw new Error('OPML 格式错误：缺少 <body>')

  const entries: OpmlEntry[] = []

  // 遍历 body 的子元素（分组）
  let groupEl = body.firstElementChild
  while (groupEl) {
    const groupName = groupEl.getAttribute('text') || ''
    const view = GROUP_VIEW_MAP[groupName] ?? FeedViewType.Articles

    // 遍历分组内的子元素（源条目）
    let childEl = groupEl.firstElementChild
    while (childEl) {
      const xmlUrl = childEl.getAttribute('xmlUrl') || ''
      if (xmlUrl) {
        const title = childEl.getAttribute('text') || childEl.getAttribute('title') || xmlUrl
        entries.push({ xmlUrl, title, view, category: groupName })
      }
      childEl = childEl.nextElementSibling
    }
    groupEl = groupEl.nextElementSibling
  }

  // 扁平 OPML（无分组）
  if (entries.length === 0) {
    let el = body.firstElementChild
    while (el) {
      const xmlUrl = el.getAttribute('xmlUrl') || ''
      if (xmlUrl) {
        entries.push({
          xmlUrl,
          title: el.getAttribute('text') || el.getAttribute('title') || xmlUrl,
          view: FeedViewType.Articles,
          category: 'Articles',
        })
      }
      el = el.nextElementSibling
    }
  }

  return entries
}

// ── OPML 导入（仅数据源）────────────────────────────

export interface OpmlImportResult {
  sources: Source[]
  skipped: Array<{ title: string, reason: string }>
}

export function importFromOpml(xml: string): OpmlImportResult {
  const entries = parseOpml(xml)
  const sources: Source[] = []
  const skipped: Array<{ title: string, reason: string }> = []

  for (const entry of entries) {
    if (!entry.xmlUrl) {
      skipped.push({ title: entry.title, reason: '缺少 RSS 地址' })
      continue
    }
    sources.push({
      id: `import-opml-${Date.now()}-${sources.length}`,
      url: entry.xmlUrl,
      title: entry.title || entry.xmlUrl,
      addedAt: Date.now(),
      refreshInterval: 30,
      strategy: 'rss',
      view: entry.view,
    })
  }

  return { sources, skipped }
}

// ── 客户端 SQLite 解析（follow.db）───────────────────

interface FollowFeedRow {
  id: string
  url: string
  title: string | null
  site_url: string | null
  description: string | null
}

interface FollowEntryRow {
  id: string
  title: string | null
  url: string | null
  content: string | null
  description: string | null
  author: string | null
  published_at: number
  media: string | null
  attachments: string | null
  feed_id: string | null
  read: number | null
}

interface FollowSubscriptionRow {
  feed_id: string | null
  view: number
  category: string | null
  title: string | null
}

/** 将 rsshub:// 转为 https://rsshub.app/（与 OPML 一致） */
function denormalizeRsshub(url: string): string {
  if (url.startsWith('rsshub://'))
    return `https://rsshub.app/${url.slice('rsshub://'.length)}`
  return url
}

function parseMediaJson(raw: string | null): Array<{ url: string, type: 'photo' | 'video' | 'audio', width?: number, height?: number }> {
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed.map((m: Record<string, unknown>) => ({
      url: String(m.url ?? ''),
      type: m.type === 'video' ? 'video' as const : m.type === 'audio' ? 'audio' as const : 'photo' as const,
      width: m.width ? Number(m.width) : undefined,
      height: m.height ? Number(m.height) : undefined,
    }))
  }
  catch { return [] }
}

function parseAttachmentsJson(raw: string | null): Array<{ url: string, mimeType?: string, title?: string }> {
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed.map((a: Record<string, unknown>) => ({
      url: String(a.url ?? ''),
      mimeType: a.mime_type ? String(a.mime_type) : a.mimeType ? String(a.mimeType) : undefined,
      title: a.title ? String(a.title) : undefined,
    }))
  }
  catch { return [] }
}

export interface FoloImportResult {
  sources: Source[]
  articles: Article[]
  stats: {
    sources: number
    articles: number
    skippedFeeds: number
  }
}

/** 在浏览器中直接解析 follow.db，结合 OPML 构建完整导入数据 */
export async function importFoloClientSide(
  opmlXml: string,
  dbFile: File,
): Promise<FoloImportResult> {
  const SQL = await initSqlJs({ locateFile: (file: string) => `https://sql.js.org/dist/${file}` })
  const buf = await dbFile.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(buf))

  // 1. 读取 subscriptions（订阅列表，决定导入哪些源）
  const subStmt = db.prepare(`SELECT feed_id, view, category, title FROM subscriptions WHERE type = 'feed'`)
  const subscriptions: FollowSubscriptionRow[] = []
  while (subStmt.step()) {
    const row = subStmt.getAsObject()
    subscriptions.push({
      feed_id: row.feed_id as string | null,
      view: Number(row.view ?? 0),
      category: row.category as string | null,
      title: row.title as string | null,
    })
  }
  subStmt.free()

  if (subscriptions.length === 0) {
    db.close()
    throw new Error('数据库中没有找到订阅')
  }

  // 2. 读取所有 feeds 构建查找表
  const feedStmt = db.prepare(`SELECT id, url, title, site_url, description FROM feeds`)
  const feedsById = new Map<string, FollowFeedRow>()
  const feedsByUrl = new Map<string, FollowFeedRow>()
  while (feedStmt.step()) {
    const row = feedStmt.getAsObject()
    const feed: FollowFeedRow = {
      id: String(row.id ?? ''),
      url: String(row.url ?? ''),
      title: row.title as string | null,
      site_url: row.site_url as string | null,
      description: row.description as string | null,
    }
    feedsById.set(feed.id, feed)
    // 索引原始 URL 和反规范化 URL
    feedsByUrl.set(feed.url, feed)
    feedsByUrl.set(denormalizeRsshub(feed.url), feed)
  }
  feedStmt.free()

  // 3. 解析 OPML 用于 URL 回退匹配
  const opmlEntries = parseOpml(opmlXml)
  const opmlByUrl = new Map<string, OpmlEntry>()
  for (const e of opmlEntries) opmlByUrl.set(e.xmlUrl, e)

  // 4. 构建 sources
  const srcIdByFeedId = new Map<string, string>()
  const srcTitleByFeedId = new Map<string, string>()
  const sources: Source[] = []
  const matchedFeedIds = new Set<string>()

  for (const sub of subscriptions) {
    const feedId = sub.feed_id
    if (!feedId)
      continue

    const feed = feedsById.get(feedId)
    const feedUrl = feed ? denormalizeRsshub(feed.url) : ''
    const opmlMatch = feedUrl ? opmlByUrl.get(feedUrl) : undefined

    const title = sub.title || feed?.title || feedUrl || feedId
    const view = FOLLOW_VIEW_MAP[sub.view] ?? opmlMatch?.view ?? FeedViewType.Articles
    const url = feedUrl || feed?.url || ''

    const srcId = `import-folo-${feedId.slice(0, 16)}`
    srcIdByFeedId.set(feedId, srcId)
    srcTitleByFeedId.set(feedId, title)
    matchedFeedIds.add(feedId)

    sources.push({
      id: srcId,
      url,
      title,
      addedAt: Date.now(),
      refreshInterval: 30,
      strategy: 'rss',
      view,
      description: feed?.description ?? undefined,
    })
  }

  // 5. 读取已订阅源的 entries
  const articles: Article[] = []
  if (matchedFeedIds.size > 0) {
    const feedIdList = [...matchedFeedIds]
    const placeholders = feedIdList.map(() => '?').join(',')
    const entryStmt = db.prepare(
      `SELECT id, title, url, content, description, author,
       published_at, media, attachments, feed_id, read
       FROM entries WHERE feed_id IN (${placeholders})
       ORDER BY published_at DESC`,
    )
    entryStmt.bind(feedIdList as unknown as string[])

    while (entryStmt.step()) {
      const row = entryStmt.getAsObject() as unknown as FollowEntryRow
      const feedId = row.feed_id ?? ''
      const srcId = srcIdByFeedId.get(feedId)
      if (!srcId)
        continue

      let pubTs = Number(row.published_at ?? 0)
      if (pubTs > 1e15)
        pubTs = Math.floor(pubTs / 1000) // µs → ms
      else if (pubTs > 0 && pubTs < 1e12)
        pubTs *= 1000 // s → ms

      articles.push({
        id: `art-${row.id}`,
        sourceId: srcId,
        sourceTitle: srcTitleByFeedId.get(feedId) ?? '',
        title: String(row.title ?? ''),
        link: String(row.url ?? ''),
        content: String(row.content ?? ''),
        summary: String(row.description ?? '').slice(0, 200),
        author: String(row.author ?? ''),
        publishedAt: pubTs,
        read: row.read === 1,
        starred: false,
        media: parseMediaJson(row.media),
        attachments: parseAttachmentsJson(row.attachments),
      })
    }
    entryStmt.free()
  }

  db.close()

  return {
    sources,
    articles,
    stats: {
      sources: sources.length,
      articles: articles.length,
      skippedFeeds: subscriptions.length - matchedFeedIds.size,
    },
  }
}

// ── 写入 storage（localStorage + IndexedDB 双写）────

/**
 * 清空所有现有阅读数据并保存导入数据。
 * 同时写入 localStorage 和 IndexedDB，确保两种持久化后端都可用。
 * 调用方需要自行调用 store.reloadFromStorage() 更新响应式状态。
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname.replace(/\/$/, '')}`.toLowerCase()
  }
  catch {
    return url.toLowerCase().replace(/\/$/, '')
  }
}

export async function applyImport(sources: Source[], articles: Article[]): Promise<void> {
  // 按 URL 去重
  const seen = new Set<string>()
  const deduped = sources.filter((s) => {
    const norm = normalizeUrl(s.url)
    if (seen.has(norm))
      return false
    seen.add(norm)
    return true
  })
  localStorage.removeItem('reading_sources_v4')
  localStorage.removeItem('reading_articles')
  localStorage.removeItem('reading_lists')
  await Promise.all([
    saveSources(deduped),
    saveArticles(articles),
    saveLists([]),
  ])
}
