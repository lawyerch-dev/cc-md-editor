import type { ImageServiceOption, ServiceOption } from '@md/shared/types'
import type { Ref } from 'vue'
import { imageServiceOptions, serviceOptions } from '@md/shared/configs'
import {
  DEFAULT_SERVICE_KEY,
  DEFAULT_SERVICE_MAX_TOKEN,
  DEFAULT_SERVICE_TEMPERATURE,
  DEFAULT_SERVICE_TYPE,
} from '@md/shared/constants'
import { store } from '@/storage'

// ==================== 常量 ====================

export const SILICONFLOW_TYPE = `siliconflow`
export const SILICONFLOW_DEFAULT_TEXT_MODEL = `deepseek-ai/DeepSeek-V4-Flash`
export const SILICONFLOW_DEFAULT_VISION_MODEL = `Qwen/Qwen3-VL-32B-Instruct`
export const SILICONFLOW_DEFAULT_IMAGE_MODEL = `Qwen/Qwen-Image`

/**
 * 统一 AI 配置 Store
 * 合并文本 / 视觉 / 图片生成模型配置、全局参数、触发器和对话框状态。
 * 保留 per-type 持久化：切换供应商时自动加载对应 API Key 和模型。
 */
export const useAIStore = defineStore(`AI`, () => {
  // ==================== 文本模型 (per-type persisted) ====================
  const textType = store.reactive<string>(`ai_text_type`, SILICONFLOW_TYPE)
  const textEndpoint = ref<string>(``)
  const textModel = ref<string>(``)
  const textApiKey = ref<string>(DEFAULT_SERVICE_KEY)

  // ==================== 视觉模型 (per-type persisted) ====================
  const visionType = store.reactive<string>(`ai_vision_type`, SILICONFLOW_TYPE)
  const visionEndpoint = ref<string>(``)
  const visionModel = ref<string>(``)
  const visionApiKey = ref<string>(DEFAULT_SERVICE_KEY)

  // ==================== 图片生成模型 (per-type persisted) ====================
  const imageType = store.reactive<string>(`ai_image_type`, SILICONFLOW_TYPE)
  const imageEndpoint = ref<string>(``)
  const imageModel = ref<string>(``)
  const imageApiKey = ref<string>(DEFAULT_SERVICE_KEY)

  // 图片全局参数 (globally persisted)
  const imageSize = store.reactive<string>(`ai_image_size`, `1024x1024`)
  const imageQuality = store.reactive<string>(`ai_image_quality`, `standard`)
  const imageStyle = store.reactive<string>(`ai_image_style`, `natural`)

  // ==================== 全局参数 (globally persisted) ====================
  const temperature = store.reactive<number>(`ai_params_temperature`, DEFAULT_SERVICE_TEMPERATURE)
  const maxToken = store.reactive<number>(`ai_params_max_token`, DEFAULT_SERVICE_MAX_TOKEN)

  // ==================== 触发器 (globally persisted) ====================
  const autoSummary = store.reactive<boolean>(`ai_trigger_auto_summary`, false)
  const autoAnnotate = store.reactive<boolean>(`ai_trigger_auto_annotate`, false)
  const autoInsight = store.reactive<boolean>(`ai_trigger_auto_insight`, false)

  // ==================== Per-type 初始化逻辑 ====================

  type ServiceOptionLike = ServiceOption | ImageServiceOption

  function initServiceWatch(
    typeRef: Ref<string>,
    endpointRef: Ref<string>,
    modelRef: Ref<string>,
    apiKeyRef: Ref<string>,
    svcOptions: ServiceOptionLike[],
    prefix: string,
    defaultModel?: string,
  ) {
    // 异步加载 API Key
    Promise.resolve().then(async () => {
      const capturedType = typeRef.value
      const value = await store.get(`${prefix}_key_${capturedType}`)
      if (typeRef.value === capturedType)
        apiKeyRef.value = value || DEFAULT_SERVICE_KEY
    })

    watch(typeRef, async (newType: string) => {
      const svc = svcOptions.find(s => s.value === newType) ?? svcOptions[0]
      endpointRef.value = svc.endpoint

      const saved = await store.get(`${prefix}_model_${newType}`) || ``
      const preferred = defaultModel && svc.models.includes(defaultModel)
        ? defaultModel
        : svc.models[0]
      modelRef.value = svc.models.includes(saved) ? saved : preferred
      await store.set(`${prefix}_model_${newType}`, modelRef.value)

      const keyValue = await store.get(`${prefix}_key_${newType}`)
      apiKeyRef.value = keyValue || DEFAULT_SERVICE_KEY
    }, { immediate: true })

    watch(apiKeyRef, async (val: string) => {
      if (typeRef.value !== DEFAULT_SERVICE_TYPE)
        await store.set(`${prefix}_key_${typeRef.value}`, val)
    })

    watch(modelRef, async (val: string) => {
      await store.set(`${prefix}_model_${typeRef.value}`, val)
    })
  }

  initServiceWatch(textType, textEndpoint, textModel, textApiKey, serviceOptions, `ai_text`, SILICONFLOW_DEFAULT_TEXT_MODEL)
  initServiceWatch(visionType, visionEndpoint, visionModel, visionApiKey, serviceOptions, `ai_vision`, SILICONFLOW_DEFAULT_VISION_MODEL)
  initServiceWatch(imageType, imageEndpoint, imageModel, imageApiKey, imageServiceOptions, `ai_image`, SILICONFLOW_DEFAULT_IMAGE_MODEL)

  // ==================== 迁移旧存储键 ====================

  // 迁移 openai_* 参数到 ai_params_*
  Promise.resolve().then(async () => {
    const oldTemp = await store.get(`openai_temperature`)
    if (oldTemp != null && (await store.get(`ai_params_temperature`)) == null) {
      await store.set(`ai_params_temperature`, oldTemp)
      await store.remove(`openai_temperature`)
    }
    const oldToken = await store.get(`openai_max_token`)
    if (oldToken != null && (await store.get(`ai_params_max_token`)) == null) {
      await store.set(`ai_params_max_token`, oldToken)
      await store.remove(`openai_max_token`)
    }
  })

  // 迁移 openai_image_* 到 ai_image_*
  Promise.resolve().then(async () => {
    for (const key of [`type`, `size`, `quality`, `style`]) {
      const oldVal = await store.get(`openai_image_${key}`)
      if (oldVal != null && (await store.get(`ai_image_${key}`)) == null) {
        await store.set(`ai_image_${key}`, oldVal)
        await store.remove(`openai_image_${key}`)
      }
    }
    // 迁移 per-type key/model 数据
    for (const svc of imageServiceOptions) {
      const oldKey = await store.get(`openai_image_key_${svc.value}`)
      if (oldKey != null && (await store.get(`ai_image_key_${svc.value}`)) == null) {
        await store.set(`ai_image_key_${svc.value}`, oldKey)
        await store.remove(`openai_image_key_${svc.value}`)
      }
      const oldModel = await store.get(`openai_image_model_${svc.value}`)
      if (oldModel != null && (await store.get(`ai_image_model_${svc.value}`)) == null) {
        await store.set(`ai_image_model_${svc.value}`, oldModel)
        await store.remove(`openai_image_model_${svc.value}`)
      }
    }
  })

  // ==================== 对话框状态 (plain refs) ====================

  const aiDialogVisible = ref(false)
  const aiImageDialogVisible = ref(false)

  function toggleAIDialog(value?: boolean) {
    aiDialogVisible.value = value ?? !aiDialogVisible.value
  }

  function toggleAIImageDialog(value?: boolean) {
    aiImageDialogVisible.value = value ?? !aiImageDialogVisible.value
  }

  // ==================== Actions ====================

  const reset = async () => {
    // 清理文本和视觉模型的服务数据
    for (const prefix of [`ai_text`, `ai_vision`]) {
      for (const svc of serviceOptions) {
        await store.remove(`${prefix}_key_${svc.value}`)
        await store.remove(`${prefix}_model_${svc.value}`)
      }
    }
    // 清理图片生成模型的服务数据
    for (const svc of imageServiceOptions) {
      await store.remove(`ai_image_key_${svc.value}`)
      await store.remove(`ai_image_model_${svc.value}`)
      await store.remove(`openai_image_key_${svc.value}`)
      await store.remove(`openai_image_model_${svc.value}`)
    }
    textType.value = SILICONFLOW_TYPE
    visionType.value = SILICONFLOW_TYPE
    imageType.value = SILICONFLOW_TYPE
    temperature.value = DEFAULT_SERVICE_TEMPERATURE
    maxToken.value = DEFAULT_SERVICE_MAX_TOKEN
    imageSize.value = `1024x1024`
    imageQuality.value = `standard`
    imageStyle.value = `natural`
    autoSummary.value = false
    autoAnnotate.value = false
    autoInsight.value = false
  }

  return {
    // ---- 文本模型 ----
    textType,
    textEndpoint,
    textModel,
    textApiKey,

    // ---- 视觉模型 ----
    visionType,
    visionEndpoint,
    visionModel,
    visionApiKey,

    // ---- 图片生成模型 ----
    imageType,
    imageEndpoint,
    imageModel,
    imageApiKey,
    imageSize,
    imageQuality,
    imageStyle,

    // ---- 全局参数 ----
    temperature,
    maxToken,

    // ---- 触发器 ----
    autoSummary,
    autoAnnotate,
    autoInsight,

    // ---- 对话框 ----
    aiDialogVisible,
    aiImageDialogVisible,
    toggleAIDialog,
    toggleAIImageDialog,

    // ---- 向后兼容 (flat aliases → text model) ----
    type: textType,
    endpoint: textEndpoint,
    model: textModel,
    apiKey: textApiKey,

    // ---- Actions ----
    reset,
  }
})

// 向后兼容别名
export const useAIConfigStore = useAIStore

// 默认导出
export default useAIStore
