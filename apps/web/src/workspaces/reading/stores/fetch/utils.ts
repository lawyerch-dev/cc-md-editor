// @workspace reading
import type { MediaItem } from '../../types'

// ── 短代码清理 ──────────────────────────────────────

/** 清理内容中的视频/音频短代码 */
export function cleanShortcodes(html: string): string {
  return html.replace(/\[!--begin:\w+--\][\s\S]*?\[!--end:\w+--\]/g, '')
}

// ── FeedItem 类型（RSS 解析共用）─────────────────────

export interface FeedItem {
  'title'?: string
  'link'?: string
  'content'?: string
  'contentSnippet'?: string
  'creator'?: string
  'author'?: string
  'pubDate'?: string
  'guid'?: string
  'enclosure'?: { url?: string, type?: string, length?: string }
  'media:content'?: { url?: string, type?: string, medium?: string, width?: string, height?: string }
  'media:thumbnail'?: { url?: string }
}

// ── 错误判断 ────────────────────────────────────────

/**
 * 判断错误是否为可重试的网络/超时错误
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error))
    return false
  const msg = err.message.toLowerCase()
  return msg.includes('timeout')
    || msg.includes('network')
    || msg.includes('fetch')
    || msg.includes('cors')
    || msg.includes('proxy')
    || msg.includes('econnrefused')
    || msg.includes('etimedout')
    || msg.includes('abort')
}

// ── 媒体提取 ────────────────────────────────────────

/** 从 RSS item 提取媒体列表 */
export function extractMediaFromItem(item: FeedItem): MediaItem[] {
  const media: MediaItem[] = []
  // enclosure
  if (item.enclosure?.url) {
    const encType = item.enclosure.type || ''
    if (encType.startsWith('image') || encType.startsWith('audio') || encType.startsWith('video')) {
      const type = encType.startsWith('image')
        ? 'photo' as const
        : encType.startsWith('video')
          ? 'video' as const
          : 'audio' as const
      media.push({
        url: item.enclosure.url,
        type,
        mimeType: encType || undefined,
        durationInSeconds: item.enclosure.length ? Number(item.enclosure.length) : undefined,
      })
    }
  }
  // media:content
  const mc = item['media:content']
  if (mc?.url && typeof mc.url === 'string') {
    const medium = mc.medium || mc.type || ''
    const type = medium.startsWith('image') || medium === 'photo'
      ? 'photo' as const
      : medium.startsWith('video')
        ? 'video' as const
        : medium.startsWith('audio')
          ? 'audio' as const
          : 'photo' as const
    media.push({
      url: mc.url,
      type,
      width: mc.width ? Number(mc.width) : undefined,
      height: mc.height ? Number(mc.height) : undefined,
      mimeType: mc.type || undefined,
    })
  }
  // media:thumbnail 作为 previewImageUrl
  const mt = item['media:thumbnail']
  if (mt?.url && typeof mt.url === 'string' && media.length > 0) {
    media[0].previewImageUrl = mt.url
  }
  return media
}
