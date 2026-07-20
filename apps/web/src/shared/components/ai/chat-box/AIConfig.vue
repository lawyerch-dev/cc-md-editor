<!-- @workspace shared -->
<script setup lang="ts">
import type { ImageServiceOption, ServiceOption } from '@md/shared/types'
import { Check, ChevronDown, Eye, Image as ImageIcon, Info, Key, Loader2, RefreshCw, Type, X } from '@lucide/vue'
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from 'reka-ui'
import { PasswordInput } from '@/components/ui/password-input'
import { buildAIHeaders, resolveEndpointUrl, useAIFetch } from '@/shared/composables/useAIFetch'
import { useDynamicAIModels } from '@/shared/composables/useDynamicAIModels'
import { useLocalizedAIServiceOptions } from '@/shared/composables/useLocalizedAIServices'
import { useAIConfigStore } from '@/shared/stores/aiConfig'

const emit = defineEmits([`saved`])
const aiConfig = useAIConfigStore()
const { t } = useI18n()

const { fetchJSON } = useAIFetch()
const localizedAIServices = useLocalizedAIServiceOptions()

// ==================== 供应商级 API Key ====================

const providerKeysOpen = ref(false)
const allProviders = computed(() => {
  const seen = new Set<string>()
  const result: { value: string, label: string }[] = []
  const all = [...localizedAIServices.value.serviceOptions, ...localizedAIServices.value.imageServiceOptions]
  for (const svc of all) {
    if (svc.value !== `default` && svc.value !== `custom` && !seen.has(svc.value)) {
      seen.add(svc.value)
      result.push({ value: svc.value, label: svc.label })
    }
  }
  return result
})

const providerKeys = ref<Record<string, string>>({})
const configuredProviders = computed(() =>
  allProviders.value.filter(p => providerKeys.value[p.value]).length,
)

onMounted(async () => {
  for (const p of allProviders.value) {
    providerKeys.value[p.value] = await aiConfig.loadProviderKey(p.value)
  }
})

async function onProviderKeyChange(provider: string, key: string) {
  await aiConfig.saveProviderKey(provider, key)
}

// 每个模型独立的测试状态
const textTesting = ref(false)
const visionTesting = ref(false)
const imageTesting = ref(false)
const textTestResult = ref<{ ok: boolean, msg: string } | null>(null)
const visionTestResult = ref<{ ok: boolean, msg: string } | null>(null)
const imageTestResult = ref<{ ok: boolean, msg: string } | null>(null)

function getCurrentService<T extends ServiceOption | ImageServiceOption>(
  svcType: string,
  options: T[],
): T {
  return options.find(s => s.value === svcType) ?? options[0]
}

const textService = computed(() => getCurrentService(aiConfig.textType, localizedAIServices.value.serviceOptions))
const visionService = computed(() => getCurrentService(aiConfig.visionType, localizedAIServices.value.serviceOptions))
const imageService = computed(() => getCurrentService(aiConfig.imageType, localizedAIServices.value.imageServiceOptions))

// 动态模型：当供应商提供 fetchModels 时按需调用 /v1/models，
// 否则回退到服务静态 models 列表。多个组件复用一份缓存。
const textDynamic = useDynamicAIModels(textService, () => aiConfig.textApiKey)
const visionDynamic = useDynamicAIModels(visionService, () => aiConfig.visionApiKey)

// 图片模型过滤器：只保留图片生成相关的模型，排除文本/对话模型
function isImageModel(modelId: string): boolean {
  const imageKeywords = [
    `image`,
    `flux`,
    `dall-e`,
    `stable-diffusion`,
    `sd`,
    `kolors`,
    `qwen-image`,
    `wanx`,
    `cogview`,
    `ideogram`,
    `midjourney`,
    `mj`,
    `recraft`,
    `gpt-image`,
    `seedream`,
    `kontext`,
  ]
  const lower = modelId.toLowerCase()
  return imageKeywords.some(kw => lower.includes(kw))
}
const imageDynamic = useDynamicAIModels(imageService, () => aiConfig.imageApiKey, isImageModel)

