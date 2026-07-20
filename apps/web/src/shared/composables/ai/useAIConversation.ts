// @workspace shared
import type { ActionResult, AIMessage } from './types'
import { useAI } from './useAI'
import { useAIContext } from './useAIContext'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  timestamp: number
  /** AI 产出的结构化结果（可由用户确认后执行） */
  action?: ActionResult
}

/**
 * AI 会话管理。
 *
 * 负责：
 * - 消息历史维护
 * - 发送用户消息时自动附加上下文
 * - 流式接收助手回复
 * - action 执行（通过 adapter 分派）
 */
export function useAIConversation(opts?: {
  systemPrompt?: string | ComputedRef<string>
  /** 是否自动附加工作区上下文 */
  includeContext?: boolean
}) {
  const ai = useAI()
  const { collectContext, executeAction } = useAIContext()
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)

  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /** 构建发送给 AI 的消息列表 */
  async function buildMessages(userMessage: string): Promise<AIMessage[]> {
    const result: AIMessage[] = []

    // 系统提示
    const sysPrompt = unref(opts?.systemPrompt)
    if (sysPrompt) {
      result.push({ role: 'system', content: sysPrompt })
    }

    // 工作区上下文
    if (opts?.includeContext !== false) {
      const ctx = await collectContext()
      const ctxParts: string[] = []
      if (ctx.selectedText)
        ctxParts.push(`用户选中的文本：\n${ctx.selectedText}`)
      if (ctx.documentContent)
        ctxParts.push(`当前文档内容：\n${ctx.documentContent}`)
      if (ctx.metadata) {
        const meta = Object.entries(ctx.metadata)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n')
        if (meta)
          ctxParts.push(`附加信息：\n${meta}`)
      }
      if (ctxParts.length > 0) {
        result.push({ role: 'system', content: ctxParts.join('\n\n') })
      }
    }

    // 历史消息
    for (const msg of messages.value) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        result.push({ role: msg.role, content: msg.content })
      }
    }

    // 当前用户消息
    result.push({ role: 'user', content: userMessage })

    return result
  }

  /** 发送用户消息，流式接收回复 */
  async function send(userMessage: string): Promise<string> {
    // 添加用户消息
    messages.value.push({
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    })

    // 添加助手占位消息
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      timestamp: Date.now(),
    }
    messages.value.push(assistantMsg)
    isStreaming.value = true

    try {
      const aiMessages = await buildMessages(userMessage)
      const fullText = await ai.askStream({
        messages: aiMessages,
        onToken: (token) => {
          assistantMsg.content += token
        },
        onReasoningToken: (token) => {
          assistantMsg.reasoning = (assistantMsg.reasoning || '') + token
        },
      })
      return fullText
    }
    catch (err) {
      assistantMsg.content += `\n\n⚠️ ${err instanceof Error ? err.message : '请求失败'}`
      throw err
    }
    finally {
      isStreaming.value = false
    }
  }

  /** 执行助手消息中的 action */
  async function applyAction(msg: ChatMessage): Promise<boolean> {
    if (!msg.action)
      return false
    return executeAction(msg.action)
  }

  /** 中断当前流式请求 */
  function abort() {
    ai.abort()
    isStreaming.value = false
  }

  /** 清空对话历史 */
  function clear() {
    messages.value = []
  }

  /** 删除单条消息 */
  function removeMessage(id: string) {
    messages.value = messages.value.filter(m => m.id !== id)
  }

  return {
    messages: readonly(messages),
    isStreaming: readonly(isStreaming),
    send,
    applyAction,
    abort,
    clear,
    removeMessage,
  }
}
