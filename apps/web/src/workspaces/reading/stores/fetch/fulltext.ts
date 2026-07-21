// @workspace reading

import { extractArticle, extractArticleFallback } from '../../utils/extractArticle'
import { fetchPageHTML } from './proxy'

// ── 全文提取 ───────────────────────────────────────────

/** 从文章链接获取完整正文 */
export async function fetchFullText(url: string): Promise<string> {
  const html = await fetchPageHTML(url)
  // 优先使用 Readability 提取
  const readabilityContent = extractArticle(html, url)
  if (readabilityContent && readabilityContent.replace(/<[^>]*>/g, '').trim().length > 200)
    return readabilityContent
  // 兜底：常见选择器 + body 最长子元素
  return extractArticleFallback(html)
}
