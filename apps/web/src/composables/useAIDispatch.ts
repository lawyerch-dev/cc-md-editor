import type { SSECallbacks } from '@/composables/useAIFetch'
import { get as getCapability } from '@/ai/capabilities'
import { buildAIHeaders, resolveEndpointUrl, useAIFetch } from '@/composables/useAIFetch'
import { useAIStore } from '@/stores/ai'

/** Supported model configuration types. */
export type ModelType = 'text' | 'vision' | 'image'

/** Configuration resolved from the AI store for a given model type. */
export interface ModelConfig {
  type: string
  endpoint: string
  model: string
  apiKey: string
}

/** Options for a dispatch call. */
export interface DispatchOptions {
  capabilityId: string
  input: Record<string, unknown>
  callbacks?: SSECallbacks
  signal?: AbortSignal
}

/** Result returned from a dispatch call. */
export interface DispatchResult {
  ok: boolean
  data: Record<string, unknown> | null
  error: string | null
}

/**
 * Resolve model configuration from the AI store for a given model type.
 */
function resolveModelConfig(modelType: ModelType): ModelConfig {
  const store = useAIStore()

  switch (modelType) {
    case 'text':
      return {
        type: store.text.type,
        endpoint: store.text.endpoint,
        model: store.text.model,
        apiKey: store.text.apiKey,
      }
    case 'vision':
      return {
        type: store.vision.type,
        endpoint: store.vision.endpoint,
        model: store.vision.model,
        apiKey: store.vision.apiKey,
      }
    case 'image':
      return {
        type: store.image.type,
        endpoint: store.image.endpoint,
        model: store.image.model,
        apiKey: store.image.apiKey,
      }
  }
}

/**
 * Unified AI dispatcher.
 *
 * Resolves model config from the store based on the capability's `modelType`,
 * builds the payload via the capability's `buildPrompt`, and calls the
 * appropriate fetch method (`fetchSSE` for stream mode, `fetchJSON` for json mode).
 */
export function useAIDispatch() {
  const { fetchSSE, fetchJSON } = useAIFetch()

  async function dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const { capabilityId, input, callbacks, signal } = options

    // 1. Look up capability
    const capability = getCapability(capabilityId)
    if (!capability) {
      return { ok: false, data: null, error: `Unknown capability: ${capabilityId}` }
    }

    // 2. Resolve model config from store
    const config = resolveModelConfig(capability.modelType as ModelType)

    if (!config.endpoint) {
      return { ok: false, data: null, error: `No endpoint configured for ${capability.modelType} model` }
    }
    if (!config.model) {
      return { ok: false, data: null, error: `No model configured for ${capability.modelType} model` }
    }

    // 3. Build payload via capability
    const payload = capability.buildPrompt(input)

    // 4. Build request URL and headers
    const kind = capability.modelType === 'image' ? 'image' as const : 'chat' as const
    const url = resolveEndpointUrl(config.endpoint, kind)
    const headers = buildAIHeaders(config.apiKey, config.type)

    // 5. Inject model into payload (capability builds prompt content, we supply the model)
    payload.model = config.model

    // 6. Dispatch based on mode
    try {
      if (capability.mode === 'stream') {
        if (!callbacks) {
          return { ok: false, data: null, error: `Stream mode requires callbacks` }
        }

        payload.stream = true

        let accumulated = ''

        await fetchSSE(url, headers, payload, {
          onDelta: (content) => {
            accumulated += content
            callbacks.onDelta(content)
          },
          onReasoningDelta: callbacks.onReasoningDelta,
          onDone: () => {
            callbacks.onDone?.()
          },
        })

        return { ok: true, data: { content: accumulated }, error: null }
      }
      else {
        // JSON mode
        payload.stream = false

        const res = await fetchJSON(url, headers, payload, signal)

        if (!res.ok || !res.data) {
          return {
            ok: false,
            data: null,
            error: `AI request failed: ${res.status} ${res.statusText}${res.errorText ? ` — ${res.errorText}` : ''}`,
          }
        }

        return { ok: true, data: res.data as Record<string, unknown>, error: null }
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, data: null, error: message }
    }
  }

  return { dispatch }
}
