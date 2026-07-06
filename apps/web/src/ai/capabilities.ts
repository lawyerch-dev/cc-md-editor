/**
 * AI Capability Registry
 *
 * Centralises prompt construction and metadata for every AI-powered feature.
 * Each capability declares its model type, streaming mode, and a `buildPrompt`
 * function that turns caller-supplied records into chat messages.
 */

import type { ModelRole } from '@md/shared/types'
import { DEFAULT_SERVICE_TEMPERATURE } from '@md/shared/constants'

// ── Types ───────────────────────────────────────────────

export interface AICapability {
  /** Unique identifier, e.g. `'core.summarize'` */
  id: string
  /** Model role: `'reasoning'` | `'fast'` | `'vision'` | `'image'` */
  role: ModelRole
  /** Response mode: `'stream'` (SSE deltas) | `'json'` (single response) */
  mode: `stream` | `json`
  /** Declares expected input fields (informational, for UI/validation) */
  inputSpec: string[]
  /** Declares output shape (informational) */
  outputSpec: string[]
  /**
   * Build the payload record to send to the AI endpoint.
   *
   * - For `mode: 'stream'` / `'json'` with `role: 'fast'` | `'reasoning'` | `'vision'`:
   *   returns `{ messages, temperature?, max_tokens?, stream?, ... }`.
   *
   * - For `role: 'image'`:
   *   returns `{ prompt, size, n, ... }`.
   */
  buildPrompt: (input: Record<string, unknown>) => Record<string, unknown>
  /** Sampling temperature (0 – 2). */
  temperature: number
}

// ── Registry ────────────────────────────────────────────

const registry = new Map<string, AICapability>()

/** Register a capability (overwrites if id already exists). */
export function register(cap: AICapability): void {
  registry.set(cap.id, cap)
}

/** Look up a capability by id. */
export function get(id: string): AICapability | undefined {
  return registry.get(id)
}

/** Return every registered capability. */
export function getAllCapabilities(): AICapability[] {
  return [...registry.values()]
}

// ── Pre-registered capabilities ─────────────────────────

