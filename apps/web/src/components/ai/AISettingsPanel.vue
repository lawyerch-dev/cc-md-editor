<script setup lang="ts">
import type { ImageServiceOption, ServiceOption } from '@md/shared/types'
import { Check, ChevronDown, Info, Loader2, RefreshCw, X } from '@lucide/vue'
import { DEFAULT_SERVICE_TYPE } from '@md/shared/constants'
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { buildAIHeaders, resolveEndpointUrl, useAIFetch } from '@/composables/useAIFetch'
import { useDynamicAIModels } from '@/composables/useDynamicAIModels'
import { useLocalizedAIServiceOptions } from '@/composables/useLocalizedAIServices'
import { useAIStore } from '@/stores/ai'

const emit = defineEmits([`saved`])
const aiStore = useAIStore()
const { t } = useI18n()

const { fetchJSON } = useAIFetch()
const localizedAIServices = useLocalizedAIServiceOptions()

/* ------------------------------------------------------------------ */
/*  Service resolution                                                 */
/* ------------------------------------------------------------------ */

function getCurrentService<T extends ServiceOption | ImageServiceOption>(
  svcType: string,
  options: T[],
): T {
  return options.find(s => s.value === svcType) ?? options[0]
}

const textService = computed(() =>
  getCurrentService(aiStore.textType, localizedAIServices.value.serviceOptions),
)
const visionService = computed(() =>
  getCurrentService(aiStore.visionType, localizedAIServices.value.serviceOptions),
)
const imageService = computed(() =>
  getCurrentService(aiStore.imageType, localizedAIServices.value.imageServiceOptions),
)

/* ------------------------------------------------------------------ */
/*  Dynamic model fetching                                             */
/* ------------------------------------------------------------------ */

const textDynamic = useDynamicAIModels(textService, () => aiStore.textApiKey)
const visionDynamic = useDynamicAIModels(visionService, () => aiStore.visionApiKey)

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
const imageDynamic = useDynamicAIModels(imageService, () => aiStore.imageApiKey, isImageModel)

/* ------------------------------------------------------------------ */
/*  Test connection                                                    */
/* ------------------------------------------------------------------ */

const textTesting = ref(false)
const visionTesting = ref(false)
const imageTesting = ref(false)
const textTestResult = ref<{ ok: boolean, msg: string } | null>(null)
const visionTestResult = ref<{ ok: boolean, msg: string } | null>(null)
const imageTestResult = ref<{ ok: boolean, msg: string } | null>(null)

