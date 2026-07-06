import type {
  ModelRole,
  Provider,
  RoleMap,
  TriggerConfig,
} from '@md/shared/types'
import { getProviderTemplate, providerTemplates } from '@md/shared/configs/ai-provider-templates'
import { inferRole } from '@/ai/role-inference'
import { store } from '@/storage'

// ==================== Provider-based AI Store ====================

export const useAIProviderStore = defineStore('aiProvider', () => {
  // ── Providers ──
  const providers = ref<Provider[]>([])

  // ── Role assignments (manual overrides) ──
  const roleAssignments = ref<RoleMap>({
    reasoning: null,
    fast: null,
    vision: null,
    image: null,
  })

  // ── Params ──
  const temperature = store.reactive('ai_params_temperature', 0.6)
  const maxToken = store.reactive('ai_params_max_token', 4096)

  // ── Image params ──
  const imageSize = store.reactive('ai_image_size', '1024x1024')
  const imageQuality = store.reactive('ai_image_quality', 'standard')
  const imageStyle = store.reactive('ai_image_style', 'vivid')

  // ── Triggers ──
  const triggerSummary = ref<TriggerConfig>({ enabled: true, role: 'fast', delayMs: 3000 })
  const triggerAnnotate = ref<TriggerConfig>({ enabled: false, role: 'fast', delayMs: 5000 })
  const triggerInsight = ref<TriggerConfig>({ enabled: true, role: 'reasoning', delayMs: 0 })

  // ── Persistence: providers & role assignments ──
  let saveLock = false

  async function loadFromStorage() {
    saveLock = true
    try {
      const savedProviders = await store.getJSON<Provider[]>('ai_providers', [])
      if (savedProviders.length > 0)
        providers.value = savedProviders

      const savedAssignments = await store.getJSON<RoleMap | null>('ai_role_assignments', null)
      if (savedAssignments)
        roleAssignments.value = savedAssignments

      const savedSummary = await store.getJSON<TriggerConfig | null>('ai_trigger_summary', null)
      if (savedSummary)
        triggerSummary.value = savedSummary

      const savedAnnotate = await store.getJSON<TriggerConfig | null>('ai_trigger_annotate', null)
      if (savedAnnotate)
        triggerAnnotate.value = savedAnnotate

      const savedInsight = await store.getJSON<TriggerConfig | null>('ai_trigger_insight', null)
      if (savedInsight)
        triggerInsight.value = savedInsight
    }
    finally {
      saveLock = false
    }
  }

  watch(providers, (val) => {
    if (!saveLock)
      store.setJSON('ai_providers', val)
  }, { deep: true })

  watch(roleAssignments, (val) => {
    if (!saveLock)
      store.setJSON('ai_role_assignments', val)
  }, { deep: true })

  watch(triggerSummary, (val) => {
    if (!saveLock)
      store.setJSON('ai_trigger_summary', val)
  }, { deep: true })

  watch(triggerAnnotate, (val) => {
    if (!saveLock)
      store.setJSON('ai_trigger_annotate', val)
  }, { deep: true })

  watch(triggerInsight, (val) => {
    if (!saveLock)
      store.setJSON('ai_trigger_insight', val)
  }, { deep: true })

  // Load persisted data on store init
  loadFromStorage()

  // ── Actions ──

  function addProvider(templateId?: string) {
    const template = templateId ? getProviderTemplate(templateId) : undefined
    const id = crypto.randomUUID()
    const provider: Provider = {
      id,
      name: template?.name ?? 'Custom',
      templateId: template?.id,
      endpoint: template?.endpoint ?? '',
      apiKey: '',
      models: template?.defaultModels ?? [],
      manualModels: [],
      fetchStatus: 'idle',
      isDefault: providers.value.length === 0, // first provider is default
    }
    providers.value.push(provider)
    return provider
  }

  function removeProvider(id: string) {
    const idx = providers.value.findIndex(p => p.id === id)
    if (idx === -1)
      return

    providers.value.splice(idx, 1)

    // Clear role assignments that reference this provider
    for (const role of Object.keys(roleAssignments.value) as ModelRole[]) {
      if (roleAssignments.value[role]?.providerId === id)
        roleAssignments.value[role] = null
    }

    // If we removed the default, promote the first remaining provider
    if (providers.value.length > 0 && !providers.value.some(p => p.isDefault))
      providers.value[0].isDefault = true
  }

  async function fetchModels(providerId: string) {
    const provider = providers.value.find(p => p.id === providerId)
    if (!provider)
      return

    provider.fetchStatus = 'loading'
    provider.fetchError = undefined

    try {
      const response = await fetch(`${provider.endpoint}/models`, {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: unknown = await response.json()
      const modelIds: string[] = []

      if (data && typeof data === 'object' && 'data' in data) {
        const list = (data as Record<string, unknown>).data
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && typeof item === 'object' && 'id' in item) {
              const id = (item as Record<string, unknown>).id
              if (typeof id === 'string')
                modelIds.push(id)
            }
          }
        }
      }

      provider.models = modelIds
      provider.fetchStatus = 'ok'
    }
    catch (err: unknown) {
      provider.fetchStatus = 'error'
      provider.fetchError = err instanceof Error ? err.message : String(err)
    }
  }

  function setRoleAssignment(role: ModelRole, providerId: string, modelId: string) {
    roleAssignments.value[role] = { providerId, modelId }
  }

  function clearRoleAssignment(role: ModelRole) {
    roleAssignments.value[role] = null
  }

  function setDefaultProvider(id: string) {
    for (const p of providers.value)
      p.isDefault = p.id === id
  }

  // ── Key resolution ──

  function resolveRole(role: ModelRole): { endpoint: string, apiKey: string, model: string, providerId: string } | null {
    // 1. Manual assignment
    const assignment = roleAssignments.value[role]
    if (assignment) {
      const provider = providers.value.find(p => p.id === assignment.providerId)
      if (provider) {
        return {
          endpoint: provider.endpoint,
          apiKey: provider.apiKey,
          model: assignment.modelId,
          providerId: provider.id,
        }
      }
    }

    // 2. Default provider — first model whose inferred role matches
    const defaultProvider = providers.value.find(p => p.isDefault) ?? providers.value[0]
    if (defaultProvider) {
      const allModels = [...defaultProvider.models, ...defaultProvider.manualModels]
      const match = allModels.find(m => inferRole(m) === role)
      if (match) {
        return {
          endpoint: defaultProvider.endpoint,
          apiKey: defaultProvider.apiKey,
          model: match,
          providerId: defaultProvider.id,
        }
      }
    }

    // 3. Search ALL providers for a matching model
    for (const provider of providers.value) {
      if (provider.id === defaultProvider?.id)
        continue
      const allModels = [...provider.models, ...provider.manualModels]
      const match = allModels.find(m => inferRole(m) === role)
      if (match) {
        return {
          endpoint: provider.endpoint,
          apiKey: provider.apiKey,
          model: match,
          providerId: provider.id,
        }
      }
    }

    return null
  }

  // ── Get all models for a role (for UI dropdowns) ──

  function getModelsForRole(role: ModelRole): Array<{ providerId: string, modelId: string, inferred: boolean }> {
    const results: Array<{ providerId: string, modelId: string, inferred: boolean }> = []

    for (const provider of providers.value) {
      const allModels = [...provider.models, ...provider.manualModels]
      for (const modelId of allModels) {
        if (inferRole(modelId) === role) {
          // Check if this is a manual model
          const isManual = provider.manualModels.includes(modelId)
          results.push({ providerId: provider.id, modelId, inferred: !isManual })
        }
      }
    }

    return results
  }

  // ── Migration from old store ──

  async function migrateFromLegacy() {
    // Skip if providers already exist
    const existing = await store.getJSON<Provider[]>('ai_providers', [])
    if (existing.length > 0)
      return

    // Read old keys
    const oldTextType = await store.get('ai_text_type')
    const oldVisionType = await store.get('ai_vision_type')
    const oldImageType = await store.get('ai_image_type')

    if (!oldTextType && !oldVisionType && !oldImageType)
      return

    // Collect unique service types
    const types = new Set<string>()
    if (oldTextType)
      types.add(oldTextType)
    if (oldVisionType)
      types.add(oldVisionType)
    if (oldImageType)
      types.add(oldImageType)

    for (const svcType of types) {
      // Look up template by matching service type to known templates
      const template = providerTemplates.find(t =>
        t.id === svcType || t.name.toLowerCase() === svcType.toLowerCase(),
      )

      const endpoint = await store.get(`ai_text_endpoint`) ?? ''
      const apiKey = await store.get(`ai_text_key_${svcType}`) ?? ''

      const id = crypto.randomUUID()
      const provider: Provider = {
        id,
        name: template?.name ?? svcType,
        templateId: template?.id,
        endpoint: template?.endpoint ?? endpoint,
        apiKey,
        models: template?.defaultModels ?? [],
        manualModels: [],
        fetchStatus: 'idle',
        isDefault: types.size === 1 || svcType === oldTextType,
      }
      providers.value.push(provider)

      // Map old models to roles
      const oldTextModel = await store.get(`ai_text_model_${svcType}`)
      const oldVisionModel = await store.get(`ai_vision_model_${svcType}`)
      const oldImageModel = await store.get(`ai_image_model_${svcType}`)

      if (oldTextModel) {
        setRoleAssignment('fast', id, oldTextModel)
        // If text model looks like a reasoning model, also assign reasoning
        if (inferRole(oldTextModel) === 'reasoning')
          setRoleAssignment('reasoning', id, oldTextModel)
      }

      if (oldVisionModel)
        setRoleAssignment('vision', id, oldVisionModel)

      if (oldImageModel)
        setRoleAssignment('image', id, oldImageModel)
    }
  }

  return {
    // ── State ──
    providers,
    roleAssignments,
    temperature,
    maxToken,
    imageSize,
    imageQuality,
    imageStyle,
    triggerSummary,
    triggerAnnotate,
    triggerInsight,

    // ── Actions ──
    addProvider,
    removeProvider,
    fetchModels,
    setRoleAssignment,
    clearRoleAssignment,
    setDefaultProvider,
    resolveRole,
    getModelsForRole,
    migrateFromLegacy,
  }
})
