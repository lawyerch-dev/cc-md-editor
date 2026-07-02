<script setup lang="ts">
import { Globe, Loader2, Plus, Radio, Timer, Trash2, X } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useReadingStore } from '@/stores/reading'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const store = useReadingStore()

const newUrl = ref('')
const newTitle = ref('')
const newCategory = ref('')
const discovering = ref(false)
const discoveredRoutes = ref<Array<{ name: string, path: string }>>([])

const REFRESH_OPTIONS = [
  { value: 0, label: () => t('common.close') },
  { value: 15, label: () => t('reading.minutes', { n: 15 }) },
  { value: 30, label: () => t('reading.minutes', { n: 30 }) },
  { value: 60, label: () => t('reading.hours', { n: 1 }) },
  { value: 120, label: () => t('reading.hours', { n: 2 }) },
  { value: 360, label: () => t('reading.hours', { n: 6 }) },
  { value: 1440, label: () => t('reading.hours', { n: 24 }) },
]

/** 统一源列表：RSS + 采集器 */
function getAllSources() {
  return [
    ...store.sources.map(s => ({ ...s, sourceType: 'rss' as const, url: s.url })),
    ...store.collectors.map(s => ({ ...s, sourceType: 'collector' as const })),
  ]
}

function handleAdd() {
  if (!newUrl.value.trim())
    return
  store.addSource(newUrl.value.trim(), newTitle.value.trim() || newUrl.value.trim(), newCategory.value.trim() || t('reading.categoryPlaceholder'))
  newUrl.value = ''
  newTitle.value = ''
  newCategory.value = ''
  discoveredRoutes.value = []
}

async function handleDiscover() {
  if (!newUrl.value.trim())
    return
  discovering.value = true
  discoveredRoutes.value = []
  try { discoveredRoutes.value = await store.discoverRSSHubRoutes(newUrl.value.trim()) }
  catch { /* ignore */ }
  finally { discovering.value = false }
}

function useRoute(route: { name: string, path: string }) {
  newUrl.value = route.path
  newTitle.value = route.name.split('/').pop() || route.name
  newCategory.value = 'RSSHub'
  discoveredRoutes.value = []
}

function removeSource(src: { id: string, sourceType: 'rss' | 'collector' }) {
  if (src.sourceType === 'collector')
    store.removeCollector(src.id)
  else
    store.removeSource(src.id)
}

function updateInterval(src: { id: string, sourceType: 'rss' | 'collector' }, minutes: number) {
  if (src.sourceType === 'collector')
    store.updateCollectorInterval(src.id, minutes)
  else
    store.updateSourceInterval(src.id, minutes)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="flex h-[75vh] w-[680px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">
          {{ t('reading.sourceManageTitle') }}
        </h2>
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- 添加源 -->
      <div class="border-b p-4">
        <div class="flex gap-2">
          <Input v-model="newUrl" :placeholder="t('reading.rssPlaceholder')" class="h-8 text-xs flex-1" />
          <Input v-model="newTitle" :placeholder="t('reading.titlePlaceholder')" class="h-8 text-xs w-28" />
          <Input v-model="newCategory" :placeholder="t('reading.categoryPlaceholder')" class="h-8 text-xs w-20" />
          <Button size="sm" variant="outline" class="h-8 gap-1" :disabled="!newUrl.trim() || discovering" @click="handleDiscover">
            <Loader2 v-if="discovering" class="h-3.5 w-3.5 animate-spin" />
            <Radio v-else class="h-3.5 w-3.5" />
            {{ t('reading.discover') }}
          </Button>
          <Button size="sm" class="h-8 gap-1" @click="handleAdd">
            <Plus class="h-3.5 w-3.5" />
            {{ t('reading.add') }}
          </Button>
        </div>
        <p class="mt-1.5 text-[10px] text-muted-foreground">
          {{ t('reading.discoverHint') }}
        </p>
        <!-- RSSHub 发现结果 -->
        <div v-if="discoveredRoutes.length" class="mt-2 rounded-md border bg-muted/30 p-2">
          <p class="text-[10px] text-muted-foreground mb-1.5">
            {{ t('reading.discoveredRoutes', { count: discoveredRoutes.length }) }}
          </p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="route in discoveredRoutes.slice(0, 10)"
              :key="route.path"
              class="rounded bg-background border px-2 py-0.5 text-[10px] hover:bg-primary/10 transition-colors"
              @click="useRoute(route)"
            >
              {{ route.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- 统一源列表 -->
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="src in getAllSources()"
          :key="src.id"
          class="flex items-center justify-between border-b px-4 py-2.5 hover:bg-muted/50 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="text-xs font-medium truncate">
                {{ src.title }}
              </p>
              <span
                v-if="src.sourceType === 'collector'"
                class="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-500"
              >
                {{ t('reading.collector') }}
              </span>
              <span
                v-if="src.url.startsWith('legal://')"
                class="rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-500"
              >
                API
              </span>
            </div>
            <p class="text-[10px] text-muted-foreground truncate">
              {{ src.sourceType === 'collector' && src.description ? src.description : src.url }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-2">
            <div class="flex items-center gap-1">
              <Timer class="h-3 w-3 text-muted-foreground" />
              <select
                class="rounded border bg-background px-1.5 py-0.5 text-[10px]"
                :value="src.refreshInterval"
                @change="updateInterval(src, Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="opt in REFRESH_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label() }}
                </option>
              </select>
            </div>
            <span class="rounded-full bg-muted px-2 py-0.5 text-[10px]">
              {{ src.category }}
            </span>
            <Button variant="ghost" size="icon" class="h-6 w-6 text-destructive" @click="removeSource(src)">
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div v-if="!getAllSources().length" class="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground/50">
          <Globe class="h-8 w-8" />
          <span>{{ t('reading.noSources') }}</span>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="store.resetToDefaults()">
            {{ t('reading.resetDefaults') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
