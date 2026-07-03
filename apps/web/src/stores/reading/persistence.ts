import type { Article, ReadingList, Source } from './types'
import * as idb from './indexeddb-persistence'

// ── 存储键（localStorage 回退用）───────────────────────

const STORAGE_SOURCES = 'reading_sources_v4'
const STORAGE_ARTICLES = 'reading_articles'
const STORAGE_LISTS = 'reading_lists'

// ── 通用工具 ───────────────────────────────────────────

function triggerSync() {
  window.dispatchEvent(new CustomEvent('md:data-changed', { detail: { scope: 'reading' } }))
}

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 0)
        return fallback
      return parsed
    }
  }
  catch { /* ignore */ }
  return fallback
}

// ── 异步加载（IndexedDB 优先，localStorage 回退）──────

export async function loadSourcesAsync(): Promise<Source[]> {
  try {
    const data = await idb.getAllSources()
    if (data.length > 0)
      return data
  }
  catch { /* IndexedDB 不可用 */ }
  return loadFromLocalStorage<Source[]>(STORAGE_SOURCES, [])
}

export async function loadArticlesAsync(): Promise<Article[]> {
  try {
    const data = await idb.getAllArticles()
    if (data.length > 0)
      return data
  }
  catch { /* IndexedDB 不可用 */ }
  return loadFromLocalStorage<Article[]>(STORAGE_ARTICLES, [])
}

export async function loadListsAsync(): Promise<ReadingList[]> {
  try {
    const data = await idb.getAllLists()
    if (data.length > 0)
      return data
  }
  catch { /* IndexedDB 不可用 */ }
  return loadFromLocalStorage<ReadingList[]>(STORAGE_LISTS, [])
}

// ── 同步加载（localStorage，用于 SSR 或降级）──────────

export function loadSources(): Source[] {
  return loadFromLocalStorage<Source[]>(STORAGE_SOURCES, [])
}

export function loadArticles(): Article[] {
  return loadFromLocalStorage<Article[]>(STORAGE_ARTICLES, [])
}

export function loadLists(): ReadingList[] {
  return loadFromLocalStorage<ReadingList[]>(STORAGE_LISTS, [])
}

// ── 保存（双写 localStorage + IndexedDB）──────────────

export function saveSources(sources: Source[]) {
  try {
    localStorage.setItem(STORAGE_SOURCES, JSON.stringify(sources))
  }
  catch (e) {
    console.warn('[Reading] localStorage save failed:', e)
  }
  void idb.saveSources(sources).catch(() => {})
  triggerSync()
}

export function saveArticles(articles: Article[]) {
  try {
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(articles))
  }
  catch (e) {
    console.warn('[Reading] localStorage save failed:', e)
  }
  void idb.saveArticles(articles).catch(() => {})
  triggerSync()
}

export function saveLists(lists: ReadingList[]) {
  try {
    localStorage.setItem(STORAGE_LISTS, JSON.stringify(lists))
  }
  catch (e) {
    console.warn('[Reading] localStorage save failed:', e)
  }
  void idb.saveLists(lists).catch(() => {})
  triggerSync()
}

// ── lastFetchMap 持久化 ───────────────────────────────

export async function loadLastFetchMap(): Promise<Record<string, number>> {
  try {
    const raw = await idb.getMeta('lastFetchMap')
    if (raw)
      return JSON.parse(raw)
  }
  catch { /* ignore */ }
  return {}
}

export async function saveLastFetchMap(map: Record<string, number>): Promise<void> {
  try {
    await idb.setMeta('lastFetchMap', JSON.stringify(map))
  }
  catch { /* ignore */ }
}

// ── 备份/恢复 ─────────────────────────────────────────

export interface ReadingDataExport {
  version: number
  exportedAt: number
  sources: Source[]
  articles: Article[]
  lists: ReadingList[]
}

export async function exportAllData(): Promise<ReadingDataExport> {
  const [sources, articles, lists] = await Promise.all([
    loadSourcesAsync(),
    loadArticlesAsync(),
    loadListsAsync(),
  ])
  return { version: 1, exportedAt: Date.now(), sources, articles, lists }
}

export async function importAllData(data: ReadingDataExport): Promise<void> {
  if (!data || data.version !== 1)
    throw new Error('Unsupported backup format')
  const { sources, articles, lists } = data
  saveSources(sources)
  saveArticles(articles)
  saveLists(lists)
}
