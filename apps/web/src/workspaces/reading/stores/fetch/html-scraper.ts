// @workspace reading
import type { Article, CollectorSelectors } from '../../types'

import { generateArticleId, generateContentHash } from '../../utils/articleId'
import { fetchPageHTML } from './proxy'

// ── HTML 采集 ──────────────────────────────────────────

/** 噪音关键词 — 导航、页脚、通用链接文本 */
const NOISE_PATTERNS = /^(?:首页|登录|注册|关于|联系我们|网站地图|首页导航|English|中文版|登录邮箱系统|公报|导航|更多|返回|下载|APP|客户端|微信|微博|RSS|订阅)$/i

/** 用 CSS 选择器从 HTML 中提取文章列表 */
export async function parseHTMLWithSelectors(html: string, selectors: CollectorSelectors, sourceId: string, sourceTitle: string, baseUrl = ''): Promise<Article[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const items = doc.querySelectorAll(selectors.item)
  const articles: Article[] = []

  for (let i = 0; i < items.length; i++) {
    const el = items[i]
    const titleEl = selectors.title ? el.querySelector(selectors.title) : null
    const linkEl = selectors.link ? el.querySelector(selectors.link) : null
    const summaryEl = selectors.summary ? el.querySelector(selectors.summary) : null
    const authorEl = selectors.author ? el.querySelector(selectors.author) : null
    const dateEl = selectors.date ? el.querySelector(selectors.date) : null

    const title = titleEl?.textContent?.trim() || el.textContent?.trim() || ''
    // 过滤噪音：太短的标题、纯数字、导航关键词
    if (!title || title.length < 4)
      continue
    if (/^\d+$/.test(title))
      continue
    if (NOISE_PATTERNS.test(title))
      continue

    const href = linkEl?.getAttribute('href') || (el as HTMLAnchorElement).getAttribute('href') || ''
    let link = ''
    if (href.startsWith('http')) {
      link = href
    }
    else if (href.startsWith('/') && baseUrl) {
      try { link = new URL(href, baseUrl).href }
      catch { /* ignore */ }
    }
    // CSS 采集只提取标题和链接，不存全文
    // 用户点击文章后由 ArticleReader 通过 fetchFullText 懒加载
    const content = ''
    const summary = summaryEl?.textContent?.trim() || ''
    const author = authorEl?.textContent?.trim() || ''
    const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || ''
    const publishedAt = dateStr ? new Date(dateStr).getTime() || Date.now() - i * 60000 : Date.now() - i * 60000
    const id = await generateArticleId(sourceId, link, publishedAt)
    const contentHash = await generateContentHash(title, summary)

    articles.push({
      id,
      sourceId,
      sourceTitle,
      title,
      link,
      content,
      summary,
      author,
      publishedAt,
      read: false,
      starred: false,
      media: [],
      attachments: [],
      contentHash,
    })
  }

  return articles
}

/** 预览 CSS 选择器采集结果（不保存） */
export async function previewSelectors(url: string, selectors: CollectorSelectors): Promise<Article[]> {
  const html = await fetchPageHTML(url)
  return parseHTMLWithSelectors(html, selectors, 'preview', '', url)
}
