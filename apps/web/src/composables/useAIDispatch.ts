import type { ModelRole } from '@md/shared/types/ai-provider-types'
import type { SSECallbacks } from '@/composables/useAIFetch'
import { get as getCapability } from '@/ai/capabilities'
import { buildAIHeaders, resolveEndpointUrl, useAIFetch } from '@/composables/useAIFetch'
import { useAIProviderStore } from '@/stores/aiProvider'

/** Configuration resolved from the provider store for a given role. */
export interface ResolvedModelConfig {
  /** Provider id (for logging / debugging). */
  providerId: string
  /** OpenAI-compatible endpoint URL. */
  endpoint: string
  /** Model id to send in the payload. */
  model: string
  /** API key for the Authorization header. */
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
 * Unified AI dispatcher.
 *
 * Resolves model config from the provider store by the capability's declared
 * `role`, builds the payload via the capability's `buildPrompt`, and calls the
 * appropriate fetch method (`fetchSSE` for stream mode, `fetchJSON` for json mode).
 */
export function useAIDispatch() {
  const providerStore = useAIProviderStore()
  const { fetchSSE, fetchJSON } = useAIFetch()

  async function dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const { capabilityId, input, callbacks, signal } = options

    // 1. Look up capability
    const capability = getCapability(capabilityId)
    if (!capability) {
      return { ok: false, data: null, error: `Unknown capability: ${capabilityId}` }
    }

    // 2. Resolve model config by role
    const role = capability.role as ModelRole
    const config = providerStore.resolveRole(role)

    if (!config) {
      return { ok: false, data: null, error: `No model configured for role: ${role}` }
    }
    if (!config.endpoint) {
      return { ok: false, data: null, error: `No endpoint configured for role: ${role}` }
    }
    if (!config.model) {
      return { ok: false, data: null, error: `No model configured for role: ${role}` }
    }

    // 3. Build payload via capability
    const payload = capability.buildPrompt(input)

    // 4. Build request URL and headers
    const kind = role === 'image' ? 'image' as const : 'chat' as const
    const url = resolveEndpointUrl(config.endpoint, kind)
    const headers = buildAIHeaders(config.apiKey, 'default')

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
