import type { Article, ReadingList, Source } from './types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { discoverRSSHubRoutes, fetchFullText, fetchPageHTML, fetchSourceArticles, previewSelectors, probeRSS } from './fetch-strategies'
import { loadArticles, loadLists, loadSources, saveArticles, saveLists, saveSources } from './persistence'

export type { Article, CollectorSelectors, FetchStrategy, ReadingList, Source, SourceHealth } from './types'

export const useReadingStore = defineStore('reading', () => {
  // ── 状态 ─────────────────────────────────────────────

  const sources = ref<Source[]>(loadSources())
  const articles = ref<Article[]>(loadArticles())
  const loading = ref(false)
  const error = ref('')
  const activeSourceId = ref<string | null>(null)
  const activeCategory = ref<string | null>(null)
  const activeArticleId = ref<string | null>(null)
  const searchQuery = ref('')
  const fetchingSourceIds = ref<Record<string, boolean>>({})
  const lastFetchMap = ref<Record<string, number>>({})
  const lists = ref<ReadingList[]>(loadLists())
  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

  // ── 计算属性 ─────────────────────────────────────────

  const categories = computed(() => {
    const cats = new Set(sources.value.map(s => s.category).filter(Boolean))
    return Array.from(cats).sort()
  })

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
    else if (activeCategory.value)
      result = result.filter(a => sources.value.some(s => s.id === a.sourceId && s.category === activeCategory.value))
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

  // ── 源 CRUD ──────────────────────────────────────────

  function addSource(data: Omit<Source, 'id' | 'addedAt' | 'health'>) {
    sources.value.push({
      ...data,
      id: `src-${Date.now()}`,
      addedAt: Date.now(),
    })
    saveSources(sources.value)
  }

  function updateSource(id: string, updates: Partial<Pick<Source, 'title' | 'category' | 'refreshInterval' | 'selectors' | 'description' | 'url'>>) {
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
    if (toAdd.length) {
      articles.value = [...toAdd, ...articles.value].slice(0, 500)
      saveArticles(articles.value)
    }
  }

  /**
   * 智能刷新：只刷新到期的源（基于每个源的 refreshInterval）。
   * force=true 时忽略间隔，全部刷新。
   */
  async function fetchAll(force = false) {
    loading.value = true
    error.value = ''
    const now = Date.now()
    const targets = force
      ? sources.value
      : sources.value.filter((src) => {
          if (src.refreshInterval <= 0)
            return false
          const lastFetch = lastFetchMap.value[src.id] || 0
          return now - lastFetch >= src.refreshInterval * 60 * 1000
        })
    if (!targets.length) {
      loading.value = false
      return
    }
    let failed = 0
    for (const src of targets) {
      try {
        fetchingSourceIds.value[src.id] = true
        src.health = { ...src.health, status: 'pending' }
        const newArticles = await fetchSourceArticles(src)
        mergeNewArticles(newArticles)
        src.health = { status: 'ok', lastFetchAt: Date.now(), articleCount: newArticles.length }
        lastFetchMap.value[src.id] = Date.now()
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : '获取失败'
        src.health = { status: 'error', lastError: msg, lastFetchAt: Date.now() }
        console.warn(`[Reading] Failed to fetch ${src.title}:`, e)
        failed++
      }
      finally {
        delete fetchingSourceIds.value[src.id]
      }
      // 源之间间隔 500ms，避免 CORS 代理限流
      if (targets.indexOf(src) < targets.length - 1)
        await new Promise(r => setTimeout(r, 500))
    }
    if (failed > 0)
      error.value = `${failed} 个源获取失败`
    loading.value = false
  }

  async function fetchSingleSource(sourceId: string) {
    if (fetchingSourceIds.value[sourceId])
      return
    fetchingSourceIds.value[sourceId] = true
    const src = sources.value.find(s => s.id === sourceId)
    if (!src)
      return
    try {
      src.health = { ...src.health, status: 'pending' }
      const newArticles = await fetchSourceArticles(src)
      mergeNewArticles(newArticles)
      src.health = { status: 'ok', lastFetchAt: Date.now(), articleCount: newArticles.length }
      lastFetchMap.value[src.id] = Date.now()
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : '获取失败'
      src.health = { status: 'error', lastError: msg, lastFetchAt: Date.now() }
      console.warn(`[Reading] Failed to fetch ${src.title}:`, e)
    }
    finally {
      delete fetchingSourceIds.value[sourceId]
    }
  }

  // ── 自动刷新 ─────────────────────────────────────────

  function startAutoRefresh() {
    stopAutoRefresh()
    autoRefreshTimer = setInterval(() => {
      if (loading.value)
        return
      const now = Date.now()
      for (const src of sources.value) {
        if (src.refreshInterval <= 0)
          continue
        const lastFetch = lastFetchMap.value[src.id] || 0
        if (now - lastFetch >= src.refreshInterval * 60 * 1000)
          void fetchSingleSource(src.id)
      }
    }, 60_000)
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

  function filterCategory(cat: string) {
    activeCategory.value = cat
    activeSourceId.value = null
  }

  function clearFilter() {
    activeCategory.value = null
    activeSourceId.value = null
  }

  function markAllRead() {
    const ids = activeSourceId.value
      ? new Set(articles.value.filter(a => a.sourceId === activeSourceId.value && !a.read).map(a => a.id))
      : activeCategory.value
        ? new Set(articles.value.filter(a => !a.read && sources.value.some(s => s.id === a.sourceId && s.category === activeCategory.value)).map(a => a.id))
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

  // ── 工具函数（委托到 fetch-strategies）────────────────

  async function reloadFromStorage() {
    sources.value = loadSources()
    articles.value = loadArticles()
    lists.value = loadLists()
  }

  function resetToDefaults() {
    // 重新加载默认源（清空 v2 key 后重新加载会 fallback 到默认值）
    localStorage.removeItem('reading_sources_v2')
    sources.value = loadSources()
    saveSources(sources.value)
    void fetchAll()
  }

  return {
    // 状态
    sources,
    articles,
    loading,
    error,
    activeSourceId,
    activeCategory,
    activeArticleId,
    searchQuery,
    fetchingSourceIds,
    // 计算属性
    categories,
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
    fetchAll,
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
    filterCategory,
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
  }
})
