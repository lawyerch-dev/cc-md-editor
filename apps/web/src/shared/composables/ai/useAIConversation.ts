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
  /** 消息是否已完成流式接收 */
  done?: boolean
}

/**
 * AI 会话管理。
 *
 * 支持：
 * - 消息历史维护 + 可选持久化
 * - 发送用户消息时自动附加上下文
 * - 流式接收助手回复
 * - 输入历史（上下翻找）
 * - 消息编辑 + 重新生成
 * - action 执行（通过 adapter 分派）
 */
export function useAIConversation(opts?: {
  systemPrompt?: string | ComputedRef<string>
  /** 是否自动附加工作区上下文 */
  includeContext?: boolean
  /** 持久化 key（传入后自动保存/加载消息） */
  persistenceKey?: string
  /** 额外上下文构建（在标准上下文之后追加） */
  buildExtraContext?: () => Promise<AIMessage[]>
}) {
  const ai = useAI()
  const { collectContext, executeAction } = useAIContext()
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const inputHistory = ref<string[]>([])
  const historyIndex = ref<number | null>(null)

  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  // ── 持久化 ──────────────────────────────────────────────
  async function loadPersisted() {
    if (!opts?.persistenceKey)
      return
    try {
      const { store } = await import('@/storage')
      const saved = await store.getJSON<ChatMessage[]>(opts.persistenceKey, [])
      if (saved.length > 0)
        messages.value = saved
    }
    catch { /* ignore */ }
  }

  async function persist() {
    if (!opts?.persistenceKey)
      return
    try {
      const { store } = await import('@/storage')
      await store.setJSON(opts.persistenceKey, messages.value)
    }
    catch { /* ignore */ }
  }

  // 初始化时加载
  if (opts?.persistenceKey) {
    loadPersisted()
  }

  // ── 构建消息 ────────────────────────────────────────────
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

    // 额外上下文
    if (opts?.buildExtraContext) {
      const extra = await opts.buildExtraContext()
      result.push(...extra)
    }

    // 历史消息（取最近 12 条，过滤掉未完成的 assistant 消息）
    const history = messages.value
      .filter(m => !(m.role === 'assistant' && !m.done && m.content === ''))
      .slice(-12)
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        result.push({ role: msg.role, content: msg.content })
      }
    }

    // 当前用户消息
    result.push({ role: 'user', content: userMessage })

    return result
  }

  // ── 发送 ────────────────────────────────────────────────
  async function send(userMessage: string): Promise<string> {
    messages.value.push({
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    })

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      done: false,
      timestamp: Date.now(),
    }
    messages.value.push(assistantMsg)
    isStreaming.value = true

    try {
      const aiMessages = await buildMessages(userMessage)
      await ai.askStream({
        messages: aiMessages,
        onToken: (token) => {
          assistantMsg.content += token
        },
        onReasoningToken: (token) => {
          assistantMsg.reasoning = (assistantMsg.reasoning || '') + token
        },
        onDone: () => {
          assistantMsg.done = true
        },
      })
      await persist()
      return assistantMsg.content
    }
    catch (err) {
      assistantMsg.content += `\n\n⚠️ ${err instanceof Error ? err.message : '请求失败'}`
      assistantMsg.done = true
      await persist()
      throw err
    }
    finally {
      isStreaming.value = false
    }
  }

  // ── 编辑消息并重新发送 ──────────────────────────────────
  async function editAndResend(messageId: string, newContent: string): Promise<string> {
    const idx = messages.value.findIndex(m => m.id === messageId)
    if (idx === -1)
      return send(newContent)

    // 替换用户消息内容
    messages.value[idx].content = newContent

    // 移除该消息之后的 assistant 回复
    if (idx + 1 < messages.value.length && messages.value[idx + 1].role === 'assistant') {
      messages.value.splice(idx + 1, 1)
    }

    // 重新发送
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      done: false,
      timestamp: Date.now(),
    }
    // 插入到用户消息之后
    messages.value.splice(idx + 1, 0, assistantMsg)
    isStreaming.value = true

    try {
      // 构建消息时排除当前编辑的消息和新 assistant 占位
      const historyForAI = messages.value
        .filter(m => m.id !== assistantMsg.id && m.id !== messageId)
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.done))
        .slice(-12)

      const sysPrompt = unref(opts?.systemPrompt)
      const aiMessages: AIMessage[] = []
      if (sysPrompt)
        aiMessages.push({ role: 'system', content: sysPrompt })

      if (opts?.includeContext !== false) {
        const ctx = await collectContext()
        const ctxParts: string[] = []
        if (ctx.selectedText)
          ctxParts.push(`用户选中的文本：\n${ctx.selectedText}`)
        if (ctx.documentContent)
          ctxParts.push(`当前文档内容：\n${ctx.documentContent}`)
        if (ctxParts.length > 0)
          aiMessages.push({ role: 'system', content: ctxParts.join('\n\n') })
      }

      for (const msg of historyForAI) {
        aiMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
      aiMessages.push({ role: 'user', content: newContent })

      await ai.askStream({
        messages: aiMessages,
        onToken: (token) => { assistantMsg.content += token },
        onReasoningToken: (token) => { assistantMsg.reasoning = (assistantMsg.reasoning || '') + token },
        onDone: () => { assistantMsg.done = true },
      })
      await persist()
      return assistantMsg.content
    }
    catch (err) {
      assistantMsg.content += `\n\n⚠️ ${err instanceof Error ? err.message : '请求失败'}`
      assistantMsg.done = true
      await persist()
      throw err
    }
    finally {
      isStreaming.value = false
    }
  }

  // ── 重新生成最后一条回复 ────────────────────────────────
  async function regenerate(): Promise<string | undefined> {
    if (isStreaming.value)
      return

    // 找到最后一条 assistant 消息
    const lastAssistant = [...messages.value].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant)
      return

    // 找到它之前的 user 消息
    const assistantIdx = messages.value.findIndex(m => m.id === lastAssistant.id)
    const userMsg = assistantIdx > 0 ? messages.value[assistantIdx - 1] : null

    // 重置 assistant 消息
    lastAssistant.content = ''
    lastAssistant.reasoning = ''
    lastAssistant.done = false

    isStreaming.value = true
    try {
      // 构建消息（排除当前 assistant）
      const historyForAI = messages.value
        .filter(m => m.id !== lastAssistant.id)
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.done))
        .slice(-12)

      const sysPrompt = unref(opts?.systemPrompt)
      const aiMessages: AIMessage[] = []
      if (sysPrompt)
        aiMessages.push({ role: 'system', content: sysPrompt })

      if (opts?.includeContext !== false) {
        const ctx = await collectContext()
        const ctxParts: string[] = []
        if (ctx.selectedText)
          ctxParts.push(`用户选中的文本：\n${ctx.selectedText}`)
        if (ctx.documentContent)
          ctxParts.push(`当前文档内容：\n${ctx.documentContent}`)
        if (ctxParts.length > 0)
          aiMessages.push({ role: 'system', content: ctxParts.join('\n\n') })
      }

      for (const msg of historyForAI) {
        aiMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
      if (userMsg)
        aiMessages.push({ role: 'user', content: userMsg.content })

      await ai.askStream({
        messages: aiMessages,
        onToken: (token) => { lastAssistant.content += token },
        onReasoningToken: (token) => { lastAssistant.reasoning = (lastAssistant.reasoning || '') + token },
        onDone: () => { lastAssistant.done = true },
      })
      await persist()
      return lastAssistant.content
    }
    catch (err) {
      lastAssistant.content += `\n\n⚠️ ${err instanceof Error ? err.message : '请求失败'}`
      lastAssistant.done = true
      await persist()
      throw err
    }
    finally {
      isStreaming.value = false
    }
  }

  // ── 输入历史 ────────────────────────────────────────────
  function pushInputHistory(text: string) {
    inputHistory.value.push(text)
    historyIndex.value = null
  }

  function navigateHistory(direction: 'up' | 'down', currentInput: string): string {
    if (direction === 'up') {
      if (inputHistory.value.length === 0)
        return currentInput
      historyIndex.value = historyIndex.value === null
        ? inputHistory.value.length - 1
        : Math.max(0, historyIndex.value - 1)
      return inputHistory.value[historyIndex.value]
    }
    else {
      if (historyIndex.value === null)
        return currentInput
      historyIndex.value++
      if (historyIndex.value >= inputHistory.value.length) {
        historyIndex.value = null
        return ''
      }
      return inputHistory.value[historyIndex.value]
    }
  }

  // ── 其他操作 ────────────────────────────────────────────
  function applyAction(msg: ChatMessage): Promise<boolean> {
    if (!msg.action)
      return Promise.resolve(false)
    return executeAction(msg.action)
  }

  function abort() {
    ai.abort()
    isStreaming.value = false
  }

  async function clear() {
    messages.value = []
    await persist()
  }

  async function removeMessage(id: string) {
    messages.value = messages.value.filter(m => m.id !== id)
    await persist()
  }

  function getGreeting(text: string): ChatMessage {
    return {
      id: generateId(),
      role: 'assistant',
      content: text,
      done: true,
      timestamp: Date.now(),
    }
  }

  return {
    messages,
    isStreaming: readonly(isStreaming),
    inputHistory: readonly(inputHistory),
    send,
    editAndResend,
    regenerate,
    pushInputHistory,
    navigateHistory,
    applyAction,
    abort,
    clear,
    removeMessage,
    loadPersisted,
    getGreeting,
  }
}
