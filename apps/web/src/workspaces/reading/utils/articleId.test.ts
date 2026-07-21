// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  generateArticleId,
  generateContentHash,
  isNewArticleId,
  normalizeUrl,
} from './articleId'

describe(`normalizeUrl`, () => {
  it(`strips utm_source tracking param`, () => {
    const result = normalizeUrl(`https://example.com/article?utm_source=rss&title=hello`)
    expect(result).not.toContain(`utm_source`)
    expect(result).toContain(`title=hello`)
  })

  it(`strips all common tracking params at once`, () => {
    const url = `https://example.com/page?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&fbclid=x&gclid=y&ttclid=z&real=keep`
    const result = normalizeUrl(url)
    expect(result).toContain(`real=keep`)
    expect(result).not.toMatch(/utm_|fbclid|gclid|ttclid/)
  })

  it(`removes hash fragment`, () => {
    const result = normalizeUrl(`https://example.com/page#section-1`)
    expect(result).not.toContain(`#`)
    expect(result).toContain(`example.com/page`)
  })

  it(`removes trailing slash for paths longer than root`, () => {
    const result = normalizeUrl(`https://example.com/path/`)
    expect(result).toContain(`/path`)
    expect(result).not.toMatch(/\/path\/$/)
  })

  it(`preserves root slash`, () => {
    const result = normalizeUrl(`https://example.com/`)
    expect(result).toBe(`https://example.com/`)
  })

  it(`lowercases the URL`, () => {
    const result = normalizeUrl(`https://Example.COM/Path`)
    expect(result).toBe(result.toLowerCase())
  })

  it(`returns empty string for empty input`, () => {
    expect(normalizeUrl(``)).toBe(``)
  })

  it(`handles invalid URLs by normalizing the raw string`, () => {
    const result = normalizeUrl(`not-a-valid-url`)
    expect(result).toBe(`not-a-valid-url`)
  })

  it(`is deterministic for the same URL`, () => {
    const a = normalizeUrl(`https://example.com/article?utm_source=twitter&id=5`)
    const b = normalizeUrl(`https://example.com/article?utm_source=twitter&id=5`)
    expect(a).toBe(b)
  })
})

describe(`generateArticleId`, () => {
  it(`produces a stable ID for the same inputs`, async () => {
    const a = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    const b = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    expect(a).toBe(b)
  })

  it(`returns an art- prefixed 16-char hex string`, async () => {
    const id = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    expect(id).toMatch(/^art-[a-f0-9]{16}$/)
  })

  it(`differs when sourceId changes`, async () => {
    const a = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    const b = await generateArticleId(`src2`, `https://example.com/post`, 1700000000000)
    expect(a).not.toBe(b)
  })

  it(`differs when publishedAt changes`, async () => {
    const a = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    const b = await generateArticleId(`src1`, `https://example.com/post`, 1700000000001)
    expect(a).not.toBe(b)
  })

  it(`normalizes link before hashing (tracking params stripped)`, async () => {
    const a = await generateArticleId(`src1`, `https://example.com/post?utm_source=twitter`, 1700000000000)
    const b = await generateArticleId(`src1`, `https://example.com/post?utm_source=rss`, 1700000000000)
    expect(a).toBe(b)
  })

  it(`passes isNewArticleId check`, async () => {
    const id = await generateArticleId(`src1`, `https://example.com/post`, 1700000000000)
    expect(isNewArticleId(id)).toBe(true)
  })
})

describe(`generateContentHash`, () => {
  it(`produces a stable hash for the same inputs`, async () => {
    const a = await generateContentHash(`Hello World`, `Some summary`)
    const b = await generateContentHash(`Hello World`, `Some summary`)
    expect(a).toBe(b)
  })

  it(`returns 16-char hex string`, async () => {
    const hash = await generateContentHash(`Title`, `Summary text`)
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  it(`differs when title changes`, async () => {
    const a = await generateContentHash(`Title A`, `Same summary`)
    const b = await generateContentHash(`Title B`, `Same summary`)
    expect(a).not.toBe(b)
  })

  it(`normalizes case before hashing`, async () => {
    const a = await generateContentHash(`Hello World`, `Summary`)
    const b = await generateContentHash(`hello world`, `Summary`)
    expect(a).toBe(b)
  })

  it(`trims whitespace before hashing`, async () => {
    const a = await generateContentHash(`Title`, `Summary`)
    const b = await generateContentHash(`  Title  `, `  Summary  `)
    expect(a).toBe(b)
  })

  it(`truncates summary to 200 chars for hashing`, async () => {
    const short = await generateContentHash(`T`, `A`.repeat(200))
    const long = await generateContentHash(`T`, `A`.repeat(500))
    expect(short).toBe(long)
  })
})

describe(`isNewArticleId`, () => {
  it(`returns true for valid art- prefixed IDs`, () => {
    expect(isNewArticleId(`art-0123456789abcdef`)).toBe(true)
  })

  it(`returns false for legacy IDs without art- prefix`, () => {
    expect(isNewArticleId(`abc123`)).toBe(false)
    expect(isNewArticleId(`some-other-format`)).toBe(false)
  })

  it(`returns false for empty string`, () => {
    expect(isNewArticleId(``)).toBe(false)
  })

  it(`returns false when hash part is too short`, () => {
    expect(isNewArticleId(`art-012345`)).toBe(false)
  })

  it(`returns false when hash part is too long`, () => {
    expect(isNewArticleId(`art-0123456789abcdef00`)).toBe(false)
  })

  it(`returns false for uppercase hex`, () => {
    expect(isNewArticleId(`art-0123456789ABCDEF`)).toBe(false)
  })

  it(`returns false for non-hex characters`, () => {
    expect(isNewArticleId(`art-0123456789abcdeg`)).toBe(false)
  })
})
