<script setup lang="ts">
import type { ModelRole, Provider } from '@md/shared/types'
import {
  Brain,
  Eye,
  Image,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Wand2,
  X,
} from '@lucide/vue'
import { providerTemplates } from '@md/shared/configs/ai-provider-templates'
import { MODEL_ROLES } from '@md/shared/types'
import { inferRole } from '@/ai/role-inference'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
import { useAIProviderStore } from '@/stores/aiProvider'

const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const providerStore = useAIProviderStore()

// ── Local state ──
const showTemplatePicker = ref(false)
const newManualModel = ref<Record<string, string>>({})
const apiKeyInputs = ref<Record<string, string>>({})

// ── Role display helpers ──
const ROLE_META: Record<ModelRole, { icon: string, color: string }> = {
  reasoning: { icon: '🧠', color: 'text-purple-500' },
  fast: { icon: '⚡', color: 'text-yellow-500' },
  vision: { icon: '👁', color: 'text-blue-500' },
  image: { icon: '🎨', color: 'text-pink-500' },
}

const ROLE_BADGE_COLORS: Record<ModelRole, string> = {
  reasoning: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  fast: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  vision: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  image: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
}

// ── Providers tab helpers ──
function maskKey(key: string): string {
  if (!key)
    return ''
  if (key.length <= 8)
    return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

function getFetchStatusIcon(status: Provider['fetchStatus']) {
  switch (status) {
    case 'loading': return Loader2
    case 'ok': return Check
    case 'error': return X
    default: return RefreshCw
  }
}

function getModelCount(provider: Provider): number {
  return provider.models.length + provider.manualModels.length
}

function addFromTemplate(templateId: string) {
  providerStore.addProvider(templateId)
  showTemplatePicker.value = false
}

function handleApiKeyEnter(provider: Provider) {
  const key = apiKeyInputs.value[provider.id]
  if (key) {
    provider.apiKey = key
    providerStore.fetchModels(provider.id)
    delete apiKeyInputs.value[provider.id]
  }
}

function addManualModel(provider: Provider) {
  const model = newManualModel.value[provider.id]?.trim()
  if (model && !provider.manualModels.includes(model)) {
    provider.manualModels.push(model)
    newManualModel.value[provider.id] = ''
  }
}

function _removeManualModel(provider: Provider, modelId: string) {
  const idx = provider.manualModels.indexOf(modelId)
  if (idx !== -1)
    provider.manualModels.splice(idx, 1)
}

function isExcluded(modelId: string): boolean {
  return inferRole(modelId) === null
}

// ── Roles tab helpers ──
function getAssignmentDisplay(role: ModelRole): string {
  const assignment = providerStore.roleAssignments[role]
  if (!assignment)
    return ''
  const provider = providerStore.providers.find(p => p.id === assignment.providerId)
  return provider ? `${provider.name} / ${assignment.modelId}` : assignment.modelId
}

function getAssignmentStatus(role: ModelRole): 'manual' | 'auto' | 'none' {
  const assignment = providerStore.roleAssignments[role]
  if (assignment)
    return 'manual'
  const resolved = providerStore.resolveRole(role)
  if (resolved)
    return 'auto'
  return 'none'
}

function getResolvedModel(role: ModelRole): string | null {
  const resolved = providerStore.resolveRole(role)
  return resolved?.model ?? null
}

// ── Triggers tab helpers ──
function getTriggerModel(role: ModelRole): string | null {
  const resolved = providerStore.resolveRole(role)
  return resolved?.model ?? null
}

// ── Image role check ──
const hasImageRole = computed(() => {
  return providerStore.resolveRole('image') !== null
})

// ── Save ──
function saveConfig() {
  emit('saved')
}

defineExpose({ saveConfig })
</script>

<template>
  <div class="flex flex-col gap-4">
    <Tabs default-value="providers" class="w-full">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="providers">
          {{ t('ai.settings.tabProviders') }}
        </TabsTrigger>
        <TabsTrigger value="roles">
          {{ t('ai.settings.tabRoles') }}
        </TabsTrigger>
        <TabsTrigger value="params">
          {{ t('ai.settings.tabParams') }}
        </TabsTrigger>
        <TabsTrigger value="triggers">
          {{ t('ai.settings.tabTriggers') }}
        </TabsTrigger>
      </TabsList>

      <!-- ==================== TAB 1: Providers ==================== -->
      <TabsContent value="providers" class="space-y-4">
        <!-- Empty state -->
        <div
          v-if="providerStore.providers.length === 0 && !showTemplatePicker"
          class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center"
        >
          <Settings class="mb-2 h-8 w-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            {{ t('ai.settings.noProviders') }}
          </p>
          <p class="mb-4 text-xs text-muted-foreground">
            {{ t('ai.settings.addProviderHint') }}
          </p>
          <Button size="sm" @click="showTemplatePicker = true">
            <Plus class="mr-1 h-3 w-3" />
            {{ t('ai.settings.addProvider') }}
          </Button>
        </div>

        <!-- Provider cards -->
        <div v-for="provider in providerStore.providers" :key="provider.id" class="rounded-lg border p-4 space-y-3">
          <!-- Header row -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ provider.name }}</span>
              <span
                v-if="provider.isDefault"
                class="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {{ t('ai.settings.defaultBadge') }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="provider.fetchStatus === 'loading'"
                      @click="providerStore.fetchModels(provider.id)"
                    >
                      <component
                        :is="getFetchStatusIcon(provider.fetchStatus)"
                        class="h-3.5 w-3.5"
                        :class="{ 'animate-spin': provider.fetchStatus === 'loading' }"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('ai.settings.refreshModels') }}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :class="{ 'text-yellow-500': provider.isDefault }"
                      @click="providerStore.setDefaultProvider(provider.id)"
                    >
                      <Star class="h-3.5 w-3.5" :fill="provider.isDefault ? 'currentColor' : 'none'" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('ai.settings.setDefault') }}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7 text-destructive"
                      @click="providerStore.removeProvider(provider.id)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('ai.settings.removeProvider') }}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <!-- Endpoint & Key -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-muted-foreground">{{ t('ai.settings.providerEndpoint') }}:</span>
              <span class="ml-1 break-all">{{ provider.endpoint || '—' }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('ai.settings.providerKey') }}:</span>
              <span class="ml-1 font-mono">{{ maskKey(provider.apiKey) }}</span>
            </div>
          </div>

          <!-- API Key input (for new providers) -->
          <div v-if="!provider.apiKey" class="flex gap-2">
            <PasswordInput
              v-model="apiKeyInputs[provider.id]"
              :placeholder="t('ai.settings.apiKeyPlaceholder')"
              class="flex-1 h-8 text-xs"
              @keydown.enter="handleApiKeyEnter(provider)"
            />
            <Button size="sm" class="h-8" @click="handleApiKeyEnter(provider)">
              <Check class="mr-1 h-3 w-3" />
              OK
            </Button>
          </div>

          <!-- Fetch error -->
          <div v-if="provider.fetchStatus === 'error'" class="flex items-center gap-1 text-xs text-destructive">
            <Info class="h-3 w-3" />
            {{ t('ai.settings.fetchError') }}: {{ provider.fetchError }}
          </div>

          <!-- Models -->
          <div>
            <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              {{ t('ai.settings.providerModels') }}
              <span class="rounded bg-muted px-1 py-0.5 text-[10px]">
                {{ t('ai.settings.modelsFetched', { count: getModelCount(provider) }) }}
              </span>
            </div>
            <div class="flex flex-wrap gap-1">
              <template v-for="modelId in [...provider.models, ...provider.manualModels]" :key="modelId">
                <span
                  v-if="isExcluded(modelId)"
                  class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground"
                >
                  {{ modelId }}
                  <span class="ml-1 text-[9px] opacity-70">{{ t('ai.settings.excluded') }}</span>
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
                  :class="ROLE_BADGE_COLORS[inferRole(modelId) as ModelRole] ?? 'bg-muted'"
                >
                  {{ modelId }}
                  <span class="ml-1">{{ ROLE_META[inferRole(modelId) as ModelRole]?.icon }}</span>
                </span>
              </template>
            </div>

            <!-- Manual model input -->
            <div class="mt-2 flex gap-2">
              <Input
                v-model="newManualModel[provider.id]"
                :placeholder="t('ai.settings.manualModel')"
                class="h-7 flex-1 text-xs"
                @keydown.enter="addManualModel(provider)"
              />
              <Button variant="outline" size="sm" class="h-7" @click="addManualModel(provider)">
                <Plus class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Add provider button / template picker -->
        <div v-if="providerStore.providers.length > 0">
          <Button
            v-if="!showTemplatePicker"
            variant="outline"
            size="sm"
            class="w-full"
            @click="showTemplatePicker = true"
          >
            <Plus class="mr-1 h-3 w-3" />
            {{ t('ai.settings.addProvider') }}
          </Button>

          <!-- Template picker grid -->
          <div v-if="showTemplatePicker" class="rounded-lg border p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ t('ai.settings.addProvider') }}</span>
              <Button variant="ghost" size="icon" class="h-6 w-6" @click="showTemplatePicker = false">
                <X class="h-3.5 w-3.5" />
              </Button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="tpl in providerTemplates"
                :key="tpl.id"
                class="flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors hover:bg-accent"
                :class="{
                  'ring-2 ring-primary border-primary/50 bg-primary/5': tpl.id === 'xiaomi-token-plan',
                }"
                @click="addFromTemplate(tpl.id)"
              >
                <span class="text-xs font-medium">{{ tpl.name }}</span>
                <span class="text-[10px] text-muted-foreground">
                  {{ tpl.defaultModels.length || '∞' }} {{ t('ai.settings.tabProviders').toLowerCase() }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- ==================== TAB 2: Roles ==================== -->
      <TabsContent value="roles" class="space-y-4">
        <p class="text-xs text-muted-foreground">
          {{ t('ai.settings.selectModel') }}
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="role in MODEL_ROLES"
            :key="role"
            class="rounded-lg border p-4 space-y-3"
          >
            <!-- Role header -->
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ ROLE_META[role].icon }}</span>
              <div>
                <div class="text-sm font-medium">
                  {{ t(`ai.settings.role${role.charAt(0).toUpperCase() + role.slice(1)}`) }}
                </div>
                <div class="text-[10px] text-muted-foreground">
                  {{ t(`ai.settings.role${role.charAt(0).toUpperCase() + role.slice(1)}Desc`) }}
                </div>
              </div>
            </div>

            <!-- Status badge -->
            <div>
              <span
                v-if="getAssignmentStatus(role) === 'manual'"
                class="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
              >
                {{ t('ai.settings.manualAssigned') }}
              </span>
              <span
                v-else-if="getAssignmentStatus(role) === 'auto'"
                class="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {{ t('ai.settings.autoInferred') }}
              </span>
              <span
                v-else
                class="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
              >
                {{ t('ai.settings.noModel') }}
              </span>
            </div>

            <!-- Current model display -->
            <div v-if="getAssignmentDisplay(role)" class="text-xs text-muted-foreground truncate">
              {{ getAssignmentDisplay(role) }}
            </div>
            <div v-else-if="getResolvedModel(role)" class="text-xs text-muted-foreground">
              {{ getResolvedModel(role) }}
            </div>

            <!-- Model selector -->
            <Select
              :model-value="providerStore.roleAssignments[role]?.modelId ?? ''"
              @update:model-value="(val: string) => {
                if (val) {
                  // Find which provider owns this model
                  for (const p of providerStore.providers) {
                    if ([...p.models, ...p.manualModels].includes(val)) {
                      providerStore.setRoleAssignment(role, p.id, val)
                      break
                    }
                  }
                }
              }"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue :placeholder="t('ai.settings.selectModel')" />
              </SelectTrigger>
              <SelectContent>
                <template v-for="provider in providerStore.providers" :key="provider.id">
                  <SelectLabel class="text-xs font-medium text-muted-foreground">
                    {{ provider.name }}
                  </SelectLabel>
                  <SelectItem
                    v-for="modelId in [...provider.models, ...provider.manualModels]"
                    :key="`${provider.id}:${modelId}`"
                    :value="modelId"
                    :disabled="isExcluded(modelId)"
                    class="text-xs"
                  >
                    <span class="flex items-center gap-1">
                      {{ modelId }}
                      <span v-if="isExcluded(modelId)" class="text-muted-foreground">
                        ({{ t('ai.settings.excluded') }})
                      </span>
                      <span v-else-if="inferRole(modelId)">
                        {{ ROLE_META[inferRole(modelId)!]?.icon }}
                      </span>
                    </span>
                  </SelectItem>
                </template>
              </SelectContent>
            </Select>

            <!-- Clear button -->
            <Button
              v-if="providerStore.roleAssignments[role]"
              variant="ghost"
              size="sm"
              class="h-6 w-full text-xs text-muted-foreground"
              @click="providerStore.clearRoleAssignment(role)"
            >
              <X class="mr-1 h-3 w-3" />
              {{ t('ai.settings.clearAssignment') }}
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- ==================== TAB 3: Params ==================== -->
      <TabsContent value="params" class="space-y-4">
        <!-- Temperature -->
        <div class="space-y-2">
          <Label class="text-sm">{{ t('ai.settings.temperature') }}</Label>
          <p class="text-[10px] text-muted-foreground">
            {{ t('ai.settings.temperatureHint') }}
          </p>
          <div class="flex items-center gap-3">
            <input
              v-model.number="providerStore.temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="flex-1"
            >
            <Input
              v-model.number="providerStore.temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              class="w-20 h-8 text-xs"
            />
          </div>
        </div>

        <Separator />

        <!-- Max Tokens -->
        <div class="space-y-2">
          <Label class="text-sm">{{ t('ai.settings.maxTokens') }}</Label>
          <Input
            v-model.number="providerStore.maxToken"
            type="number"
            min="256"
            step="256"
            class="w-40 h-8 text-xs"
          />
        </div>

        <!-- Image params (only if image role is configured) -->
        <template v-if="hasImageRole">
          <Separator />

          <div class="space-y-3">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Image class="h-4 w-4" />
              {{ t('ai.settings.imageModel') }}
            </div>
            <p class="text-[10px] text-muted-foreground">
              {{ t('ai.settings.imageParamsNote') }}
            </p>

            <!-- Image Size -->
            <div class="space-y-1">
              <Label class="text-xs">{{ t('ai.settings.imageSize') }}</Label>
              <Select v-model="providerStore.imageSize">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">
                    {{ t('ai.settings.sizeSquare') }}
                  </SelectItem>
                  <SelectItem value="1792x1024">
                    {{ t('ai.settings.sizeLandscape') }}
                  </SelectItem>
                  <SelectItem value="1024x1792">
                    {{ t('ai.settings.sizePortrait') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Image Quality -->
            <div class="space-y-1">
              <Label class="text-xs">{{ t('ai.settings.imageQuality') }}</Label>
              <Select v-model="providerStore.imageQuality">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    {{ t('ai.settings.qualityStandard') }}
                  </SelectItem>
                  <SelectItem value="hd">
                    {{ t('ai.settings.qualityHd') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Image Style -->
            <div class="space-y-1">
              <Label class="text-xs">{{ t('ai.settings.imageStyle') }}</Label>
              <Select v-model="providerStore.imageStyle">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivid">
                    {{ t('ai.settings.styleVivid') }}
                  </SelectItem>
                  <SelectItem value="natural">
                    {{ t('ai.settings.styleNatural') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </template>
      </TabsContent>

      <!-- ==================== TAB 4: Triggers ==================== -->
      <TabsContent value="triggers" class="space-y-4">
        <p class="text-xs text-muted-foreground">
          {{ t('ai.settings.triggersDesc') }}
        </p>

        <div class="space-y-3">
          <!-- Auto Summary -->
          <div class="rounded-lg border p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Brain class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-sm font-medium">
                    {{ t('ai.settings.autoSummary') }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ t('ai.settings.autoSummaryDesc') }}
                  </div>
                </div>
              </div>
              <Switch v-model="providerStore.triggerSummary.enabled" />
            </div>
            <div v-if="providerStore.triggerSummary.enabled" class="space-y-2">
              <Label class="text-xs">{{ t('ai.settings.triggerRole') }}</Label>
              <Select v-model="providerStore.triggerSummary.role">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in MODEL_ROLES" :key="role" :value="role">
                    <span class="flex items-center gap-1">
                      {{ ROLE_META[role].icon }}
                      {{ t(`ai.settings.role${role.charAt(0).toUpperCase() + role.slice(1)}`) }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div class="text-[10px] text-muted-foreground">
                <template v-if="getTriggerModel(providerStore.triggerSummary.role)">
                  ✅ {{ getTriggerModel(providerStore.triggerSummary.role) }}
                </template>
                <template v-else>
                  ⚠️ {{ t('ai.settings.noModel') }}
                </template>
              </div>
            </div>
          </div>

          <!-- Auto Annotate -->
          <div class="rounded-lg border p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Wand2 class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-sm font-medium">
                    {{ t('ai.settings.autoAnnotate') }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ t('ai.settings.autoAnnotateDesc') }}
                  </div>
                </div>
              </div>
              <Switch v-model="providerStore.triggerAnnotate.enabled" />
            </div>
            <div v-if="providerStore.triggerAnnotate.enabled" class="space-y-2">
              <Label class="text-xs">{{ t('ai.settings.triggerRole') }}</Label>
              <Select v-model="providerStore.triggerAnnotate.role">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in MODEL_ROLES" :key="role" :value="role">
                    <span class="flex items-center gap-1">
                      {{ ROLE_META[role].icon }}
                      {{ t(`ai.settings.role${role.charAt(0).toUpperCase() + role.slice(1)}`) }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div class="text-[10px] text-muted-foreground">
                <template v-if="getTriggerModel(providerStore.triggerAnnotate.role)">
                  ✅ {{ getTriggerModel(providerStore.triggerAnnotate.role) }}
                </template>
                <template v-else>
                  ⚠️ {{ t('ai.settings.noModel') }}
                </template>
              </div>
            </div>
          </div>

          <!-- Active Insight -->
          <div class="rounded-lg border p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Eye class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-sm font-medium">
                    {{ t('ai.settings.autoInsight') }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ t('ai.settings.autoInsightDesc') }}
                  </div>
                </div>
              </div>
              <Switch v-model="providerStore.triggerInsight.enabled" />
            </div>
            <div v-if="providerStore.triggerInsight.enabled" class="space-y-2">
              <Label class="text-xs">{{ t('ai.settings.triggerRole') }}</Label>
              <Select v-model="providerStore.triggerInsight.role">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in MODEL_ROLES" :key="role" :value="role">
                    <span class="flex items-center gap-1">
                      {{ ROLE_META[role].icon }}
                      {{ t(`ai.settings.role${role.charAt(0).toUpperCase() + role.slice(1)}`) }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div class="text-[10px] text-muted-foreground">
                <template v-if="getTriggerModel(providerStore.triggerInsight.role)">
                  ✅ {{ getTriggerModel(providerStore.triggerInsight.role) }}
                </template>
                <template v-else>
                  ⚠️ {{ t('ai.settings.noModel') }}
                </template>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
