import type { Article, ReadingList, Source } from './types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { store } from '@/storage'
import { detectFeedViewType, discoverRSSHubRoutes, fetchFullText, fetchPageHTML, fetchSourceArticles, previewSelectors, probeRSS, setRsshubBaseUrl } from './fetch-strategies'
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
export { VIEW_TYPE_OPTIONS } from './types'

/** 并发获取上限，避免 CORS 代理过载 */
const FETCH_CONCURRENCY = 5
const ARTICLE_CAP = 3000
const PER_SOURCE_ARTICLE_CAP = 240
const READING_PICTURE_LAYOUT_KEY = 'reading_picture_layout'
const READING_PICTURE_IMAGE_ONLY_KEY = 'reading_picture_image_only'
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
  const pictureLayout = store.reactive<'masonry' | 'grid'>(READING_PICTURE_LAYOUT_KEY, 'masonry')
  const pictureImageOnly = store.reactive<boolean>(READING_PICTURE_IMAGE_ONLY_KEY, false)
  const rsshubBaseUrl = store.reactive<string>('reading_rsshub_url', '')
  watch(rsshubBaseUrl, v => setRsshubBaseUrl(v), { immediate: true })
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

  /** 标准化 URL 用于去重比较 */
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url)
      // 去掉 trailing slash、query、fragment，统一 protocol
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`.toLowerCase()
    }
    catch {
      return url.toLowerCase().replace(/\/$/, '')
    }
  }

  async function hydrate() {
    const lsSources = loadSources()
    const lsArticles = loadArticles()
    const lsLists = loadLists()

    const [s, a, l, fetchMap] = await Promise.all([
      loadSourcesAsync(),
      loadArticlesAsync(),
      loadListsAsync(),
      loadLastFetchMap(),
    ])

    // localStorage 是同步写入，不会丢失；IndexedDB 异步写入可能丢失。
    // 取两者中更完整的一份，确保用户新增的数据不会被旧的 IndexedDB 数据覆盖。
    const finalSources = lsSources.length > 0 ? lsSources : s
    const finalArticles = lsArticles.length > 0 ? lsArticles : a
    const finalLists = lsLists.length > 0 ? lsLists : l

    // ── 源去重：按标准化 URL，保留第一个，合并文章到保留的源 ──
    const urlToKeepId = new Map<string, string>()
    const removeSourceIds = new Set<string>()
    const keptSources: Source[] = []
    for (const src of finalSources) {
      const norm = normalizeUrl(src.url)
      const existing = urlToKeepId.get(norm)
      if (existing) {
        removeSourceIds.add(src.id)
      }
      else {
        urlToKeepId.set(norm, src.id)
        keptSources.push(src)
      }
    }
    sources.value = keptSources

    // ── 文章去重：迁移被删源的文章 + 按内容去重 ──
    // 被删源的文章 → 归到保留的源
    if (removeSourceIds.size > 0) {
      // 建立 oldSourceId → keptSourceId 映射（通过 URL 匹配）
      const oldIdToNorm = new Map<string, string>()
      for (const src of finalSources) {
        if (removeSourceIds.has(src.id)) {
          oldIdToNorm.set(src.id, normalizeUrl(src.url))
        }
      }
      for (const article of finalArticles) {
        if (removeSourceIds.has(article.sourceId)) {
          const norm = oldIdToNorm.get(article.sourceId)
          const keptId = norm ? urlToKeepId.get(norm) : undefined
          if (keptId)
            article.sourceId = keptId
        }
      }
    }

    // 按 sourceId+title+publishedAt 去重（比 ID 去重更可靠）
    const validSourceIds = new Set(keptSources.map(s => s.id))
    const seenArticleKeys = new Set<string>()
    const keptArticles: Article[] = []
    for (const article of finalArticles) {
      if (!validSourceIds.has(article.sourceId))
        continue
      const key = `${article.sourceId}|${article.title}|${article.publishedAt}`
      if (seenArticleKeys.has(key))
        continue
      seenArticleKeys.add(key)
      keptArticles.push(article)
    }
    articles.value = keptArticles

    lists.value = finalLists
    lastFetchMap.value = fetchMap
    hydrated.value = true

    // 去重后持久化，防止下次启动重复清理
    if (removeSourceIds.size > 0 || keptArticles.length < finalArticles.length) {
      saveSources(sources.value)
      saveArticles(articles.value)
    }

    // 监听 Folo feedId 缓存事件（fetchFoloSource 首次获取后触发）
    window.addEventListener('folo-feed-id', ((e: CustomEvent<{ sourceId: string, feedId: string, view?: number }>) => {
      const src = sources.value.find(s => s.id === e.detail.sourceId)
      if (src) {
        if (!src.foloFeedId) {
          src.foloFeedId = e.detail.feedId
        }
        // 使用 Folo 的视图类型检测结果
        if (e.detail.view != null && e.detail.view !== 0) {
          src.view = e.detail.view
        }
        saveSources(sources.value)
      }
    }) as EventListener)
  }

  // ── 源 CRUD ──────────────────────────────────────────

  function addSource(data: Omit<Source, 'id' | 'addedAt' | 'health'>) {
    // 防止重复添加相同 URL 的源（标准化 URL 比较）
    const norm = normalizeUrl(data.url)
    const existing = sources.value.find(s => normalizeUrl(s.url) === norm)
    if (existing)
      return existing
    const newId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const view = data.view ?? 0
    sources.value.push({
      ...data,
      id: newId,
      addedAt: Date.now(),
      view,
      // 如果用户没有手动设置 view（使用默认值 0），标记为自动检测
      autoDetectedView: view === 0,
    })
    saveSources(sources.value)
    // 添加后自动获取文章
    void fetchSingleSource(newId)
  }

  function updateSource(id: string, updates: Partial<Pick<Source, 'title' | 'refreshInterval' | 'selectors' | 'description' | 'url' | 'view' | 'rsshubPath' | 'foloFeedId'>>) {
    const src = sources.value.find(s => s.id === id)
    if (src) {
      const urlChanged = updates.url && updates.url !== src.url
      Object.assign(src, updates)
      // 用户手动设置 view 时，清除自动检测标志
      if (updates.view !== undefined) {
        src.autoDetectedView = false
      }
      saveSources(sources.value)
      // URL 变更后重新抓取
      if (urlChanged) {
        src.health = { status: 'pending' }
        void fetchSingleSource(id)
      }
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
    const existingMap = new Map(articles.value.map(a => [a.id, a]))
    const existingKeys = new Set(articles.value.map(a => `${a.sourceId}|${a.title}|${a.publishedAt}`))
    const validSourceIds = new Set(sources.value.map(s => s.id))

    const toAdd: Article[] = []
    let updated = false
    for (const a of newArticles) {
      if (!validSourceIds.has(a.sourceId))
        continue
      const key = `${a.sourceId}|${a.title}|${a.publishedAt}`
      const existing = existingMap.get(a.id)
      if (existing) {
        // 如果新文章有更多媒体数据，更新已有文章
        if (a.media.length > existing.media.length || (a.attachments?.length ?? 0) > (existing.attachments?.length ?? 0)) {
          Object.assign(existing, { media: a.media, attachments: a.attachments, content: a.content || existing.content, summary: a.summary || existing.summary })
          updated = true
        }
        continue
      }
      if (existingKeys.has(key))
        continue
      toAdd.push(a)
    }

    if (toAdd.length || updated) {
      if (toAdd.length)
        articles.value = [...toAdd, ...articles.value].slice(0, ARTICLE_CAP)
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

  /** 并发刷新所有源，最大并发数由 FETCH_CONCURRENCY 控制 */
  async function fetchAllGradual(_delayMs = 500) {
    const targets = sources.value.filter(src =>
      src.refreshInterval > 0 && !fetchingSourceIds.value[src.id],
    )
    if (!targets.length)
      return
    await doFetchSourcesParallel(targets, true)
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

      // 自动检测视图类型（当源还是默认文章类型，或用户未手动设置时）
      if (newArticles.length > 0) {
        const detected = detectFeedViewType(newArticles)
        if (detected !== 0 && (src.view === 0 || src.autoDetectedView)) {
          src.view = detected
          src.autoDetectedView = true
          saveSources(sources.value)
        }
      }
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

  function setPictureLayout(layout: 'masonry' | 'grid') {
    pictureLayout.value = layout
  }

  function togglePictureImageOnly(force?: boolean) {
    pictureImageOnly.value = typeof force === 'boolean' ? force : !pictureImageOnly.value
  }

  function getAdjacentPictureArticleId(currentId: string, direction: 'prev' | 'next') {
    const pictureArticles = filteredArticles.value.filter(article => article.media.some(m => m.type === 'photo'))
    if (!pictureArticles.length)
      return null
    const currentIndex = pictureArticles.findIndex(article => article.id === currentId)
    if (currentIndex === -1)
      return pictureArticles[0]?.id ?? null
    const nextIndex = direction === 'next'
      ? Math.min(currentIndex + 1, pictureArticles.length - 1)
      : Math.max(currentIndex - 1, 0)
    return pictureArticles[nextIndex]?.id ?? null
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
    pictureLayout,
    pictureImageOnly,
    rsshubBaseUrl,
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
    setPictureLayout,
    togglePictureImageOnly,
    getAdjacentPictureArticleId,
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
