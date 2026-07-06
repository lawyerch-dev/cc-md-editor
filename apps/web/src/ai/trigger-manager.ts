import type { Article } from '@/stores/reading/types'
import { watch } from 'vue'
import { buildAIHeaders, resolveEndpointUrl } from '@/composables/useAIFetch'
import { useAIStore } from '@/stores/ai'
import { useAnnotationStore } from '@/stores/annotation'
import { useReadingStore } from '@/stores/reading'
import { saveArticles } from '@/stores/reading/persistence'

// ── Types ──────────────────────────────────────────────

/** Public contract of the AI trigger manager singleton. */
export interface AITriggerManager {
  /** Start watching activeArticleId and scheduling triggers. Returns cleanup. */
  setup: () => () => void
  /** Clear all pending trigger timers (manual cleanup). */
  clearTimers: () => void
}

// ── Constants ──────────────────────────────────────────

const SUMMARY_DELAY = 3_000
const ANNOTATE_DELAY = 5_000
const SUMMARY_MIN_LENGTH = 500
const ANNOTATE_MIN_LENGTH = 1_000
const MAX_CONCURRENT = 2
const COOLDOWN_MS = 30_000

// ── Singleton state (module-level) ─────────────────────

let activeCount = 0

/** Per-article per-capability cooldown timestamps (dynamic runtime keys). */
const cooldownMap = new Map<string, number>()

/** Pending trigger timers keyed by `${articleId}:${capability}` (dynamic). */
const timers = new Map<string, ReturnType<typeof setTimeout>>()

// ── SSE fetch (standalone, no Vue lifecycle dependency) ─

