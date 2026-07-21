import { Readability } from '@mozilla/readability'

/**
 * 使用 Mozilla Readability 从 HTML 中提取文章正文
 * @param html 原始 HTML 字符串
 * @param url  文章 URL（用于解析相对链接）
 * @returns 提取后的 HTML 正文；提取失败返回空字符串
 */
export function extractArticle(html: string, url?: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  if (url) {
    const base = doc.createElement('base')
    base.href = url
    doc.head.appendChild(base)
  }

  const reader = new Readability(doc, {
    nbTopCandidates: 5,
    charThreshold: 500,
  })

  const article = reader.parse()
  if (!article)
    return ''

  return article.content || ''
}

/**
 * 兜底正文提取：移除噪音元素后，按常见选择器匹配，最后取 body 最长子元素
 */
export function extractArticleFallback(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const noise = [
    'script',
    'style',
    'noscript',
    'nav',
    'footer',
    'header',
    'aside',
    'iframe',
    '.ad',
    '.advertisement',
    '.sidebar',
    '.comment',
    '.nav',
    '.menu',
    '.header',
    '.footer',
    '.related',
    '.recommend',
    '.toolbar',
  ]
  doc.querySelectorAll(noise.join(',')).forEach(el => el.remove())

  const selectors = [
    'article',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post-body',
    '.article-body',
    '.rich_media_content',
    '.article-detail',
    '.detail-content',
    '.detail_txt',
    '.detail-text',
    '.news-content',
    '.news_txt',
    '[class*="article"]',
    '[class*="content"]',
    '[class*="detail"]',
    '.main-content',
    '#main-content',
    '.page-content',
    '.text-content',
  ]

  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el && el.textContent && el.textContent.trim().length > 200)
      return el.innerHTML
  }

  let best: Element | null = null
  let maxLen = 0
  for (const el of doc.body?.children || []) {
    const len = el.textContent?.trim().length || 0
    if (len > maxLen) {
      maxLen = len
      best = el
    }
  }

  return best?.innerHTML || doc.body?.innerHTML || ''
}
