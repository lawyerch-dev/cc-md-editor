import CryptoJS from 'crypto-js'

/**
 * 对 URL 做规范化：移除追踪参数、统一协议、去除尾部斜杠
 */
export function normalizeUrl(url: string): string {
  if (!url)
    return ''
  try {
    const u = new URL(url)
    // 移除常见追踪参数
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ttclid']
    for (const p of trackingParams)
      u.searchParams.delete(p)
    u.hash = ''
    // 去除尾部斜杠，但保留根路径
    let pathname = u.pathname
    if (pathname.length > 1 && pathname.endsWith('/'))
      pathname = pathname.slice(0, -1)
    u.pathname = pathname
    return u.toString().toLowerCase()
  }
  catch {
    return url.trim().toLowerCase()
  }
}

function sha256Short(input: string, length = 16): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex).slice(0, length)
}

/**
 * 生成稳定文章 ID
 * 基于 sourceId + 规范化 link + publishedAt，碰撞率极低
 */
export function generateArticleId(sourceId: string, link: string, publishedAt: number): string {
  const normalizedLink = normalizeUrl(link)
  const input = `${sourceId}|${normalizedLink}|${publishedAt}`
  return `art-${sha256Short(input)}`
}

/**
 * 生成内容指纹，用于跨源/跨策略去重
 */
export function generateContentHash(title: string, summary: string): string {
  const input = `${title.trim().toLowerCase()}|${summary.trim().toLowerCase().slice(0, 200)}`
  return sha256Short(input)
}

/**
 * 判断 ID 是否为新版格式（以 art- 开头 + 16 位哈希）
 */
export function isNewArticleId(id: string): boolean {
  return /^art-[a-f0-9]{16}$/.test(id)
}