async function testConn(
  endpoint: string,
  apiKey: string,
  type: string,
  modelName: string,
  resultRef: typeof textTestResult,
  testingRef: typeof textTesting,
) {
  resultRef.value = null
  testingRef.value = true
  const headers = buildAIHeaders(apiKey, type)
  try {
    const url = resolveEndpointUrl(endpoint, `chat`)
    const payload = { model: modelName, messages: [{ role: `user`, content: `ping` }], temperature: 0, max_tokens: 1, stream: false }
    const res = await fetchJSON(url, headers, payload)
    if (res.ok) {
      resultRef.value = { ok: true, msg: '成功' }
      emit(`saved`)
    }
    else {
      resultRef.value = { ok: false, msg: `${res.status} ${res.statusText}` }
    }
  }
  catch (e: unknown) {
    resultRef.value = { ok: false, msg: e instanceof Error ? e.message : String(e) }
  }
  finally {
    testingRef.value = false
  }
}

function testText() { testConn(aiConfig.textEndpoint, aiConfig.textApiKey, aiConfig.textType, aiConfig.textModel, textTestResult, textTesting) }
function testVision() { testConn(aiConfig.visionEndpoint, aiConfig.visionApiKey, aiConfig.visionType, aiConfig.visionModel, visionTestResult, visionTesting) }

// 图片模型使用 image 端点测试，而非 chat 端点
async function testImage() {
  imageTestResult.value = null
  imageTesting.value = true
  const headers = buildAIHeaders(aiConfig.imageApiKey, aiConfig.imageType)
  try {
    const url = resolveEndpointUrl(aiConfig.imageEndpoint, `image`)
    const payload = { model: aiConfig.imageModel, prompt: `test`, n: 1, size: `1024x1024` }
    const res = await fetchJSON(url, headers, payload)
    if (res.ok) {
      imageTestResult.value = { ok: true, msg: '成功' }
      emit(`saved`)
    }
    else {
      imageTestResult.value = { ok: false, msg: `${res.status} ${res.statusText}` }
    }
  }
  catch (e: unknown) {
    imageTestResult.value = { ok: false, msg: e instanceof Error ? e.message : String(e) }
  }
  finally {
    imageTesting.value = false
  }
}

const loading = computed(() =>
  textTesting.value || visionTesting.value || imageTesting.value,
)

const testResult = computed(() =>
  imageTestResult.value?.msg ?? visionTestResult.value?.msg ?? textTestResult.value?.msg ?? ``,
)

async function saveConfig() {
  emit(`saved`)
}

async function clearConfig() {
  await aiConfig.reset()
  emit(`saved`)
}

async function testConnection() {
  await testText()
}

defineExpose({
  saveConfig,
  clearConfig,
  testConnection,
  loading,
  testResult,
})
</script>

