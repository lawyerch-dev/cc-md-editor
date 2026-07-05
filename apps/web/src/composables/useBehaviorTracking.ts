/**
 * 行为数据追踪 composable
 * 自动采集用户的阅读、批注、产出等行为事件，存入 localStorage
 * 保留最近 90 天数据，超出自动清理
 */

interface BehaviorEvent {
  type: 'read_start' | 'read_end' | 'annotate' | 'favorite' | 'skip' | 'extract_idea' | 'write'
  timestamp: number
  articleId?: string
  sourceId?: string
  contentType?: string
  duration?: number
  metadata?: Record<string, unknown>
}

const STORAGE_KEY = 'reading_behavior_events'
const RETENTION_DAYS = 90

function loadEvents(): BehaviorEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw)
      return JSON.parse(raw)
  }
  catch { /* ignore */ }
  return []
}

function saveEvents(events: BehaviorEvent[]) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const filtered = events.filter(e => e.timestamp > cutoff)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

/** 记录一个行为事件 */
export function trackEvent(event: Omit<BehaviorEvent, 'timestamp'>) {
  const events = loadEvents()
  events.push({ ...event, timestamp: Date.now() })
  saveEvents(events)
}

/** 获取所有行为事件（最近 N 天） */
export function getEvents(days?: number): BehaviorEvent[] {
  const events = loadEvents()
  if (!days)
    return events
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return events.filter(e => e.timestamp > cutoff)
}

// ── 阅读时长追踪 ────────────────────────────────

let readStartTime: number | null = null
let readArticleId: string | null = null
let readSourceId: string | null = null
let readContentType: string | null = null

/** 开始阅读一篇文章 */
export function startReading(articleId: string, sourceId?: string, contentType?: string) {
  // 如果之前在读另一篇，先结束
  if (readStartTime && readArticleId) {
    endReading()
  }
  readStartTime = Date.now()
  readArticleId = articleId
  readSourceId = sourceId || null
  readContentType = contentType || 'article'
  trackEvent({
    type: 'read_start',
    articleId,
    sourceId: sourceId || undefined,
    contentType,
  })
}

/** 结束阅读当前文章 */
export function endReading() {
  if (!readStartTime || !readArticleId)
    return
  const duration = Math.round((Date.now() - readStartTime) / 1000)
  trackEvent({
    type: 'read_end',
    articleId: readArticleId,
    sourceId: readSourceId || undefined,
    contentType: readContentType || undefined,
    duration,
  })
  readStartTime = null
  readArticleId = null
  readSourceId = null
  readContentType = null
}

// ── 便捷方法 ────────────────────────────────────

/** 记录批注事件 */
export function trackAnnotate(articleId: string) {
  trackEvent({ type: 'annotate', articleId })
}

/** 记录收藏事件 */
export function trackFavorite(articleId: string) {
  trackEvent({ type: 'favorite', articleId })
}

/** 记录提炼想法事件 */
export function trackExtractIdea(articleId: string) {
  trackEvent({ type: 'extract_idea', articleId })
}

/** 记录跳过事件（快速滑过未点击） */
export function trackSkip(articleId: string, sourceId?: string) {
  trackEvent({ type: 'skip', articleId, sourceId })
}

/** 记录写作事件 */
export function trackWrite() {
  trackEvent({ type: 'write' })
}
