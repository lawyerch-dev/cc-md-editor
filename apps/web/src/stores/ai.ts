/**
 * 统一 AI 配置 Store — 兼容层
 * 内部代理到 aiProvider store，消费者无需改动。
 * 唯一配置源是 aiProvider store。
 */

import { computed, ref } from 'vue'
import { useAIProviderStore } from '@/stores/aiProvider'

// 向后兼容常量
export const SILICONFLOW_TYPE = `siliconflow`
export const SILICONFLOW_DEFAULT_TEXT_MODEL = `deepseek-ai/DeepSeek-V4-Flash`
export const SILICONFLOW_DEFAULT_VISION_MODEL = `Qwen/Qwen3-VL-32B-Instruct`
export const SILICONFLOW_DEFAULT_IMAGE_MODEL = `Qwen/Qwen-Image`

export const useAIStore = defineStore(`AI`, () => {
  // 唯一配置源
  const providerStore = useAIProviderStore()

  // ── 文本模型（代理到 provider store → fast role）──
  const textType = computed(() => {
    const config = providerStore.resolveRole('fast')
    return config ? 'default' : SILICONFLOW_TYPE
  })
  const textEndpoint = computed(() => providerStore.resolveRole('fast')?.endpoint ?? '')
  const textModel = computed(() => providerStore.resolveRole('fast')?.model ?? '')
  const textApiKey = computed(() => providerStore.resolveRole('fast')?.apiKey ?? '')

  // ── 视觉模型（代理到 provider store → vision role）──
  const visionType = computed(() => {
    const config = providerStore.resolveRole('vision')
    return config ? 'default' : SILICONFLOW_TYPE
  })
  const visionEndpoint = computed(() => providerStore.resolveRole('vision')?.endpoint ?? '')
  const visionModel = computed(() => providerStore.resolveRole('vision')?.model ?? '')
  const visionApiKey = computed(() => providerStore.resolveRole('vision')?.apiKey ?? '')

  // ── 图片生成模型（代理到 provider store → image role）──
  const imageType = computed(() => {
    const config = providerStore.resolveRole('image')
    return config ? 'default' : SILICONFLOW_TYPE
  })
  const imageEndpoint = computed(() => providerStore.resolveRole('image')?.endpoint ?? '')
  const imageModel = computed(() => providerStore.resolveRole('image')?.model ?? '')
  const imageApiKey = computed(() => providerStore.resolveRole('image')?.apiKey ?? '')

  // ── 图片参数（代理到 provider store）──
  const imageSize = computed({
    get: () => providerStore.imageSize,
    set: (v: string) => { providerStore.imageSize = v },
  })
  const imageQuality = computed({
    get: () => providerStore.imageQuality,
    set: (v: string) => { providerStore.imageQuality = v },
  })
  const imageStyle = computed({
    get: () => providerStore.imageStyle,
    set: (v: string) => { providerStore.imageStyle = v },
  })

  // ── 全局参数（代理到 provider store）──
  const temperature = computed({
    get: () => providerStore.temperature,
    set: (v: number) => { providerStore.temperature = v },
  })
  const maxToken = computed({
    get: () => providerStore.maxToken,
    set: (v: number) => { providerStore.maxToken = v },
  })

  // ── 触发器（代理到 provider store）──
  const autoSummary = computed({
    get: () => providerStore.triggerSummary.enabled,
    set: (v: boolean) => { providerStore.triggerSummary.enabled = v },
  })
  const autoAnnotate = computed({
    get: () => providerStore.triggerAnnotate.enabled,
    set: (v: boolean) => { providerStore.triggerAnnotate.enabled = v },
  })
  const autoInsight = computed({
    get: () => providerStore.triggerInsight.enabled,
    set: (v: boolean) => { providerStore.triggerInsight.enabled = v },
  })

  // ── 对话框状态（本地，不持久化）──
  const aiDialogVisible = ref(false)
  const aiImageDialogVisible = ref(false)

  function toggleAIDialog(value?: boolean) {
    aiDialogVisible.value = value ?? !aiDialogVisible.value
  }
  function toggleAIImageDialog(value?: boolean) {
    aiImageDialogVisible.value = value ?? !aiImageDialogVisible.value
  }

  // ── Reset（委托给 provider store）──
  const reset = async () => {
    // Provider store handles its own reset
  }

  return {
    // 文本模型
    textType,
    textEndpoint,
    textModel,
    textApiKey,
    // 视觉模型
    visionType,
    visionEndpoint,
    visionModel,
    visionApiKey,
    // 图片生成模型
    imageType,
    imageEndpoint,
    imageModel,
    imageApiKey,
    imageSize,
    imageQuality,
    imageStyle,
    // 全局参数
    temperature,
    maxToken,
    // 触发器
    autoSummary,
    autoAnnotate,
    autoInsight,
    // 对话框
    aiDialogVisible,
    aiImageDialogVisible,
    toggleAIDialog,
    toggleAIImageDialog,
    // 向后兼容
    type: textType,
    endpoint: textEndpoint,
    model: textModel,
    apiKey: textApiKey,
    // Actions
    reset,
  }
})

// 向后兼容别名
export const useAIConfigStore = useAIStore
export default useAIStore