register({
  id: `core.summarize`,
  role: 'fast',
  mode: `stream`,
  inputSpec: [`content: string`, `title?: string`, `userProfile?: string`],
  outputSpec: [`summary: string (markdown bullet points)`],
  temperature: 0.3,
  buildPrompt(input) {
    const content = String(input.content ?? ``).slice(0, 4000)
    const title = input.title ? `标题：${input.title}\n\n` : ``
    const profileSuffix = input.userProfile ? `\n\n${input.userProfile}` : ``
    return {
      messages: [
        {
          role: `system`,
          content: `你是一个专业的文章摘要助手。请用简洁的中文总结文章的核心要点，使用 bullet points 格式。不超过 5 条。${profileSuffix}`,
        },
        {
          role: `user`,
          content: `${title}正文：${content}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: true,
    }
  },
})

register({
  id: `core.translate`,
  role: 'fast',
  mode: `stream`,
  inputSpec: [`content: string`, `targetLang: string`, `userProfile?: string`],
  outputSpec: [`translation: string`],
  temperature: 0.3,
  buildPrompt(input) {
    const content = String(input.content ?? ``)
    const langName = String(input.targetLang ?? `English`)
    const profileSuffix = input.userProfile ? `\n\n${input.userProfile}` : ``
    return {
      messages: [
        {
          role: `system`,
          content: `翻译成${langName}，只输出翻译结果，不要解释。${profileSuffix}`,
        },
        {
          role: `user`,
          content,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      stream: true,
    }
  },
})

register({
  id: `core.polish`,
  role: 'fast',
  mode: `stream`,
  inputSpec: [`content: string`, `prompt?: string`],
  outputSpec: [`polished: string`],
  temperature: 0.4,
  buildPrompt(input) {
    const content = String(input.content ?? ``)
    const overridePrompt = input.prompt ? String(input.prompt) : null
    return {
      messages: [
        {
          role: `system`,
          content: overridePrompt ?? `你是一个专业的文本润色助手。请对以下文本进行润色，保持原意，提升表达质量和流畅度。直接输出润色后的文本，不要解释。`,
        },
        {
          role: `user`,
          content,
        },
      ],
      temperature: 0.4,
      max_tokens: 4096,
      stream: true,
    }
  },
})

register({
  id: `reading.annotate`,
  role: 'fast',
  mode: `stream`,
  inputSpec: [`text: string`, `articleTitle?: string`, `articleContent?: string`],
  outputSpec: [`annotation: string (concise commentary)`],
  temperature: 0.3,
  buildPrompt(input) {
    const text = String(input.text ?? ``)
    const articleTitle = input.articleTitle ? `\n文章标题：${input.articleTitle}` : ``
    const articleContent = input.articleContent
      ? `\n文章上下文：${String(input.articleContent).slice(0, 2000)}`
      : ``
    return {
      messages: [
        {
          role: `system`,
          content: `你是一个专业的阅读批注助手。用户选中了一段文字，请提供简洁的批注和解读，帮助用户深入理解内容。输出不超过 3 句话。`,
        },
        {
          role: `user`,
          content: `选中的文字：${text}${articleTitle}${articleContent}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      stream: true,
    }
  },
})

register({
  id: `reading.insight`,
  role: 'reasoning',
  mode: `stream`,
  inputSpec: [`content: string`, `title?: string`],
  outputSpec: [`insights: string (markdown list)`],
  temperature: 0.4,
  buildPrompt(input) {
    const content = String(input.content ?? ``).slice(0, 6000)
    const title = input.title ? `标题：${input.title}\n\n` : ``
    return {
      messages: [
        {
          role: `system`,
          content: `你是一个深度阅读分析师。请从以下文章中提取关键洞察和深层含义，包括：1) 核心论点，2) 隐含假设，3) 与当前趋势的关联，4) 可能的行动建议。用简洁的 bullet points 输出。`,
        },
        {
          role: `user`,
          content: `${title}正文：${content}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
      stream: true,
    }
  },
})

register({
  id: `collector.generateSelectors`,
  role: 'fast',
  mode: `json`,
  inputSpec: [`url: string`, `html: string`, `description: string`],
  outputSpec: [`selectors: CollectorSelectors (JSON)`],
  temperature: DEFAULT_SERVICE_TEMPERATURE,
  buildPrompt(input) {
    const url = String(input.url ?? ``)
    const html = String(input.html ?? ``)
    const description = String(input.description ?? ``)
    return {
      messages: [
        {
          role: `system`,
          content: `你是一个网页数据采集专家。用户会给你一个网页的 HTML 结构和采集需求，你需要输出 CSS 选择器来提取数据。

输出格式为 JSON：
{
  "item": "列表项选择器",
  "title": "标题选择器（相对于 item）",
  "link": "链接选择器（相对于 item，可选）",
  "content": "内容选择器（相对于 item，可选）",
  "image": "图片选择器（相对于 item，可选）",
  "date": "日期选择器（相对于 item，可选）",
  "author": "作者选择器（相对于 item，可选）"
}

注意：
- 所有选择器都应该是相对于 item 的后代选择器
- 只输出 JSON，不要解释`,
        },
        {
          role: `user`,
          content: `目标网页：${url}\n采集需求：${description}\n\n页面 HTML 结构：\n${html}`,
        },
      ],
      temperature: DEFAULT_SERVICE_TEMPERATURE,
      max_tokens: 1000,
      stream: false,
    }
  },
})

register({
  id: `image.generate`,
  role: 'image',
  mode: `json`,
  inputSpec: [`prompt: string`, `size?: string`],
  outputSpec: [`images: Array<{ url: string }> (JSON)`],
  temperature: DEFAULT_SERVICE_TEMPERATURE,
  buildPrompt(input) {
    const prompt = String(input.prompt ?? ``)
    const size = String(input.size ?? `1024x1024`)
    return {
      prompt,
      size,
      n: 1,
    }
  },
})
