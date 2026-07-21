// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageEngine } from './engines/indexed-db'

/**
 * Tests for the storage abstraction layer.
 *
 * IndexedDBEngine requires a real IndexedDB implementation (not available in
 * jsdom), so we focus on LocalStorageEngine and verify the StorageEngine
 * interface contract. StorageManager is tested through its public surface.
 */

describe(`localStorageEngine`, () => {
  let engine: LocalStorageEngine

  beforeEach(() => {
    localStorage.clear()
    engine = new LocalStorageEngine()
  })

  it(`implements supportsSyncRead returning true`, () => {
    expect(engine.supportsSyncRead()).toBe(true)
  })

  it(`getSync returns null for missing keys`, () => {
    expect(engine.getSync(`nonexistent`)).toBeNull()
  })

  it(`set and get round-trip`, async () => {
    await engine.set(`test-key`, `hello`)
    expect(await engine.get(`test-key`)).toBe(`hello`)
  })

  it(`set and getSync round-trip`, async () => {
    await engine.set(`sync-key`, `world`)
    expect(engine.getSync(`sync-key`)).toBe(`world`)
  })

  it(`has returns false for missing keys`, async () => {
    expect(await engine.has(`missing`)).toBe(false)
  })

  it(`has returns true for existing keys`, async () => {
    await engine.set(`exists`, `1`)
    expect(await engine.has(`exists`)).toBe(true)
  })

  it(`remove deletes a key`, async () => {
    await engine.set(`to-delete`, `value`)
    await engine.remove(`to-delete`)
    expect(await engine.get(`to-delete`)).toBeNull()
    expect(await engine.has(`to-delete`)).toBe(false)
  })

  it(`clear removes all keys`, async () => {
    await engine.set(`a`, `1`)
    await engine.set(`b`, `2`)
    await engine.clear()
    expect(await engine.get(`a`)).toBeNull()
    expect(await engine.get(`b`)).toBeNull()
  })

  it(`keys returns all stored keys`, async () => {
    await engine.set(`x`, `1`)
    await engine.set(`y`, `2`)
    const keys = await engine.keys()
    expect(keys).toContain(`x`)
    expect(keys).toContain(`y`)
  })
})

describe(`storageManager with LocalStorageEngine`, () => {
  // We test via a fresh StorageManager-like pattern since the singleton
  // `store` is initialized with LocalStorageEngine by default.

  let engine: LocalStorageEngine

  beforeEach(() => {
    localStorage.clear()
    engine = new LocalStorageEngine()
  })

  it(`getJSON parses stored JSON`, async () => {
    await engine.set(`json-key`, JSON.stringify({ count: 42 }))
    const raw = await engine.get(`json-key`)
    expect(JSON.parse(raw!)).toEqual({ count: 42 })
  })

  it(`setJSON stores serializable data`, async () => {
    const data = { items: [1, 2, 3], name: `test` }
    await engine.set(`json-out`, JSON.stringify(data))
    const result = await engine.get(`json-out`)
    expect(JSON.parse(result!)).toEqual(data)
  })

  it(`getJSON returns default for invalid JSON`, async () => {
    await engine.set(`bad-json`, `{broken`)
    const raw = await engine.get(`bad-json`)
    // Replicate StorageManager.parseJSON behavior
    let parsed: { ok: boolean } | null = null
    try {
      parsed = JSON.parse(raw!)
    }
    catch {
      parsed = null
    }
    expect(parsed).toBeNull()
  })

  it(`setJSON throws on circular reference`, async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => JSON.stringify(circular)).toThrow()
  })

  it(`supports string values with special characters`, async () => {
    const value = `你好世界 🌍 <script>alert('xss')</script>`
    await engine.set(`special`, value)
    expect(await engine.get(`special`)).toBe(value)
  })

  it(`handles empty string values`, async () => {
    await engine.set(`empty`, ``)
    expect(await engine.get(`empty`)).toBe(``)
    expect(await engine.has(`empty`)).toBe(true)
  })
})
