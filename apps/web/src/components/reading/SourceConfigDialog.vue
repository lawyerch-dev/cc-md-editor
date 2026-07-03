<script setup lang="ts">
import type { Source } from '@/stores/reading'
import { Loader2, Plus, Settings2, Trash2, X } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useReadingStore } from '@/stores/reading'
import AddSourceDialog from './AddSourceDialog.vue'
import ImportFoloDialog from './ImportFoloDialog.vue'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const store = useReadingStore()

const showAddDialog = ref(false)
const showImportDialog = ref(false)
const editingSource = ref<Source | null>(null)

const REFRESH_OPTIONS = [
  { value: 0, label: () => t('common.close') },
  { value: 15, label: () => t('reading.minutes', { n: 15 }) },
  { value: 30, label: () => t('reading.minutes', { n: 30 }) },
  { value: 60, label: () => t('reading.hours', { n: 1 }) },
  { value: 120, label: () => t('reading.hours', { n: 2 }) },
  { value: 360, label: () => t('reading.hours', { n: 6 }) },
  { value: 1440, label: () => t('reading.hours', { n: 24 }) },
]

function updateInterval(src: Source, minutes: number) {
  store.updateSource(src.id, { refreshInterval: minutes })
}

function removeSource(src: Source) {
  store.removeSource(src.id)
}

function openEdit(src: Source) {
  editingSource.value = src
}

function openAdd() {
  showAddDialog.value = true
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="flex h-[80vh] w-[700px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">
          {{ t('reading.sourceManageTitle') }}
        </h2>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="outline" class="h-7 gap-1" @click="openAdd">
            <Plus class="h-3.5 w-3.5" />
            {{ t('reading.addSource') }}
          </Button>
          <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" @click="showImportDialog = true">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {{ t('reading.import') }}
          </Button>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- 源列表 -->
      <div class="flex-1 overflow-y-auto">
        <div v-for="src in store.sources" :key="src.id" class="border-b">
          <div class="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <!-- 健康状态 -->
                <span
                  v-if="src.health?.status === 'error'"
                  class="h-2 w-2 rounded-full bg-red-500 shrink-0"
                  :title="src.health.lastError"
                />
                <span
                  v-else-if="src.health?.status === 'pending'"
                  class="shrink-0"
                >
                  <Loader2 class="h-3 w-3 animate-spin text-blue-500" />
                </span>
                <span
                  v-else-if="src.health?.status === 'ok'"
                  class="h-2 w-2 rounded-full bg-green-500 shrink-0"
                />
                <span
                  v-else
                  class="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0"
                />

                <p class="text-xs font-medium truncate">
                  {{ src.title }}
                </p>
                <!-- 策略标签 -->
                <span
                  class="rounded px-1.5 py-0.5 text-[9px]"
                  :class="{
                    'bg-green-500/10 text-green-600': src.strategy === 'rss',
                    'bg-blue-500/10 text-blue-600': src.strategy === 'css-selector',
                    'bg-purple-500/10 text-purple-600': src.strategy === 'json-api',
                  }"
                >
                  {{ src.strategy === 'rss' ? 'RSS' : src.strategy === 'css-selector' ? 'CSS' : 'API' }}
                </span>
                <!-- 视图类型标签 -->
                <span
                  class="rounded px-1.5 py-0.5 text-[9px]"
                  :class="{
                    'bg-neutral-500/10 text-neutral-600': src.view === 0,
                    'bg-green-500/10 text-green-600': src.view === 1,
                    'bg-red-500/10 text-red-600': src.view === 2,
                    'bg-purple-500/10 text-purple-600': src.view === 3,
                    'bg-blue-500/10 text-blue-600': src.view === 4,
                  }"
                >
                  {{ ['文章', '图片', '视频', '音频', '社交'][src.view] || '文章' }}
                </span>
              </div>
              <p class="text-[10px] text-muted-foreground truncate mt-0.5">
                {{ src.description || src.url }}
              </p>
              <p v-if="src.health?.lastError" class="text-[9px] text-destructive truncate mt-0.5">
                {{ src.health.lastError }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <Button
                variant="outline"
                size="sm"
                class="h-6 gap-1 text-[10px]"
                @click="openEdit(src)"
              >
                <Settings2 class="h-3 w-3" />
                {{ t('reading.editSource') }}
              </Button>
              <div class="flex items-center gap-1">
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
        </div>
        <div v-if="!store.sources.length" class="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground/50">
          {{ t('reading.noSources') }}
          <Button variant="outline" size="sm" class="h-7 gap-1" @click="openAdd">
            <Plus class="h-3.5 w-3.5" />
            {{ t('reading.addSource') }}
          </Button>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-4 py-3">
        <span class="text-xs text-muted-foreground">
          {{ store.sources.length }} {{ t('reading.sourcesCount') }}
        </span>
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="store.resetToDefaults()">
          {{ t('reading.resetDefaults') }}
        </Button>
      </div>
    </div>

    <!-- 添加源对话框 -->
    <AddSourceDialog v-if="showAddDialog" @close="showAddDialog = false" />

    <!-- 编辑源对话框 -->
    <AddSourceDialog v-if="editingSource" :source="editingSource" @close="editingSource = null" />

    <!-- 导入 folo 数据 -->
    <ImportFoloDialog v-if="showImportDialog" @close="showImportDialog = false" @imported="showImportDialog = false" />
  </div>
</template>
