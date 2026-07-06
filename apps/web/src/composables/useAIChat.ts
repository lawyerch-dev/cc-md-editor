/**
 * useAIChat — 核心聊天逻辑 composable
 * 提取消息管理、SSE 流式、输入历史、持久化
 * UI 组件只需提供 scrollTarget ref 和 callbacks
 */

import type { Ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { nextTick, ref } from 'vue'
import { useAIFetch } from '@/composables/useAIFetch'
import { store } from '@/storage'
import { useAIStore } from '@/stores/ai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  done?: boolean
  timestamp?: number
}

interface UseAIChatOptions {
  /** localStorage key for message persistence */
  memoryKey: string
  /** Default messages to show on init (e.g. welcome message) */
  defaultMessages?: () => ChatMessage[]
  /** Ref to scrollable container for auto-scroll */
  scrollTarget?: Ref<HTMLElement | null>
  /** Extra system messages (presets, editor content, etc.) */
  getSystemMessages?: () => Array<{ role: 'system', content: string }>
}

export function useAIChat(options: UseAIChatOptions) {
  const aiStore = useAIStore()
  const { fetchSSE, abort: abortFetch, loading } = useAIFetch()

  const messages = ref<ChatMessage[]>([])
  const input = ref('')
  const inputHistory = ref<string[]>([])
  const inputHistoryIndex = ref(-1)
  const isStreaming = ref(false)

  // ── Init: load from storage or use defaults ──
  async function init() {
    const saved = await store.getJSON<ChatMessage[]>(options.memoryKey, [])
    if (saved.length > 0) {
      messages.value = saved
    }
    else if (options.defaultMessages) {
      messages.value = options.defaultMessages()
    }
  }

  // ── Scroll ──
  async function scrollToBottom(force = false) {
    await nextTick()
    const el = options.scrollTarget?.value
    if (el && (force || el.scrollHeight - el.scrollTop - el.clientHeight < 200))
      el.scrollTop = el.scrollHeight
  }

  // ── Stream response from AI ──
  async function streamResponse(replyMessage: ChatMessage, extraMessages: ChatMessage[] = []) {
    isStreaming.value = true

    const contextHistory = messages.value
      .slice(-12)
      .filter((msg, idx, arr) =>
        !(idx === arr.length - 1 && msg.role === 'assistant' && !msg.done)
        && !(idx === 0 && msg.role === 'assistant'),
      )

    const systemMessages = options.getSystemMessages?.() ?? []

    const payload = {
      model: aiStore.textModel,
      messages: [
        ...systemMessages,
        ...extraMessages,
        ...contextHistory,
      ],
      temperature: aiStore.temperature,
      max_tokens: aiStore.maxToken,
      stream: true,
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (aiStore.textApiKey && aiStore.textType !== 'default')
      headers.Authorization = `Bearer ${aiStore.textApiKey}`

    const endpoint = aiStore.textEndpoint.replace(/\/+$/, '')
    const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`

    try {
      await fetchSSE(url, headers, payload, {
        onDelta(content) {
          const last = messages.value[messages.value.length - 1]
          if (last.id !== replyMessage.id)
            return
          last.content += content
          scrollToBottom()
        },
        onReasoningDelta(reasoning) {
          const last = messages.value[messages.value.length - 1]
          if (last.id !== replyMessage.id)
            return
          last.reasoning = (last.reasoning || '') + reasoning
          scrollToBottom()
        },
        onDone() {
          const last = messages.value[messages.value.length - 1]
          if (last.id === replyMessage.id && last.role === 'assistant') {
            if (!last.content && !last.reasoning)
              last.content = '(AI 未返回内容)'
            last.done = true
            scrollToBottom(true)
          }
        },
      })
    }
    catch (e) {
      const last = messages.value[messages.value.length - 1]
      if (last.id === replyMessage.id)
        last.content = `请求失败: ${(e as Error).message}`
      await scrollToBottom(true)
    }
    finally {
      isStreaming.value = false
      await persist()
    }
  }

  // ── Send message ──
  async function send(text?: string) {
    const userInput = (text ?? input.value).trim()
    if (!userInput || loading.value)
      return

    inputHistory.value.push(userInput)
    inputHistoryIndex.value = -1
    input.value = ''

    messages.value.push({
      id: uuidv4(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    })

    const replyMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      done: false,
      timestamp: Date.now(),
    }
    messages.value.push(replyMessage)
    await scrollToBottom(true)
    await streamResponse(replyMessage)
  }

  // ── Regenerate last AI response ──
  async function regenerate() {
    if (loading.value || isStreaming.value)
      return
    const lastAssistant = [...messages.value].reverse().find(m => m.role === 'assistant')
    if (lastAssistant) {
      lastAssistant.content = ''
      lastAssistant.reasoning = ''
      lastAssistant.done = false
      await streamResponse(lastAssistant)
    }
  }

  // ── Recall a message (put back in input) ──
  function recall(msg: ChatMessage, index: number) {
    if (index + 1 < messages.value.length && messages.value[index + 1].role === 'assistant')
      messages.value.splice(index + 1, 1)
    messages.value.splice(index, 1)
    input.value = msg.content
    persist()
  }

  // ── Reset all messages ──
  async function reset() {
    abortFetch()
    messages.value = options.defaultMessages?.() ?? []
    await persist()
  }

  // ── Stop streaming ──
  function stop() {
    abortFetch()
    isStreaming.value = false
  }

  // ── Persist to storage ──
  async function persist() {
    await store.setJSON(options.memoryKey, messages.value)
  }

  // ── Input history navigation ──
  function historyUp() {
    if (inputHistory.value.length === 0)
      return
    if (inputHistoryIndex.value === -1)
      inputHistoryIndex.value = inputHistory.value.length - 1
    else if (inputHistoryIndex.value > 0)
      inputHistoryIndex.value--
    input.value = inputHistory.value[inputHistoryIndex.value] ?? ''
  }

  function historyDown() {
    if (inputHistoryIndex.value === -1)
      return
    inputHistoryIndex.value++
    if (inputHistoryIndex.value >= inputHistory.value.length) {
      inputHistoryIndex.value = -1
      input.value = ''
    }
    else {
      input.value = inputHistory.value[inputHistoryIndex.value] ?? ''
    }
  }

  // Initialize
  init()

  return {
    // State
    messages,
    input,
    loading,
    isStreaming,
    // Actions
    send,
    regenerate,
    recall,
    reset,
    stop,
    persist,
    // Scroll
    scrollToBottom,
    // Input history
    historyUp,
    historyDown,
  }
}
