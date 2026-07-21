// @workspace reading
import type { Article, FeedViewType } from '../../types'

import type { FeedItem } from './utils'
import { probeFoloRSSHub } from './folo'
import { fetchFeedViaProxy, fetchViaServer } from './proxy'
import { getRsshubBaseUrl } from './rss-hub'
import { cleanShortcodes } from './utils'

// ── RSS 解析 ───────────────────────────────────────────

/** 从 XML 元素中提取文本内容（支持 CDATA） */
function getText(el: Element | null): string {
  if (!el)
    return ''
  return (el.textContent || '').trim()
}

/** 从 XML 元素中按标签名获取第一个子元素 */
function getEl(parent: Element, tag: string): Element | null {
  return parent.querySelector(tag)
}

/** 纯浏览器 DOMParser 解析 RSS 2.0 / Atom，无 Node.js 依赖 */
export function parseRSSWithDOMParser(xml: string): { title: string, items: FeedItem[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError)
    throw new Error('XML 解析错误')

  const root = doc.documentElement

  // Atom feed
  if (root.localName === 'feed' || root.tagName === 'feed') {
    const title = getText(getEl(root, 'title'))
    const entries = root.querySelectorAll('entry')
    const items: FeedItem[] = Array.from(entries).map((entry) => {
      const linkEl = entry.querySelector('link[href]')
      const contentEl = getEl(entry, 'content') || getEl(entry, 'summary')
      const authorEl = entry.querySelector('author name') || getEl(entry, 'author')
      return {
        title: getText(getEl(entry, 'title')),
        link: linkEl?.getAttribute('href') || getText(getEl(entry, 'link')),
        content: getText(contentEl),
        contentSnippet: getText(getEl(entry, 'summary'))?.replace(/<[^>]*>/g, '').slice(0, 200),
        author: getText(authorEl),
        pubDate: getText(getEl(entry, 'published')) || getText(getEl(entry, 'updated')),
        guid: getText(getEl(entry, 'id')),
      }
    })
    return { title, items }
  }

  // RSS 2.0 / RSS 1.0
  const channel = getEl(root, 'channel') || root
  const title = getText(getEl(channel, 'title'))
  const itemEls = channel.querySelectorAll('item')
  const items: FeedItem[] = Array.from(itemEls).map((item) => {
    // content:encoded 不在标准 querySelectorAll 范围内，用迭代查找
    let encodedContent = ''
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if ((child.localName === 'encoded' && child.namespaceURI?.includes('content')) || child.tagName === 'content:encoded') {
        encodedContent = getText(child)
        break
      }
    }
    const description = getText(getEl(item, 'description'))
    const content = cleanShortcodes(encodedContent || description)
    const encEl = getEl(item, 'enclosure')
    let mediaContent: FeedItem['media:content']
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if (child.localName === 'content' && child.namespaceURI?.includes('medi')) {
        mediaContent = {
          url: child.getAttribute('url') || undefined,
          type: child.getAttribute('type') || undefined,
          medium: child.getAttribute('medium') || undefined,
          width: child.getAttribute('width') || undefined,
          height: child.getAttribute('height') || undefined,
        }
        break
      }
    }
    let mediaThumbnail: FeedItem['media:thumbnail']
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      if (child.localName === 'thumbnail' && child.namespaceURI?.includes('medi')) {
        mediaThumbnail = { url: child.getAttribute('url') || undefined }
        break
      }
    }
    return {
      'title': getText(getEl(item, 'title')),
      'link': getText(getEl(item, 'link')),
      content,
      'contentSnippet': description?.replace(/<[^>]*>/g, '').slice(0, 200),
      'creator': getText(getEl(item, 'dc\\:creator')) || getText(getEl(item, 'author')),
      'pubDate': getText(getEl(item, 'pubDate')) || getText(getEl(item, 'date')),
      'guid': getText(getEl(item, 'guid')),
      'enclosure': encEl
        ? {
            url: encEl.getAttribute('url') || undefined,
            type: encEl.getAttribute('type') || undefined,
            length: encEl.getAttribute('length') || undefined,
          }
        : undefined,
      'media:content': mediaContent,
      'media:thumbnail': mediaThumbnail,
    }
  })
  return { title, items }
}

export async function fetchFeed(url: string): Promise<{ title: string, items: FeedItem[] }> {
  const res = await fetchViaServer(url)
  const xml = await res.text()
  return parseRSSWithDOMParser(xml)
}

/** 探测 URL 是否为 RSS 源 */
export async function probeRSS(url: string): Promise<{ isRSS: boolean, title?: string, itemCount?: number, view?: number }> {
  // rsshub:// 协议 → 自建 RSSHub 时直接探测，否则走 Folo API
  if (url.startsWith('rsshub://')) {
    const rsshubBaseUrl = getRsshubBaseUrl()
    if (rsshubBaseUrl) {
      const fetchUrl = `${rsshubBaseUrl}/${url.slice('rsshub://'.length)}`
      try {
        const result = await fetchFeedViaProxy(fetchUrl)
        if (result.articles.length > 0)
          return { isRSS: true, title: result.feedTitle, itemCount: result.articles.length }
      }
      catch { /* 降级到 Folo */ }
    }
    return probeFoloRSSHub(url)
  }

  // 优先走服务端 RSS 代理（无 CORS 限制，支持编码检测）
  try {
    const result = await fetchFeedViaProxy(url)
    if (result.articles.length > 0) {
      return { isRSS: true, title: result.feedTitle, itemCount: result.articles.length }
    }
    return { isRSS: false }
  }
  catch {
    // 代理失败时降级为浏览器端解析
    try {
      const feed = await fetchFeed(url)
      if (feed.items.length > 0) {
        return { isRSS: true, title: feed.title, itemCount: feed.items.length }
      }
      return { isRSS: false }
    }
    catch {
      return { isRSS: false }
    }
  }
}

/** 视图类型自动检测：根据文章媒体内容推断最合适的 FeedViewType */
export function detectFeedViewType(articles: Article[]): FeedViewType {
  const sample = articles.slice(0, 10)
  let audioCount = 0
  let videoCount = 0
  let imageCount = 0
  for (const a of sample) {
    for (const m of a.media) {
      if (m.type === 'audio')
        audioCount++
      else if (m.type === 'video')
        videoCount++
      else if (m.type === 'photo')
        imageCount++
    }
    // 也检查 attachments 中的音频（播客可能存放在 attachments）
    for (const att of a.attachments) {
      if (att.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(att.url))
        audioCount++
      else if (att.mimeType?.startsWith('video/') || /\.(?:mp4|webm|mov)(?:\?|$)/i.test(att.url))
        videoCount++
    }
  }
  const total = sample.length || 1
  if (audioCount / total >= 0.8)
    return 3 // Audios
  if (videoCount / total >= 0.6)
    return 2 // Videos
  if (imageCount / total >= 0.5 && imageCount >= 3)
    return 1 // Pictures
  return 0 // Articles
}