<template>
  <div class="custom-scroll flex-1 text-xs sm:text-sm">
    <!-- 供应商 API Key（默认折叠） -->
    <CollapsibleRoot v-model:open="providerKeysOpen" class="mb-5 rounded-lg border">
      <CollapsibleTrigger class="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 hover:bg-muted/30">
        <Key class="h-4 w-4 text-muted-foreground" />
        <span class="flex-1 text-left text-sm font-medium">{{ t('ai.config.providerKeys') }}</span>
        <span v-if="configuredProviders > 0" class="text-xs text-green-600 dark:text-green-400">
          {{ configuredProviders }} {{ t('ai.config.configured') }}
        </span>
        <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform" :class="{ 'rotate-180': providerKeysOpen }" />
      </CollapsibleTrigger>
      <CollapsibleContent class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div class="border-t p-4">
          <p class="mb-3 text-xs text-muted-foreground">
            {{ t('ai.config.providerKeysHint') }}
          </p>
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div v-for="p in allProviders" :key="p.value" class="flex items-center gap-2">
              <Label class="w-20 shrink-0 text-xs" :class="{ 'text-green-600 dark:text-green-400': providerKeys[p.value] }">
                <span class="inline-flex items-center gap-1">
                  <Check v-if="providerKeys[p.value]" class="h-3 w-3" />
                  {{ p.label }}
                </span>
              </Label>
              <PasswordInput
                :model-value="providerKeys[p.value]"
                placeholder="sk-..."
                class="flex-1"
                @update:model-value="onProviderKeyChange(p.value, $event as string)"
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>

    <!-- 模型配置 Tabs -->
    <TabsRoot default-value="text">
      <TabsList class="inline-flex h-9 w-full rounded-lg border bg-muted/30 p-0.5">
        <TabsTrigger
          value="text"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          <Type class="h-3.5 w-3.5" />
          {{ t('ai.config.tabText') }}
        </TabsTrigger>
        <TabsTrigger
          value="vision"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          <Eye class="h-3.5 w-3.5" />
          {{ t('ai.config.tabVision') }}
        </TabsTrigger>
        <TabsTrigger
          value="image"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          <ImageIcon class="h-3.5 w-3.5" />
          {{ t('ai.config.tabImage') }}
        </TabsTrigger>
      </TabsList>

      <!-- 文本模型 -->
      <TabsContent value="text" class="mt-3">
        <div class="rounded-lg border">
          <div class="flex items-center justify-between border-b px-4 py-2">
            <p class="text-xs text-muted-foreground">
              {{ t('ai.config.tabTextHint') }}
            </p>
            <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-xs" :disabled="textTesting" @click="testText">
              <Loader2 v-if="textTesting" class="h-3 w-3 animate-spin" />
              <Check v-else-if="textTestResult?.ok" class="h-3 w-3 text-green-500" />
              <X v-else-if="textTestResult && !textTestResult.ok" class="h-3 w-3 text-red-500" />
              {{ t('common.testConnection') }}
            </Button>
          </div>
          <div class="space-y-3.5 p-4">
            <div>
              <Label class="mb-1.5 block text-xs font-medium">{{ t('ai.config.serviceType') }}</Label>
              <Select v-model="aiConfig.textType">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ textService.label }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="svc in localizedAIServices.serviceOptions" :key="svc.value" :value="svc.value">
                    {{ svc.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <Label class="text-xs font-medium">{{ t('ai.config.modelName') }}</Label>
                <button
                  v-if="textService.fetchModels"
                  type="button"
                  class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  :disabled="textDynamic.loading.value || !aiConfig.textApiKey"
                  @click="textDynamic.refresh()"
                >
                  <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': textDynamic.loading.value }" />
                  <span>{{ textDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                </button>
              </div>
              <Select v-if="textDynamic.allModels.value.length > 0" v-model="aiConfig.textModel">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ aiConfig.textModel || t('ai.config.selectModel') }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in textDynamic.allModels.value" :key="m" :value="m">
                    {{ m }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input v-else v-model="aiConfig.textModel" :placeholder="t('ai.config.modelPlaceholder')" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <Label class="mb-1.5 flex items-center gap-1 text-xs font-medium">
                  {{ t('ai.config.temperature') }}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Info class="text-muted-foreground" :size="13" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {{ t('ai.config.temperatureHint') }}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input v-model.number="aiConfig.temperature" type="number" step="0.1" min="0" max="2" />
              </div>
              <div>
                <Label class="mb-1.5 block text-xs font-medium">{{ t('ai.config.maxTokens') }}</Label>
                <Input v-model.number="aiConfig.maxToken" type="number" min="1" max="32768" />
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- 视觉模型 -->
      <TabsContent value="vision" class="mt-3">
        <div class="rounded-lg border">
          <div class="flex items-center justify-between border-b px-4 py-2">
            <p class="text-xs text-muted-foreground">
              {{ t('ai.config.tabVisionHint') }}
            </p>
            <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-xs" :disabled="visionTesting" @click="testVision">
              <Loader2 v-if="visionTesting" class="h-3 w-3 animate-spin" />
              <Check v-else-if="visionTestResult?.ok" class="h-3 w-3 text-green-500" />
              <X v-else-if="visionTestResult && !visionTestResult.ok" class="h-3 w-3 text-red-500" />
              {{ t('common.testConnection') }}
            </Button>
          </div>
          <div class="space-y-3.5 p-4">
            <div>
              <Label class="mb-1.5 block text-xs font-medium">{{ t('ai.config.serviceType') }}</Label>
              <Select v-model="aiConfig.visionType">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ visionService.label }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="svc in localizedAIServices.serviceOptions" :key="svc.value" :value="svc.value">
                    {{ svc.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <Label class="text-xs font-medium">{{ t('ai.config.modelName') }}</Label>
                <button
                  v-if="visionService.fetchModels"
                  type="button"
                  class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  :disabled="visionDynamic.loading.value || !aiConfig.visionApiKey"
                  @click="visionDynamic.refresh()"
                >
                  <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': visionDynamic.loading.value }" />
                  <span>{{ visionDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                </button>
              </div>
              <Select v-if="visionDynamic.allModels.value.length > 0" v-model="aiConfig.visionModel">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ aiConfig.visionModel || t('ai.config.selectModel') }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in visionDynamic.allModels.value" :key="m" :value="m">
                    {{ m }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input v-else v-model="aiConfig.visionModel" placeholder="如 gpt-4o" />
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- 图片生成模型 -->
      <TabsContent value="image" class="mt-3">
        <div class="rounded-lg border">
          <div class="flex items-center justify-between border-b px-4 py-2">
            <p class="text-xs text-muted-foreground">
              {{ t('ai.config.tabImageHint') }}
            </p>
            <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-xs" :disabled="imageTesting" @click="testImage">
              <Loader2 v-if="imageTesting" class="h-3 w-3 animate-spin" />
              <Check v-else-if="imageTestResult?.ok" class="h-3 w-3 text-green-500" />
              <X v-else-if="imageTestResult && !imageTestResult.ok" class="h-3 w-3 text-red-500" />
              {{ t('common.testConnection') }}
            </Button>
          </div>
          <div class="space-y-3.5 p-4">
            <div>
              <Label class="mb-1.5 block text-xs font-medium">{{ t('ai.config.serviceType') }}</Label>
              <Select v-model="aiConfig.imageType">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ imageService.label }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="svc in localizedAIServices.imageServiceOptions" :key="svc.value" :value="svc.value">
                    {{ svc.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <Label class="text-xs font-medium">{{ t('ai.config.modelName') }}</Label>
                <button
                  v-if="imageService.fetchModels"
                  type="button"
                  class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  :disabled="imageDynamic.loading.value || !aiConfig.imageApiKey"
                  @click="imageDynamic.refresh()"
                >
                  <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': imageDynamic.loading.value }" />
                  <span>{{ imageDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                </button>
              </div>
              <Select v-if="imageDynamic.allModels.value.length > 0" v-model="aiConfig.imageModel">
                <SelectTrigger class="w-full">
                  <SelectValue>{{ aiConfig.imageModel || t('ai.config.selectModel') }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in imageDynamic.allModels.value" :key="m" :value="m">
                    {{ m }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input v-else v-model="aiConfig.imageModel" placeholder="如 dall-e-3" />
            </div>
          </div>
        </div>
      </TabsContent>
    </TabsRoot>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
@media (pointer: coarse) {
  .custom-scroll::-webkit-scrollbar {
    width: 3px;
  }
}
.custom-scroll::-webkit-scrollbar-thumb {
  @apply rounded-full bg-gray-400/40 hover:bg-gray-400/60;
  @apply dark:bg-gray-500/40 dark:hover:bg-gray-500/70;
}
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(156 163 175 / 0.4) transparent;
}
.dark .custom-scroll {
  scrollbar-color: rgb(107 114 128 / 0.4) transparent;
}
</style>
