// @workspace reading
import type { IDBPDatabase } from 'idb'
import type { Article, ReadingList, Source } from './types'
import { openDB as idbOpen } from 'idb'

// ── Schema ─────────────────────────────────────────────

interface ReadingDB {
  sources: {
    key: string
    value: Source
  }
  articles: {
    key: string
    value: Article
  }
  lists: {
    key: string
    value: ReadingList
  }
  meta: {
    key: string
    value: string
  }
}

// ── Constants ──────────────────────────────────────────

const DB_NAME = 'reading-db'
const DB_VERSION = 2

// ── DB singleton ───────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<ReadingDB>> | null = null

/**
 * Open (or return cached) IndexedDB handle.
 * First call runs the upgrade path; subsequent calls reuse the connection.
 */
export function openDB(): Promise<IDBPDatabase<ReadingDB>> {
  if (!dbPromise) {
    dbPromise = idbOpen<ReadingDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('sources'))
          db.createObjectStore('sources', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('articles'))
          db.createObjectStore('articles', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('lists'))
          db.createObjectStore('lists', { keyPath: 'id' })
        if (oldVersion < 2 && !db.objectStoreNames.contains('meta'))
          db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

// ── Sources ────────────────────────────────────────────

export async function getAllSources(): Promise<Source[]> {
  const db = await openDB()
  return db.getAll('sources')
}

export async function saveSources(sources: Source[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('sources', 'readwrite')
  await tx.store.clear()
  for (const source of sources)
    tx.store.put(source)
  await tx.done
}

// ── Articles ───────────────────────────────────────────

export async function getAllArticles(): Promise<Article[]> {
  const db = await openDB()
  return db.getAll('articles')
}

export async function saveArticles(articles: Article[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('articles', 'readwrite')
  await tx.store.clear()
  for (const article of articles)
    tx.store.put(article)
  await tx.done
}

// ── Lists ──────────────────────────────────────────────

export async function getAllLists(): Promise<ReadingList[]> {
  const db = await openDB()
  return db.getAll('lists')
}

export async function saveLists(lists: ReadingList[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('lists', 'readwrite')
  await tx.store.clear()
  for (const list of lists)
    tx.store.put(list)
  await tx.done
}

// ── Meta (lastFetchMap etc.) ───────────────────────────

export async function getMeta(key: string): Promise<string | null> {
  const db = await openDB()
  const row = await db.get('meta', key)
  return row?.value ?? null
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDB()
  await db.put('meta', { key, value })
}

// ── Reset ──────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['sources', 'articles', 'lists', 'meta'], 'readwrite')
  await Promise.all([
    tx.objectStore('sources').clear(),
    tx.objectStore('articles').clear(),
    tx.objectStore('lists').clear(),
    tx.objectStore('meta').clear(),
  ])
  await tx.done
}