async function testConn(
  endpoint: string,
  apiKey: string,
  type: string,
  modelName: string,
  resultRef: typeof textTestResult,
  testingRef: typeof textTesting,
  kind: `chat` | `image` = `chat`,
) {
  resultRef.value = null
  testingRef.value = true
  const headers = buildAIHeaders(apiKey, type)
  try {
    const url = resolveEndpointUrl(endpoint, kind)
    const payload = kind === `image`
      ? { model: modelName, prompt: `test`, n: 1, size: `1024x1024` }
      : { model: modelName, messages: [{ role: `user`, content: `ping` }], temperature: 0, max_tokens: 1, stream: false }
    const res = await fetchJSON(url, headers, payload)
    if (res.ok) {
      resultRef.value = { ok: true, msg: t('ai.settings.connectionSuccess') }
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

function testText() {
  testConn(aiStore.textEndpoint, aiStore.textApiKey, aiStore.textType, aiStore.textModel, textTestResult, textTesting)
}
function testVision() {
  testConn(aiStore.visionEndpoint, aiStore.visionApiKey, aiStore.visionType, aiStore.visionModel, visionTestResult, visionTesting)
}
function testImage() {
  testConn(aiStore.imageEndpoint, aiStore.imageApiKey, aiStore.imageType, aiStore.imageModel, imageTestResult, imageTesting, `image`)
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

function saveConfig() {
  emit(`saved`)
}

function clearConfig() {
  aiStore.reset()
  aiStore.reset()
  emit(`saved`)
}

/* ------------------------------------------------------------------ */
/*  Image-specific options                                             */
/* ------------------------------------------------------------------ */

const sizeOptions = computed(() => [
  { label: t('ai.settings.sizeSquare'), value: `1024x1024` },
  { label: t('ai.settings.sizeLandscape'), value: `1792x1024` },
  { label: t('ai.settings.sizePortrait'), value: `1024x1792` },
])

const qualityOptions = computed(() => [
  { label: t('ai.settings.qualityStandard'), value: `standard` },
  { label: t('ai.settings.qualityHd'), value: `hd` },
])

const styleOptions = computed(() => [
  { label: t('ai.settings.styleNatural'), value: `natural` },
  { label: t('ai.settings.styleVivid'), value: `vivid` },
])

/* ------------------------------------------------------------------ */
/*  Expose                                                             */
/* ------------------------------------------------------------------ */

defineExpose({ saveConfig, clearConfig })
</script>

<template>
  <div class="flex flex-col">
    <Tabs default-value="models" class="flex flex-col">
      <TabsList class="w-full justify-start">
        <TabsTrigger value="models">
          {{ t('ai.settings.models') }}
        </TabsTrigger>
        <TabsTrigger value="params">
          {{ t('ai.settings.params') }}
        </TabsTrigger>
        <TabsTrigger value="triggers">
          {{ t('ai.settings.triggers') }}
        </TabsTrigger>
      </TabsList>

      <!-- ==================== Models Tab ==================== -->
      <TabsContent value="models" class="mt-3">
        <AccordionRoot
          type="single"
          collapsible
          default-value="text"
          class="space-y-3"
        >
          <!-- ========== 文本模型 ========== -->
          <AccordionItem value="text" class="rounded-lg border overflow-hidden">
            <AccordionHeader>
              <AccordionTrigger class="flex w-full cursor-pointer select-none items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 [&[data-state=open]>svg.chevron]:rotate-180">
                <div class="flex flex-1 items-center text-left">
                  <span>{{ t('ai.settings.textModel') }}</span>
                  <span class="ml-2 text-xs font-normal text-muted-foreground">{{ t('ai.settings.textModelDesc') }}</span>
                </div>
                <div class="flex items-center gap-1.5" @click.stop.prevent @keydown.stop>
                  <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" :disabled="textTesting" @click="testText">
                    {{ t('ai.settings.testConnection') }}
                  </Button>
                  <Loader2 v-if="textTesting" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <template v-else-if="textTestResult">
                    <Check v-if="textTestResult.ok" class="h-4 w-4 text-green-500" />
                    <X v-else class="h-4 w-4 text-red-500" />
                  </template>
                </div>
                <ChevronDown class="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div class="space-y-3 px-3 pb-3 pt-1">
                <!-- 服务类型 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.serviceType') }}</Label>
                  <Select v-model="aiStore.textType">
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
                <!-- 端点 -->
                <div v-if="aiStore.textType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiEndpoint') }}</Label>
                  <Input v-model="aiStore.textEndpoint" :placeholder="t('ai.config.apiEndpointPlaceholder')" />
                </div>
                <!-- API Key -->
                <div v-if="aiStore.textType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiKey') }}</Label>
                  <PasswordInput v-model="aiStore.textApiKey" placeholder="sk-..." />
                </div>
                <!-- 模型 -->
                <div>
                  <div class="mb-1 flex items-center justify-between">
                    <Label class="text-sm font-medium">{{ t('ai.config.modelName') }}</Label>
                    <button
                      v-if="textService.fetchModels"
                      type="button"
                      class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      :disabled="textDynamic.loading.value || !aiStore.textApiKey"
                      :title="t('ai.config.refreshModelsHint')"
                      @click="textDynamic.refresh()"
                    >
                      <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': textDynamic.loading.value }" />
                      <span>{{ textDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                    </button>
                  </div>
                  <Select v-if="textDynamic.allModels.value.length > 0" v-model="aiStore.textModel">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ aiStore.textModel || t('ai.config.selectModel') }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="m in textDynamic.allModels.value" :key="m" :value="m">
                        {{ m }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else v-model="aiStore.textModel" :placeholder="t('ai.config.modelPlaceholder')" />
                </div>
                <!-- 温度 + Max Token -->
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <Label class="mb-1 flex items-center gap-1 text-sm font-medium">
                      {{ t('ai.settings.temperature') }}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Info class="text-gray-500" :size="14" />
                          </TooltipTrigger>
                          <TooltipContent side="top" class="z-250">
                            {{ t('ai.settings.temperatureHint') }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input v-model.number="aiStore.temperature" type="number" step="0.1" min="0" max="2" />
                  </div>
                  <div>
                    <Label class="mb-1 block text-sm font-medium">{{ t('ai.settings.maxTokens') }}</Label>
                    <Input v-model.number="aiStore.maxToken" type="number" min="1" max="32768" />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- ========== 视觉模型 ========== -->
          <AccordionItem value="vision" class="rounded-lg border overflow-hidden">
            <AccordionHeader>
              <AccordionTrigger class="flex w-full cursor-pointer select-none items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 [&[data-state=open]>svg.chevron]:rotate-180">
                <div class="flex flex-1 items-center text-left">
                  <span>{{ t('ai.settings.visionModel') }}</span>
                  <span class="ml-2 text-xs font-normal text-muted-foreground">{{ t('ai.settings.visionModelDesc') }}</span>
                </div>
                <div class="flex items-center gap-1.5" @click.stop.prevent @keydown.stop>
                  <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" :disabled="visionTesting" @click="testVision">
                    {{ t('ai.settings.testConnection') }}
                  </Button>
                  <Loader2 v-if="visionTesting" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <template v-else-if="visionTestResult">
                    <Check v-if="visionTestResult.ok" class="h-4 w-4 text-green-500" />
                    <X v-else class="h-4 w-4 text-red-500" />
                  </template>
                </div>
                <ChevronDown class="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div class="space-y-3 px-3 pb-3 pt-1">
                <!-- 服务类型 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.serviceType') }}</Label>
                  <Select v-model="aiStore.visionType">
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
                <!-- 端点 -->
                <div v-if="aiStore.visionType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiEndpoint') }}</Label>
                  <Input v-model="aiStore.visionEndpoint" :placeholder="t('ai.config.apiEndpointPlaceholder')" />
                </div>
                <!-- API Key -->
                <div v-if="aiStore.visionType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiKey') }}</Label>
                  <PasswordInput v-model="aiStore.visionApiKey" placeholder="sk-..." />
                </div>
                <!-- 模型 -->
                <div>
                  <div class="mb-1 flex items-center justify-between">
                    <Label class="text-sm font-medium">{{ t('ai.config.modelName') }}</Label>
                    <button
                      v-if="visionService.fetchModels"
                      type="button"
                      class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      :disabled="visionDynamic.loading.value || !aiStore.visionApiKey"
                      :title="t('ai.config.refreshModelsHint')"
                      @click="visionDynamic.refresh()"
                    >
                      <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': visionDynamic.loading.value }" />
                      <span>{{ visionDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                    </button>
                  </div>
                  <Select v-if="visionDynamic.allModels.value.length > 0" v-model="aiStore.visionModel">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ aiStore.visionModel || t('ai.config.selectModel') }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="m in visionDynamic.allModels.value" :key="m" :value="m">
                        {{ m }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else v-model="aiStore.visionModel" :placeholder="t('ai.config.modelPlaceholder')" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- ========== 图片生成模型 ========== -->
          <AccordionItem value="image" class="rounded-lg border overflow-hidden">
            <AccordionHeader>
              <AccordionTrigger class="flex w-full cursor-pointer select-none items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 [&[data-state=open]>svg.chevron]:rotate-180">
                <div class="flex flex-1 items-center text-left">
                  <span>{{ t('ai.settings.imageModel') }}</span>
                  <span class="ml-2 text-xs font-normal text-muted-foreground">{{ t('ai.settings.imageModelDesc') }}</span>
                </div>
                <div class="flex items-center gap-1.5" @click.stop.prevent @keydown.stop>
                  <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" :disabled="imageTesting" @click="testImage">
                    {{ t('ai.settings.testConnection') }}
                  </Button>
                  <Loader2 v-if="imageTesting" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <template v-else-if="imageTestResult">
                    <Check v-if="imageTestResult.ok" class="h-4 w-4 text-green-500" />
                    <X v-else class="h-4 w-4 text-red-500" />
                  </template>
                </div>
                <ChevronDown class="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div class="space-y-3 px-3 pb-3 pt-1">
                <!-- 服务类型 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.serviceType') }}</Label>
                  <Select v-model="aiStore.imageType">
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
                <!-- 端点 -->
                <div v-if="aiStore.imageType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiEndpoint') }}</Label>
                  <Input v-model="aiStore.imageEndpoint" :placeholder="t('ai.config.apiEndpointPlaceholder')" />
                </div>
                <!-- API Key -->
                <div v-if="aiStore.imageType !== DEFAULT_SERVICE_TYPE">
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.config.apiKey') }}</Label>
                  <PasswordInput v-model="aiStore.imageApiKey" placeholder="sk-..." />
                </div>
                <!-- 模型 -->
                <div>
                  <div class="mb-1 flex items-center justify-between">
                    <Label class="text-sm font-medium">{{ t('ai.config.modelName') }}</Label>
                    <button
                      v-if="imageService.fetchModels"
                      type="button"
                      class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      :disabled="imageDynamic.loading.value || !aiStore.imageApiKey"
                      :title="t('ai.config.refreshModelsHint')"
                      @click="imageDynamic.refresh()"
                    >
                      <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': imageDynamic.loading.value }" />
                      <span>{{ imageDynamic.loading.value ? t('ai.config.refreshModelsLoading') : t('ai.config.refreshModels') }}</span>
                    </button>
                  </div>
                  <Select v-if="imageDynamic.allModels.value.length > 0" v-model="aiStore.imageModel">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ aiStore.imageModel || t('ai.config.selectModel') }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="m in imageDynamic.allModels.value" :key="m" :value="m">
                        {{ m }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else v-model="aiStore.imageModel" :placeholder="t('ai.config.modelPlaceholder')" />
                </div>
                <!-- 图像尺寸 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.settings.imageSize') }}</Label>
                  <Select v-model="aiStore.imageSize">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ sizeOptions.find(opt => opt.value === aiStore.imageSize)?.label || aiStore.imageSize }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in sizeOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <!-- 图像质量 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.settings.imageQuality') }}</Label>
                  <Select v-model="aiStore.imageQuality">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ qualityOptions.find(opt => opt.value === aiStore.imageQuality)?.label || aiStore.imageQuality }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in qualityOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <!-- 图像风格 -->
                <div>
                  <Label class="mb-1 block text-sm font-medium">{{ t('ai.settings.imageStyle') }}</Label>
                  <Select v-model="aiStore.imageStyle">
                    <SelectTrigger class="w-full">
                      <SelectValue>{{ styleOptions.find(opt => opt.value === aiStore.imageStyle)?.label || aiStore.imageStyle }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in styleOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </AccordionRoot>
      </TabsContent>

      <!-- ==================== Params Tab ==================== -->
      <TabsContent value="params" class="mt-3 space-y-4">
        <div class="rounded-lg border p-4 space-y-4">
          <div>
            <Label class="mb-1 flex items-center gap-1 text-sm font-medium">
              {{ t('ai.settings.temperature') }}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info class="text-gray-500" :size="14" />
                  </TooltipTrigger>
                  <TooltipContent side="top" class="z-250">
                    {{ t('ai.settings.temperatureHint') }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div class="flex items-center gap-3">
              <Input
                v-model.number="aiStore.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="w-24"
              />
              <input
                v-model.number="aiStore.temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="flex-1 accent-primary"
              >
            </div>
          </div>
          <div>
            <Label class="mb-1 block text-sm font-medium">{{ t('ai.settings.maxTokens') }}</Label>
            <Input
              v-model.number="aiStore.maxToken"
              type="number"
              min="1"
              max="32768"
              class="w-40"
            />
          </div>
        </div>
      </TabsContent>

      <!-- ==================== Triggers Tab ==================== -->
      <TabsContent value="triggers" class="mt-3">
        <div class="rounded-lg border p-4 space-y-1">
          <p class="text-sm text-muted-foreground mb-4">
            {{ t('ai.settings.triggersDesc') }}
          </p>

          <!-- Auto Summary -->
          <div class="flex items-center justify-between py-3 border-b last:border-b-0">
            <div class="flex-1 mr-4">
              <div class="text-sm font-medium">
                {{ t('ai.settings.autoSummary') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('ai.settings.autoSummaryDesc') }}
              </div>
            </div>
            <Switch v-model="aiStore.autoSummary" />
          </div>

          <!-- Auto Annotate -->
          <div class="flex items-center justify-between py-3 border-b last:border-b-0">
            <div class="flex-1 mr-4">
              <div class="text-sm font-medium">
                {{ t('ai.settings.autoAnnotate') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('ai.settings.autoAnnotateDesc') }}
              </div>
            </div>
            <Switch v-model="aiStore.autoAnnotate" />
          </div>

          <!-- Auto Insight -->
          <div class="flex items-center justify-between py-3">
            <div class="flex-1 mr-4">
              <div class="text-sm font-medium">
                {{ t('ai.settings.autoInsight') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('ai.settings.autoInsightDesc') }}
              </div>
            </div>
            <Switch v-model="aiStore.autoInsight" />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
