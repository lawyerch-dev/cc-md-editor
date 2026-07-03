import type { Context } from '@netlify/functions'

/** 噪音标签 — 导航、脚本、样式、广告等 */
const NOISE_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe']

/** 噪音 class/id 关键词 */
const _NOISE_SELECTORS = [
  '.ad',
  '.advertisement',
  '.sidebar',
  '.comment',
  '.nav',
  '.menu',
  '.header',
  '.footer',
  '.sidebar',
  '.related',
  '.recommend',
  '.toolbar',
]

/** 正文候选选择器（按优先级） */
const CONTENT_SELECTORS = [
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
  '.news-content',
  '[class*="article"]',
  '[class*="content"]',
  '[class*="detail"]',
  '.main-content',
  '#main-content',
  '.page-content',
]

/**
 * 从 HTML 中提取正文内容（服务端纯字符串处理，不依赖 DOM）。
 * 策略：先剥离噪音标签，再按选择器优先级提取，最后回退到最大文本块。
 */
function extractContent(html: string): string {
  // 1. 剥离噪音标签及其内容
  let cleaned = html
  for (const tag of NOISE_TAGS) {
    cleaned = cleaned.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '')
  }
  // 剥离 HTML 注释
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // 2. 按选择器提取（基于 class/id 属性匹配）
  for (const sel of CONTENT_SELECTORS) {
    let pattern: RegExp
    if (sel.startsWith('.')) {
      // class 选择器
      pattern = new RegExp(
        `<[^>]*class="[^"]*\\b${sel.slice(1)}\\b[^"]*"[^>]*>([\\s\\S]*?)</[^>]+>`,
        'i',
      )
    }
    else if (sel.startsWith('#')) {
      // id 选择器
      pattern = new RegExp(
        `<[^>]*id="${sel.slice(1)}"[^>]*>([\\s\\S]*?)</[^>]+>`,
        'i',
      )
    }
    else if (sel.startsWith('[')) {
      // 属性选择器 [class*="xxx"]
      const match = sel.match(/\[class\*="([^"]+)"\]/)
      if (match) {
        pattern = new RegExp(
          `<[^>]*class="[^"]*${match[1]}[^"]*"[^>]*>([\\s\\S]*?)</[^>]+>`,
          'i',
        )
      }
      else {
        continue
      }
    }
    else {
      // 标签选择器
      pattern = new RegExp(
        `<${sel}[^>]*>([\\s\\S]*?)</${sel}>`,
        'i',
      )
    }

    const m = cleaned.match(pattern)
    if (m?.[1] && stripTags(m[1]).trim().length > 200) {
      return m[1]
    }
  }

  // 3. 回退：找 <body> 内最大的文本块
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch?.[1] || cleaned

  // 按块级标签分段，取最长的
  const blocks = body.split(/<\/(?:div|section|main|article)>/i)
  let best = ''
  let maxLen = 0
  for (const block of blocks) {
    const text = stripTags(block).trim()
    if (text.length > maxLen) {
      maxLen = text.length
      best = block
    }
  }
  return best || body
}

/** 去除 HTML 标签，返回纯文本 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let url: string
  try {
    const body = await req.json() as Record<string, unknown>
    if (typeof body.url !== 'string' || !body.url) {
      return Response.json({ ok: false, error: 'Missing or invalid url' }, { status: 400 })
    }
    url = body.url
  }
  catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // 先尝试国内代理
    const PROXY_URL = 'https://proxy.new-ai.cn'
    const PROXY_TOKEN = 'ccmd2024proxy'
    let res: Response
    try {
      res = await fetch(`${PROXY_URL}/${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(7_000),
        headers: { 'X-Proxy-Token': PROXY_TOKEN },
      })
    }
    catch {
      // 降级到直连
      res = await fetch(url, {
        signal: AbortSignal.timeout(7_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; md-editor/1.0)',
          'Accept': 'text/html, */*',
        },
      })
    }

    if (!res.ok) {
      return Response.json({ ok: false, error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const html = await res.text()
    const content = extractContent(html)

    return Response.json({ ok: true, content })
  }
  catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'Fetch timed out (10s)'
      : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
