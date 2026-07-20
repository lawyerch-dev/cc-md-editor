// @workspace shared
import type { AIAskOptions, AIMessage } from './types'
import { buildAIHeaders, resolveEndpointUrl, useAIFetch } from '@/shared/composables/useAIFetch'
import { useAIConfigStore } from '@/shared/stores/aiConfig'

/**
 * 统一 AI 调用入口。
 *
 * 封装 useAIFetch + aiConfigStore，提供 askStream / askJSON 两个高级方法，
 * 消除各组件重复的 header 构建、endpoint 解析、config 读取逻辑。
 */
export function useAI() {
  const config = useAIConfigStore()
  const { fetchSSE, fetchJSON, abort, loading } = useAIFetch()

  function getModelConfig(model: 'text' | 'vision' = 'text') {
    if (model === 'vision') {
      return {
        endpoint: config.visionEndpoint,
        model: config.visionModel,
        apiKey: config.visionApiKey,
        serviceType: config.visionType,
      }
    }
    return {
      endpoint: config.textEndpoint,
      model: config.textModel,
      apiKey: config.textApiKey,
      serviceType: config.textType,
    }
  }

  /** 流式调用（对话/生成/续写） */
  async function askStream(options: AIAskOptions): Promise<string> {
    const { messages, model = 'text', onToken, onReasoningToken, onDone, onError } = options
    const mc = getModelConfig(model)

    const url = resolveEndpointUrl(mc.endpoint, 'chat')
    const headers = buildAIHeaders(mc.apiKey, mc.serviceType)

    let fullText = ''

    try {
      await fetchSSE(
        url,
        headers,
        {
          model: mc.model,
          messages,
          stream: true,
          temperature: config.temperature,
          max_tokens: config.maxToken,
        },
        {
          onDelta: (content) => {
            fullText += content
            onToken?.(content)
          },
          onReasoningDelta: (reasoning) => {
            onReasoningToken?.(reasoning)
          },
          onDone: () => {
            onDone?.(fullText)
          },
        },
      )
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error)
      throw error
    }

    return fullText
  }

  /** 非流式调用（分析/提取/结构化输出） */
  async function askJSON<T = unknown>(
    messages: AIMessage[],
    model: 'text' | 'vision' = 'text',
  ): Promise<T> {
    const mc = getModelConfig(model)
    const url = resolveEndpointUrl(mc.endpoint, 'chat')
    const headers = buildAIHeaders(mc.apiKey, mc.serviceType)

    const resp = await fetchJSON<T>(
      url,
      headers,
      {
        model: mc.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxToken,
      },
    )

    if (!resp.ok || !resp.data) {
      throw new Error(resp.errorText || `AI request failed: ${resp.status}`)
    }

    // 兼容 OpenAI 格式：提取 choices[0].message.content
    const data = resp.data as Record<string, unknown>
    const choices = data?.choices as Array<Record<string, unknown>> | undefined
    const message = choices?.[0]?.message as Record<string, unknown> | undefined
    if (message?.content) {
      return message.content as T
    }

    return resp.data
  }

  return { askStream, askJSON, abort, loading }
}