async function fetchSSE(
  url: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
  callbacks: { onDelta: (content: string) => void, onDone?: () => void },
): Promise<void> {
  const controller = new AbortController()

  const res = await window.fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  })

  if (!res.ok || !res.body)
    throw new Error(`AI request failed: ${res.status} ${res.statusText}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        callbacks.onDone?.()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.trim() === 'data: [DONE]')
          continue
        try {
          const json = JSON.parse(line.replace(/^data: /, ''))
          const delta = json.choices?.[0]?.delta || {}
          if (delta.content)
            callbacks.onDelta(delta.content)
        }
        catch {
          // Skip non-JSON lines (SSE comments, etc.)
        }
      }
    }
  }
  finally {
    reader.releaseLock()
  }
}

// ── AI task runners ────────────────────────────────────

async function execSummary(article: Article): Promise<void> {
  const aiStore = useAIStore()

  if (!aiStore.autoSummary)
    return
  if (article.content.length < SUMMARY_MIN_LENGTH)
    return
  if (activeCount >= MAX_CONCURRENT)
    return
  if (cooldownMap.has(`${article.id}:summary`) && Date.now() - cooldownMap.get(`${article.id}:summary`)! < COOLDOWN_MS)
    return

  const readingStore = useReadingStore()
  if (!readingStore.articles.some(a => a.id === article.id))
    return

  activeCount++
  cooldownMap.set(`${article.id}:summary`, Date.now())
  try {
    const prompt = `请用 2-3 句话概括以下文章的核心内容，直接输出摘要，不要添加任何前缀或解释：\n\n${article.content.slice(0, 4000)}`

    const endpoint = aiStore.textEndpoint
    const apiKey = aiStore.textApiKey
    const model = aiStore.textModel
    const type = aiStore.textType

    if (!endpoint || !model)
      return

    const url = resolveEndpointUrl(endpoint, 'chat')
    const headers = buildAIHeaders(apiKey, type)
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.3,
      max_tokens: 500,
    }

    let result = ''
    await fetchSSE(url, headers, payload, {
      onDelta: (chunk) => { result += chunk },
    })

    if (result.trim()) {
      const currentStore = useReadingStore()
      const current = currentStore.articles.find(a => a.id === article.id)
      if (current) {
        current.summary = result.trim()
        saveArticles(currentStore.articles)
      }
    }
  }
  catch (e) {
    if ((e as Error).name !== 'AbortError')
      console.warn('[TriggerManager] Summary failed:', e)
  }
  finally {
    activeCount--
  }
}

async function execAnnotate(article: Article): Promise<void> {
  const aiStore = useAIStore()

  if (!aiStore.autoAnnotate)
    return
  if (article.content.length < ANNOTATE_MIN_LENGTH)
    return
  if (activeCount >= MAX_CONCURRENT)
    return
  if (cooldownMap.has(`${article.id}:annotate`) && Date.now() - cooldownMap.get(`${article.id}:annotate`)! < COOLDOWN_MS)
    return

  const readingStore = useReadingStore()
  if (!readingStore.articles.some(a => a.id === article.id))
    return

  activeCount++
  cooldownMap.set(`${article.id}:annotate`, Date.now())
  try {
    const prompt = `阅读以下文章，提取 3-5 个关键观点或要点。对每个要点，输出原文引用和你的解读。以 JSON 数组格式输出，每项包含 text（原文引用）和 comment（解读），category 为以下之一：insight, question, key-point, action。只输出 JSON，不要解释。\n\n${article.content.slice(0, 6000)}`

    const endpoint = aiStore.textEndpoint
    const apiKey = aiStore.textApiKey
    const model = aiStore.textModel
    const type = aiStore.textType

    if (!endpoint || !model)
      return

    const url = resolveEndpointUrl(endpoint, 'chat')
    const headers = buildAIHeaders(apiKey, type)
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.5,
      max_tokens: 1500,
    }

    let result = ''
    await fetchSSE(url, headers, payload, {
      onDelta: (chunk) => { result += chunk },
    })

    if (result.trim()) {
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const items = JSON.parse(jsonMatch[0]) as Array<{
            text: string
            comment: string
            category?: string
          }>

          const annotationStore = useAnnotationStore()
          const batch = items
            .filter(item => item.text && item.comment)
            .map(item => ({
              articleId: article.id,
              text: item.text,
              comment: item.comment,
              category: (['insight', 'question', 'key-point', 'action'].includes(item.category ?? '')
                ? item.category
                : 'key-point') as 'insight' | 'question' | 'key-point' | 'action',
              importance: 3,
              source: 'ai' as const,
            }))

          if (batch.length > 0)
            await annotationStore.addBatch(batch)
        }
        catch (e) {
          console.warn('[TriggerManager] Failed to parse annotations:', e)
        }
      }
    }
  }
  catch (e) {
    if ((e as Error).name !== 'AbortError')
      console.warn('[TriggerManager] Annotate failed:', e)
  }
  finally {
    activeCount--
  }
}

// ── Scheduling ─────────────────────────────────────────

function scheduleTasks(article: Article): void {
  const summaryKey = `${article.id}:summary`
  if (!timers.has(summaryKey)) {
    timers.set(summaryKey, setTimeout(() => {
      timers.delete(summaryKey)
      void execSummary(article)
    }, SUMMARY_DELAY))
  }

  const annotateKey = `${article.id}:annotate`
  if (!timers.has(annotateKey)) {
    timers.set(annotateKey, setTimeout(() => {
      timers.delete(annotateKey)
      void execAnnotate(article)
    }, ANNOTATE_DELAY))
  }
}

// ── Public API ─────────────────────────────────────────

/** Clear all pending trigger timers. Exported for manual cleanup. */
export function clearTimers(): void {
  for (const timer of timers.values())
    clearTimeout(timer)
  timers.clear()
}

function createManager(): AITriggerManager {
  let stopWatcher: (() => void) | null = null

  function setup(): () => void {
    const readingStore = useReadingStore()

    const stopActiveArticle = watch(
      () => readingStore.activeArticleId,
      (newId) => {
        clearTimers()
        if (!newId)
          return

        const article = readingStore.articles.find(a => a.id === newId)
        if (article)
          scheduleTasks(article)
      },
    )

    stopWatcher = () => {
      stopActiveArticle()
      clearTimers()
    }

    return stopWatcher
  }

  return { setup, clearTimers }
}

// ── Singleton ──────────────────────────────────────────

let instance: AITriggerManager | null = null

/**
 * Get or create the singleton AI trigger manager.
 *
 * Watches `readingStore.activeArticleId` — on change, schedules delayed
 * AI triggers for summary and annotation based on content length.
 *
 * IMPORTANT: No `onUnmounted()` — this composable is called inside async
 * `.then()`, so Vue lifecycle hooks won't work. Call the cleanup function
 * returned by `setup()` instead.
 */
export function useAITriggerManager(): AITriggerManager {
  if (!instance)
    instance = createManager()
  return instance
}
