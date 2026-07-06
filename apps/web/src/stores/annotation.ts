import type { IDBPDatabase } from 'idb'
import { openDB as idbOpen } from 'idb'
import { defineStore } from 'pinia'

// ── Types ──────────────────────────────────────────────

export type AnnotationCategory = 'insight' | 'question' | 'key-point' | 'action' | 'manual'
export type AnnotationSource = 'ai' | 'user'

export interface Annotation {
  id: string
  articleId: string
  text: string
  comment: string
  category: AnnotationCategory
  importance: number
  source: AnnotationSource
  createdAt: number
}

// ── IndexedDB ──────────────────────────────────────────

interface AnnotationDB {
  annotations: {
    key: string
    value: Annotation
    indexes: { articleId: string }
  }
}

const DB_NAME = 'md-editor'
const DB_VERSION = 1
const STORE_NAME = 'annotations'

let dbPromise: Promise<IDBPDatabase<AnnotationDB>> | null = null
let migrationDone = false

function getDB(): Promise<IDBPDatabase<AnnotationDB>> {
  if (!dbPromise) {
    dbPromise = idbOpen<AnnotationDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('articleId', 'articleId')
        }
      },
    })
  }
  return dbPromise
}

// ── localStorage migration ─────────────────────────────

const LS_KEY = 'reading_annotations'

async function migrateFromLocalStorage(): Promise<void> {
  if (migrationDone)
    return
  migrationDone = true

  const raw = localStorage.getItem(LS_KEY)
  if (!raw)
    return

  try {
    const old: Array<{ id: string, articleId: string, text: string, comment: string, createdAt: number }> = JSON.parse(raw)
    if (!Array.isArray(old) || old.length === 0) {
      localStorage.removeItem(LS_KEY)
      return
    }

    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    for (const record of old) {
      const annotation: Annotation = {
        id: record.id,
        articleId: record.articleId,
        text: record.text,
        comment: record.comment ?? '',
        category: 'manual',
        importance: 3,
        source: 'user',
        createdAt: record.createdAt ?? Date.now(),
      }
      await store.put(annotation)
    }

    await tx.done
    localStorage.removeItem(LS_KEY)
  }
  catch {
    // Migration failure is non-fatal; old data stays in localStorage
  }
}

// ── Pinia store ────────────────────────────────────────

export const useAnnotationStore = defineStore('annotation', () => {
  const annotations = ref<Annotation[]>([])
  const loaded = ref(false)

  async function ensureLoaded() {
    if (loaded.value)
      return
    await migrateFromLocalStorage()
    const db = await getDB()
    annotations.value = await db.getAll(STORE_NAME)
    loaded.value = true
  }

  // ── CRUD ─────────────────────────────────────────────

  async function add(annotation: Omit<Annotation, 'id' | 'createdAt'> & Partial<Pick<Annotation, 'id' | 'createdAt'>>): Promise<Annotation> {
    await ensureLoaded()
    const record: Annotation = {
      id: annotation.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      articleId: annotation.articleId,
      text: annotation.text,
      comment: annotation.comment ?? '',
      category: annotation.category ?? 'manual',
      importance: annotation.importance ?? 3,
      source: annotation.source ?? 'user',
      createdAt: annotation.createdAt ?? Date.now(),
    }
    const db = await getDB()
    await db.put(STORE_NAME, record)
    annotations.value.push(record)
    return record
  }

  async function addBatch(items: Array<Omit<Annotation, 'id' | 'createdAt'> & Partial<Pick<Annotation, 'id' | 'createdAt'>>>): Promise<Annotation[]> {
    await ensureLoaded()
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const results: Annotation[] = []

    for (const item of items) {
      const record: Annotation = {
        id: item.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        articleId: item.articleId,
        text: item.text,
        comment: item.comment ?? '',
        category: item.category ?? 'manual',
        importance: item.importance ?? 3,
        source: item.source ?? 'user',
        createdAt: item.createdAt ?? Date.now(),
      }
      await store.put(record)
      results.push(record)
    }

    await tx.done
    annotations.value.push(...results)
    return results
  }

  async function remove(id: string): Promise<void> {
    await ensureLoaded()
    const db = await getDB()
    await db.delete(STORE_NAME, id)
    annotations.value = annotations.value.filter(a => a.id !== id)
  }

  async function update(id: string, patch: Partial<Omit<Annotation, 'id' | 'createdAt'>>): Promise<Annotation | null> {
    await ensureLoaded()
    const existing = annotations.value.find(a => a.id === id)
    if (!existing)
      return null

    const updated: Annotation = { ...existing, ...patch, id, createdAt: existing.createdAt }
    const db = await getDB()
    await db.put(STORE_NAME, updated)
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx !== -1)
      annotations.value[idx] = updated
    return updated
  }

  async function getByArticleId(articleId: string): Promise<Annotation[]> {
    await ensureLoaded()
    return annotations.value.filter(a => a.articleId === articleId)
  }

  async function getAll(): Promise<Annotation[]> {
    await ensureLoaded()
    return [...annotations.value]
  }

  return {
    annotations,
    loaded,
    ensureLoaded,
    add,
    addBatch,
    remove,
    update,
    getByArticleId,
    getAll,
  }
})
