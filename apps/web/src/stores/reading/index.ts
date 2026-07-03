import type { Article, ReadingList, Source } from './types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { discoverRSSHubRoutes, fetchFullText, fetchPageHTML, fetchSourceArticles, previewSelectors, probeRSS } from './fetch-strategies'
import { clearAll as clearAllIDB } from './indexeddb-persistence'
import {
  loadArticles,
  loadArticlesAsync,
  loadLastFetchMap,
  loadLists,
  loadListsAsync,
  loadSources,
  loadSourcesAsync,
  saveArticles,
  saveLastFetchMap,
  saveLists,
  saveSources,
} from './persistence'

export type { Article, CollectorSelectors, FeedViewType, FetchStrategy, ReadingList, Source, SourceHealth } from './types'

/** 并发获取上限，避免 CORS 代理过载 */
const FETCH_CONCURRENCY = 4
/** 文章保留上限 */
const ARTICLE_CAP = 2000
/** 每个源保留的文章数上限 */
const PER_SOURCE_ARTICLE_CAP = 100
/** lastFetchMap 持久化防抖 */
let persistFetchMapTimer: number | null = null

export const useReadingStore = defineStore('reading', () => {
  // ── 状态 ─────────────────────────────────────────────

  const sources = ref<Source[]>(loadSources())
  const articles = ref<Article[]>(loadArticles())
  const loading = ref(false)
  const backgroundRefreshing = ref(false)
  const error = ref('')
  const activeSourceId = ref<string | null>(null)
  const activeArticleId = ref<string | null>(null)
  const searchQuery = ref('')
  const fetchingSourceIds = ref<Record<string, boolean>>({})
  const lastFetchMap = ref<Record<string, number>>({})
  const lists = ref<ReadingList[]>(loadLists())
  const hydrated = ref(false)
  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

  // ── 计算属性 ─────────────────────────────────────────

  const unreadCountMap = computed(() => {
    const map: Record<string, number> = {}
    for (const a of articles.value) {
      if (!a.read)
        map[a.sourceId] = (map[a.sourceId] || 0) + 1
    }
    return map
  })

  const totalUnread = computed(() => articles.value.filter(a => !a.read).length)

  const filteredArticles = computed(() => {
    let result = articles.value
    if (activeSourceId.value)
      result = result.filter(a => a.sourceId === activeSourceId.value)
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(q)
        || a.summary.toLowerCase().includes(q)
        || a.sourceTitle.toLowerCase().includes(q),
      )
    }
    return result.sort((a, b) => b.publishedAt - a.publishedAt)
  })

  const activeArticle = computed(() =>
    articles.value.find(a => a.id === activeArticleId.value) || null,
  )

  const hasAutoRefresh = computed(() =>
    sources.value.some(s => s.refreshInterval > 0),
  )

  // ── Hydration（IndexedDB → 内存）─────────────────────

  async function hydrate() {
    const [s, a, l, fetchMap] = await Promise.all([
      loadSourcesAsync(),
      loadArticlesAsync(),
      loadListsAsync(),
      loadLastFetchMap(),
    ])
    sources.value = s
    articles.value = a
    lists.value = l
    lastFetchMap.value = fetchMap
    hydrated.value = true
  }

  // ── 源 CRUD ──────────────────────────────────────────

  function addSource(data: Omit<Source, 'id' | 'addedAt' | 'health'>) {
    sources.value.push({
      ...data,
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedAt: Date.now(),
      view: data.view ?? 0,
    })
    saveSources(sources.value)
  }

  function updateSource(id: string, updates: Partial<Pick<Source, 'title' | 'refreshInterval' | 'selectors' | 'description' | 'url' | 'view' | 'rsshubPath'>>) {
    const src = sources.value.find(s => s.id === id)
    if (src) {
      Object.assign(src, updates)
      saveSources(sources.value)
    }
  }

  function removeSource(id: string) {
    sources.value = sources.value.filter(s => s.id !== id)
    articles.value = articles.value.filter(a => a.sourceId !== id)
    saveSources(sources.value)
    saveArticles(articles.value)
  }

  // ── 获取 ─────────────────────────────────────────────

  function mergeNewArticles(newArticles: Article[]) {
    const existingIds = new Set(articles.value.map(a => a.id))
    const toAdd = newArticles.filter(a => !existingIds.has(a.id))
    const validSourceIds = new Set(sources.value.map(s => s.id))
    const filtered = toAdd.filter(a => validSourceIds.has(a.sourceId))
    if (filtered.length) {
      articles.value = [...filtered, ...articles.value].slice(0, ARTICLE_CAP)
      saveArticles(articles.value)
    }
    // 每个源淘汰旧文章，防止无限堆积
    trimArticlesPerSource()
  }

  /** 每个源只保留最新 PER_SOURCE_ARTICLE_CAP 篇文章 */
  function trimArticlesPerSource() {
    const bySource = new Map<string, Article[]>()
    for (const a of articles.value) {
      const arr = bySource.get(a.sourceId) || []
      arr.push(a)
      bySource.set(a.sourceId, arr)
    }
    const keepIds = new Set<string>()
    let needsTrim = false
    for (const [, arr] of bySource) {
      if (arr.length <= PER_SOURCE_ARTICLE_CAP) {
        for (const a of arr) keepIds.add(a.id)
      }
      else {
        needsTrim = true
        arr.sort((a, b) => b.publishedAt - a.publishedAt)
        for (const a of arr.slice(0, PER_SOURCE_ARTICLE_CAP)) keepIds.add(a.id)
      }
    }
    if (needsTrim) {
      articles.value = articles.value.filter(a => keepIds.has(a.id))
      saveArticles(articles.value)
    }
  }

  function persistFetchMapDebounced() {
    if (persistFetchMapTimer != null)
      window.clearTimeout(persistFetchMapTimer)
    persistFetchMapTimer = window.setTimeout(() => {
      void saveLastFetchMap(lastFetchMap.value)
    }, 2000)
  }

  /** 内部获取逻辑 */
  async function doFetchSourcesParallel(targets: Source[], background: boolean) {
    if (!background)
      loading.value = true
    else backgroundRefreshing.value = true
    error.value = ''

    let failed = 0

    for (let i = 0; i < targets.length; i += FETCH_CONCURRENCY) {
      const batch = targets.slice(i, i + FETCH_CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (src) => {
          if (fetchingSourceIds.value[src.id])
            return
          fetchingSourceIds.value[src.id] = true
          src.health = { ...src.health, status: 'pending' }
          try {
            const newArticles = await fetchSourceArticles(src)
            mergeNewArticles(newArticles)
            src.health = { status: 'ok', lastFetchAt: Date.now(), articleCount: newArticles.length }
            if (newArticles.length > 0)
              lastFetchMap.value[src.id] = Date.now()
          }
          catch (e) {
            const msg = e instanceof Error ? e.message : '获取失败'
            src.health = { status: 'error', lastError: msg, lastFetchAt: Date.now() }
            console.warn(`[Reading] Failed to fetch ${src.title}:`, e)
            throw e
          }
          finally {
            delete fetchingSourceIds.value[src.id]
          }
        }),
      )
      failed += results.filter(r => r.status === 'rejected').length
    }

    persistFetchMapDebounced()
    if (failed > 0) {
      const msg = `${failed} 个源获取失败`
      if (!background)
        error.value = msg
      toast.error(msg)
    }
    loading.value = false
    backgroundRefreshing.value = false
  }

  /** 并发获取一组源 */
  async function fetchSourcesParallel(targets: Source[], background = false) {
    if (!targets.length)
      return
    await doFetchSourcesParallel(targets, background)
  }

  /**
   * 智能刷新：只刷新到期的源（基于 refreshInterval + lastFetchMap）。
   * force=true 时忽略间隔，全部刷新。
   * background=true 时不显示 loading 状态（用于后台静默更新）。
   */
  async function fetchAll(force = false, background = false) {
    const now = Date.now()
    const targets = force
      ? sources.value
      : sources.value.filter((src) => {
          if (src.refreshInterval <= 0)
            return false
          const lastFetch = lastFetchMap.value[src.id] || 0
          return now - lastFetch >= src.refreshInterval * 60 * 1000
        })
    // 过滤正在获取中的源，避免重复请求
    const pendingTargets = targets.filter(src => !fetchingSourceIds.value[src.id])
    await fetchSourcesParallel(pendingTargets, background)
  }

  /**
   * 渐进式刷新：逐个刷新源，每批之间有延迟，适合导入后大量源的首次刷新。
   * 不会阻塞 UI，返回后所有源完成或超时。
   */
  async function fetchAllGradual(delayMs = 500) {
    const targets = sources.value.filter(src =>
      src.refreshInterval > 0 && !fetchingSourceIds.value[src.id],
    )
    if (!targets.length)
      return

    backgroundRefreshing.value = true
    for (const src of targets) {
      await fetchSingleSource(src.id)
      if (delayMs > 0)
        await new Promise(r => setTimeout(r, delayMs))
    }
    backgroundRefreshing.value = false
  }

  async function fetchSingleSource(sourceId: string) {
    if (fetchingSourceIds.value[sourceId])
      return
    const src = sources.value.find(s => s.id === sourceId)
    if (!src)
      return
    // 单源刷新：完全独立，不经过互斥锁和共享 loading 状态
    fetchingSourceIds.value[src.id] = true
    src.health = { ...src.health, status: 'pending' }
    try {
      const newArticles = await fetchSourceArticles(src)
      mergeNewArticles(newArticles)
      src.health = { status: 'ok', lastFetchAt: Date.now(), articleCount: newArticles.length }
      if (newArticles.length > 0)
        lastFetchMap.value[src.id] = Date.now()
      persistFetchMapDebounced()
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : '获取失败'
      src.health = { status: 'error', lastError: msg, lastFetchAt: Date.now() }
      console.warn(`[Reading] Failed to fetch ${src.title}:`, e)
    }
    finally {
      delete fetchingSourceIds.value[src.id]
    }
  }

  // ── 自动刷新 ─────────────────────────────────────────

  function startAutoRefresh() {
    stopAutoRefresh()
    autoRefreshTimer = setInterval(() => {
      if (loading.value || backgroundRefreshing.value)
        return
      const now = Date.now()
      const overdue = sources.value.filter((src) => {
        if (src.refreshInterval <= 0)
          return false
        const lastFetch = lastFetchMap.value[src.id] || 0
        return now - lastFetch >= src.refreshInterval * 60 * 1000
      })
      if (overdue.length)
        void fetchSourcesParallel(overdue, true)
    }, 5 * 60_000)
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
  }

  // ── 文章操作 ─────────────────────────────────────────

  function markRead(id: string) {
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.read = true
      saveArticles(articles.value)
    }
  }

  function toggleStar(id: string) {
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.starred = !article.starred
      saveArticles(articles.value)
    }
  }

  function setActiveArticle(id: string | null) {
    activeArticleId.value = id
    if (id)
      markRead(id)
  }

  function deleteArticle(id: string) {
    articles.value = articles.value.filter(a => a.id !== id)
    if (activeArticleId.value === id)
      activeArticleId.value = null
    saveArticles(articles.value)
  }

  function deleteArticles(ids: Set<string>) {
    articles.value = articles.value.filter(a => !ids.has(a.id))
    if (activeArticleId.value && ids.has(activeArticleId.value))
      activeArticleId.value = null
    saveArticles(articles.value)
  }

  function starArticles(ids: Set<string>) {
    for (const article of articles.value) {
      if (ids.has(article.id))
        article.starred = true
    }
    saveArticles(articles.value)
  }

  function unstarArticles(ids: Set<string>) {
    for (const article of articles.value) {
      if (ids.has(article.id))
        article.starred = false
    }
    saveArticles(articles.value)
  }

  // ── 筛选 ─────────────────────────────────────────────

  function clearFilter() {
    activeSourceId.value = null
  }

  function markAllRead() {
    const ids = activeSourceId.value
      ? new Set(articles.value.filter(a => a.sourceId === activeSourceId.value && !a.read).map(a => a.id))
      : new Set(articles.value.filter(a => !a.read).map(a => a.id))
    for (const article of articles.value) {
      if (ids.has(article.id))
        article.read = true
    }
    saveArticles(articles.value)
  }

  // ── 列表 ─────────────────────────────────────────────

  function addList(name: string) {
    lists.value.push({ id: `list-${Date.now()}`, name, articleIds: [], createdAt: Date.now() })
    saveLists(lists.value)
  }

  function removeList(id: string) {
    lists.value = lists.value.filter(l => l.id !== id)
    saveLists(lists.value)
  }

  function addToList(listId: string, articleId: string) {
    const list = lists.value.find(l => l.id === listId)
    if (list && !list.articleIds.includes(articleId)) {
      list.articleIds.push(articleId)
      saveLists(lists.value)
    }
  }

  function removeFromList(listId: string, articleId: string) {
    const list = lists.value.find(l => l.id === listId)
    if (list) {
      list.articleIds = list.articleIds.filter(id => id !== articleId)
      saveLists(lists.value)
    }
  }

  function getListArticles(listId: string): Article[] {
    const list = lists.value.find(l => l.id === listId)
    if (!list)
      return []
    const idSet = new Set(list.articleIds)
    return articles.value.filter(a => idSet.has(a.id))
  }

  // ── 工具函数 ─────────────────────────────────────────

  async function reloadFromStorage() {
    await hydrate()
  }

  function resetToDefaults() {
    localStorage.removeItem('reading_sources_v4')
    localStorage.removeItem('reading_articles')
    localStorage.removeItem('reading_lists')
    sources.value = []
    articles.value = []
    lists.value = []
    lastFetchMap.value = {}
    saveSources([])
    saveArticles([])
    saveLists([])
    void saveLastFetchMap({})
    void clearAllIDB()
  }

  // ── 页面卸载时保存 lastFetchMap ─────────────────────

  function setupBeforeUnload() {
    const handler = () => {
      if (persistFetchMapTimer != null) {
        window.clearTimeout(persistFetchMapTimer)
        persistFetchMapTimer = null
      }
      void saveLastFetchMap(lastFetchMap.value)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }

  return {
    // 状态
    sources,
    articles,
    loading,
    backgroundRefreshing,
    error,
    activeSourceId,
    activeArticleId,
    searchQuery,
    fetchingSourceIds,
    hydrated,
    // 计算属性
    unreadCountMap,
    totalUnread,
    filteredArticles,
    activeArticle,
    hasAutoRefresh,
    // 源 CRUD
    addSource,
    updateSource,
    removeSource,
    // 获取
    hydrate,
    fetchAll,
    fetchAllGradual,
    fetchSingleSource,
    startAutoRefresh,
    stopAutoRefresh,
    // 文章操作
    markRead,
    toggleStar,
    setActiveArticle,
    deleteArticle,
    deleteArticles,
    starArticles,
    unstarArticles,
    clearFilter,
    markAllRead,
    // 列表
    lists,
    addList,
    removeList,
    addToList,
    removeFromList,
    getListArticles,
    // 工具（委托）
    fetchFullText,
    fetchPageHTML,
    discoverRSSHubRoutes,
    previewSelectors,
    probeRSS,
    reloadFromStorage,
    resetToDefaults,
    setupBeforeUnload,
  }
})
