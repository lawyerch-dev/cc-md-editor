<script setup lang="ts">
import type { FetchStrategy, Source } from '@/stores/reading'
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, Rss, Search, Settings2, Trash2, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCollectorAI } from '@/composables/useCollectorAI'
import { useReadingStore } from '@/stores/reading'
import { applyImport, importFromOpml } from '@/stores/reading/folo-import'
import { exportAllData, importAllData } from '@/stores/reading/persistence'
import CSSImportDialog from './CSSImportDialog.vue'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const store = useReadingStore()

const { analyzePage } = useCollectorAI()

const activeTab = ref<FetchStrategy>('rss')
const newUrl = ref('')
const addingSource = ref(false)
const progressMsg = ref('')
const opmlImporting = ref(false)
const opmlFileInput = ref<HTMLInputElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)
const jsonImporting = ref(false)
const fullDataFileInput = ref<HTMLInputElement | null>(null)
const fullDataImporting = ref(false)
const showCSSImport = ref(false)
const editingSource = ref<Source | null>(null)
const rsshubRoutes = ref<Array<{ name: string, path: string }>>([])
const rsshubChecking = ref(false)
const inlineError = ref('')

const REFRESH_OPTIONS = [
  { value: 0, label: () => t('common.close') },
  { value: 15, label: () => t('reading.minutes', { n: 15 }) },
  { value: 30, label: () => t('reading.minutes', { n: 30 }) },
  { value: 60, label: () => t('reading.hours', { n: 1 }) },
  { value: 120, label: () => t('reading.hours', { n: 2 }) },
  { value: 360, label: () => t('reading.hours', { n: 6 }) },
  { value: 1440, label: () => t('reading.hours', { n: 24 }) },
]

const filteredSources = computed(() => {
  if (activeTab.value === 'rss')
    return store.sources.filter(s => s.strategy === 'rss' || s.strategy === 'folo-rsshub')
  return store.sources.filter(s => s.strategy === activeTab.value)
})

const rssCount = computed(() => store.sources.filter(s => s.strategy === 'rss' || s.strategy === 'folo-rsshub').length)
const cssCount = computed(() => store.sources.filter(s => s.strategy === 'css-selector').length)

function updateInterval(src: Source, minutes: number) {
  store.updateSource(src.id, { refreshInterval: minutes })
}

function removeSource(src: Source) {
  store.removeSource(src.id)
}

function openEdit(src: Source) {
  editingSource.value = src
}

/** 行内添加数据源 */
async function handleInlineAdd() {
  const url = newUrl.value.trim()
  if (!url)
    return
  addingSource.value = true
  try {
    if (activeTab.value === 'rss') {
      const isFoloRSSHub = url.startsWith('rsshub://')
      const probe = await store.probeRSS(url)
      if (probe.isRSS) {
        store.addSource({
          url,
          title: probe.title || url,
          strategy: isFoloRSSHub ? 'folo-rsshub' : 'rss',
          view: probe.view ?? 0,
          refreshInterval: 30,
          rsshubPath: undefined,
        })
        toast.success(t('reading.added', { title: probe.title || url }))
      }
      else if (isFoloRSSHub) {
        toast.error(t('reading.rsshubProbeFailed'))
        inlineError.value = t('reading.rsshubProbeFailed')
      }
      else {
        // 直接不是 RSS，尝试 RSSHub 发现
        rsshubRoutes.value = []
        rsshubChecking.value = true
        try {
          const hostname = new URL(url).hostname
          const fnBase = window.location.origin
          const res = await window.fetch(`${fnBase}/.netlify/functions/rsshub-discover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: hostname }),
            signal: AbortSignal.timeout(8_000),
          })
          const data = await res.json() as { ok: boolean, routes?: Array<{ name: string, path: string }> }
          if (data.ok && data.routes?.length) {
            rsshubRoutes.value = data.routes
            rsshubChecking.value = false
            return // 显示路由列表让用户选择
          }
        }
        catch { /* RSSHub 不可用 */ }
        rsshubChecking.value = false
        toast.error(t('reading.rssNotFound'))
        inlineError.value = t('reading.rssNotFound')
      }
    }
    else {
      progressMsg.value = '正在获取页面 HTML...'
      const html = await store.fetchPageHTML(url)
      // 从页面 <title> 提取网站名称
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const pageTitle = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : new URL(url).hostname

      progressMsg.value = 'AI 正在分析页面结构...'
      const selectors = await analyzePage(url, html, t('reading.autoDetectDesc'), (msg: string) => {
        progressMsg.value = msg
      })
      // 如果页面有明确的 ID 容器，且 AI 用的是 class 选择器，优先用 ID 缩小范围
      // 例如 #articleList 比 .list 更精确，避免匹配到侧边栏等无关区域
      const idMatch = html.match(/id="(\w+)"[^>]+class="[^"]*\blist\b/) // id 在前
        || html.match(/class="[^"]*\blist\b[^>]+id="(\w+)"/) // class 在前
      if (idMatch && selectors.item?.startsWith('.list')) {
        selectors.item = selectors.item.replace(/^\.list/, `#${idMatch[1]}`)
      }
      store.addSource({
        url,
        title: pageTitle,
        strategy: 'css-selector',
        view: 0,
        refreshInterval: 30,
        selectors,
        rsshubPath: undefined,
      })
      toast.success(t('reading.added', { title: new URL(url).hostname }))
    }
    newUrl.value = ''
    inlineError.value = ''
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : t('reading.addFailed')
    toast.error(`${msg}。可尝试切换到「订阅源」标签用 RSS 添加`)
    inlineError.value = msg
  }
  finally {
    addingSource.value = false
  }
}

/** 添加指定的 RSSHub 路由 */
async function addRsshubRoute(route: { name: string, path: string }) {
  addingSource.value = true
  try {
    const probe = await store.probeRSS(route.path)
    if (probe.isRSS) {
      store.addSource({
        url: route.path,
        title: probe.title || route.name,
        strategy: 'rss',
        view: 0,
        refreshInterval: 30,
        rsshubPath: route.name,
      })
      toast.success(t('reading.added', { title: probe.title || route.name }))
      newUrl.value = ''
      rsshubRoutes.value = []
    }
    else {
      toast.error(t('reading.rssNotFound'))
    }
  }
  catch {
    toast.error(t('reading.addFailed'))
  }
  finally {
    addingSource.value = false
  }
}

function formatHealthTime(timestamp: number | undefined): string {
  if (!timestamp)
    return ''
  return new Date(timestamp).toLocaleTimeString()
}

/** OPML 文件选择后直接导入 */
async function onOpmlFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  opmlImporting.value = true
  try {
    const text = await file.text()
    const result = importFromOpml(text)
    if (result.sources.length === 0) {
      toast.error(t('reading.importNoSources'))
      return
    }
    await applyImport(result.sources, [])
    await store.reloadFromStorage()
    toast.success(t('reading.importStats', { sources: result.sources.length, articles: 0 }))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('reading.importFailed'))
  }
  finally {
    opmlImporting.value = false
    if (opmlFileInput.value)
      opmlFileInput.value.value = ''
  }
}

/** 导出所有数据源为 JSON 文件 */
function exportSources() {
  const data = store.sources.map((s) => {
    // 排除运行时字段
    const { health, ...exported } = s
    return exported
  })
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), sources: data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `md-sources-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(t('reading.exportSuccess', { n: data.length }))
}

/** 从 JSON 文件导入数据源 */
async function importSourcesFromFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  jsonImporting.value = true
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.sources || !Array.isArray(data.sources))
      throw new Error('Invalid format')
    await applyImport(data.sources, [])
    await store.reloadFromStorage()
    toast.success(t('reading.importStats', { sources: data.sources.length, articles: 0 }))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('reading.importFailed'))
  }
  finally {
    jsonImporting.value = false
    if (jsonFileInput.value)
      jsonFileInput.value.value = ''
  }
}

/** 导出全部数据（源+文章+收藏） */
async function exportFullData() {
  try {
    const data = await exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `md-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('reading.exportFullSuccess', { sources: data.sources.length, articles: data.articles.length }))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('reading.exportFailed'))
  }
}

/** 从 JSON 文件导入全部数据 */
async function importFullDataFromFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  fullDataImporting.value = true
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    await importAllData(data)
    await store.reloadFromStorage()
    toast.success(t('reading.importFullSuccess', { sources: data.sources.length, articles: data.articles.length }))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('reading.importFailed'))
  }
  finally {
    fullDataImporting.value = false
    if (fullDataFileInput.value)
      fullDataFileInput.value.value = ''
  }
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
        <div class="flex items-center gap-1.5">
          <input ref="jsonFileInput" type="file" accept=".json" class="hidden" @change="importSourcesFromFile">
          <input ref="fullDataFileInput" type="file" accept=".json" class="hidden" @change="importFullDataFromFile">
          <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" @click="exportSources()">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            {{ t('reading.exportSources') }}
          </Button>
          <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" :disabled="jsonImporting" @click="jsonFileInput?.click()">
            <template v-if="jsonImporting">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            </template>
            <template v-else>
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </template>
            {{ t('reading.importSources') }}
          </Button>
          <div class="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" @click="exportFullData()">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            {{ t('reading.exportAll') }}
          </Button>
          <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" :disabled="fullDataImporting" @click="fullDataFileInput?.click()">
            <template v-if="fullDataImporting">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            </template>
            <template v-else>
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </template>
            {{ t('reading.importAll') }}
          </Button>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="flex items-center justify-center border-b px-4">
        <button
          class="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
          :class="activeTab === 'rss' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'rss'"
        >
          <Rss class="h-3.5 w-3.5" />
          RSS {{ t('reading.tabRSS') }}
          <span class="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{{ rssCount }}</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
          :class="activeTab === 'css-selector' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'css-selector'"
        >
          <Search class="h-3.5 w-3.5" />
          {{ t('reading.tabCSS') }}
          <span class="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{{ cssCount }}</span>
        </button>
      </div>

      <!-- 操作栏（行内添加） -->
      <div class="flex items-center gap-2 border-b px-4 py-2">
        <div class="flex-1 flex items-center gap-2">
          <Input
            v-model="newUrl"
            class="h-8 text-xs flex-1"
            :placeholder="activeTab === 'rss' ? t('reading.rssPlaceholder') : t('reading.cssPlaceholder')"
            @input="inlineError = ''"
            @keydown.enter="handleInlineAdd"
          />
          <Button size="sm" class="h-8 gap-1 text-xs shrink-0" :disabled="!newUrl.trim() || addingSource" @click="handleInlineAdd">
            <template v-if="addingSource">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {{ progressMsg || t('reading.detecting') }}
            </template>
            <template v-else>
              <template v-if="activeTab === 'rss'">
                <Rss class="h-3.5 w-3.5" />
              </template>
              <template v-else>
                <Search class="h-3.5 w-3.5" />
              </template>
              {{ t('reading.add') }}
            </template>
          </Button>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <input ref="opmlFileInput" type="file" accept=".opml,.xml" class="hidden" @change="onOpmlFileSelected">
          <Button v-if="activeTab === 'rss'" size="sm" variant="outline" class="h-8 gap-1 text-xs" :disabled="opmlImporting" @click="opmlFileInput?.click()">
            <template v-if="opmlImporting">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            </template>
            <template v-else>
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </template>
            OPML
          </Button>
          <Button v-if="activeTab === 'css-selector'" size="sm" variant="outline" class="h-8 gap-1 text-xs" @click="showCSSImport = true">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            JSON
          </Button>
        </div>
      </div>

      <!-- 内联错误提示 -->
      <div v-if="inlineError" class="border-b bg-red-50 dark:bg-red-950/20 px-4 py-2 flex items-center gap-2">
        <AlertCircle class="h-3.5 w-3.5 text-red-500 shrink-0" />
        <span class="text-xs text-red-600 dark:text-red-400 flex-1">{{ inlineError }}</span>
        <button class="text-xs text-neutral-400 hover:text-neutral-600" @click="inlineError = ''">
          关闭
        </button>
      </div>

      <!-- RSSHub 路由发现结果 -->
      <div v-if="rsshubRoutes.length" class="border-b px-4 py-3 bg-orange-50 dark:bg-orange-950/20">
        <div class="flex items-center gap-2 mb-2">
          <Rss class="h-4 w-4 text-orange-500" />
          <span class="text-sm font-medium text-orange-700 dark:text-orange-300">发现 {{ rsshubRoutes.length }} 个 RSSHub 路由：</span>
          <button class="ml-auto text-xs text-neutral-400 hover:text-neutral-600" @click="rsshubRoutes = []">
            关闭
          </button>
        </div>
        <div class="space-y-1">
          <button
            v-for="route in rsshubRoutes"
            :key="route.path"
            class="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-left hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            :disabled="addingSource"
            @click="addRsshubRoute(route)"
          >
            <Rss class="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span class="truncate text-neutral-700 dark:text-neutral-300">{{ route.name }}</span>
            <Loader2 v-if="addingSource" class="h-3 w-3 animate-spin text-orange-500 ml-auto" />
          </button>
        </div>
        <p class="text-[10px] text-neutral-400 mt-2">
          点击添加 RSS 订阅源，比网页采集更稳定
        </p>
      </div>
      <div v-else-if="rsshubChecking" class="border-b px-4 py-2 bg-orange-50/50 dark:bg-orange-950/10">
        <div class="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
          <span>正在探测 RSSHub 路由...</span>
        </div>
      </div>

      <!-- 源列表 -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="!filteredSources.length" class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/40">
          <template v-if="activeTab === 'rss'">
            <Rss class="h-10 w-10" />
            <span class="text-xs">{{ t('reading.noRSSSources') }}</span>
          </template>
          <template v-else>
            <Search class="h-10 w-10" />
            <span class="text-xs">{{ t('reading.noCSSSources') }}</span>
          </template>
        </div>
        <div v-for="src in filteredSources" :key="src.id" class="border-b last:border-b-0">
          <div class="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <!-- 健康状态 / 稳定性 -->
                <TooltipProvider v-if="src.health?.status === 'error'" :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <AlertCircle class="h-3.5 w-3.5 text-red-500 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-xs text-xs">
                      <p>{{ src.health.lastError }}</p>
                      <p v-if="src.health.lastFetchAt" class="text-muted-foreground mt-1">
                        {{ formatHealthTime(src.health.lastFetchAt) }}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span
                  v-else-if="src.health?.status === 'ok'"
                  class="shrink-0"
                >
                  <CheckCircle2 class="h-3.5 w-3.5 text-green-500" />
                </span>
                <span
                  v-else-if="src.health?.status === 'pending'"
                  class="shrink-0"
                >
                  <Loader2 class="h-3 w-3 animate-spin text-blue-500" />
                </span>
                <span
                  v-else
                  class="shrink-0"
                >
                  <!-- 从未获取过 = 未检测 -->
                  <span class="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                </span>

                <!-- RSSHub 标记 -->
                <span
                  v-if="src.rsshubPath"
                  class="rounded px-1 py-0.5 text-[9px] bg-orange-500/10 text-orange-600 shrink-0 leading-none"
                  title="通过 RSSHub 获取"
                >RSSHub</span>
                <!-- Folo 代理标记 -->
                <span
                  v-if="src.strategy === 'folo-rsshub'"
                  class="rounded px-1 py-0.5 text-[9px] bg-blue-500/10 text-blue-600 shrink-0 leading-none"
                  title="通过 Folo API 代理获取"
                >Folo</span>

                <p class="text-xs font-medium truncate">
                  {{ src.title }}
                </p>
              </div>
              <p class="text-[10px] text-muted-foreground truncate mt-0.5">
                {{ src.rsshubPath ? `RSSHub: ${src.rsshubPath}` : (src.description || src.url) }}
              </p>
              <p v-if="src.health?.lastError" class="text-[9px] text-destructive truncate mt-0.5">
                {{ src.health.lastError }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <Button
                v-if="src.health?.status === 'error'"
                variant="outline"
                size="sm"
                class="h-6 gap-1 text-[10px]"
                :disabled="!!store.fetchingSourceIds[src.id]"
                @click="store.fetchSingleSource(src.id)"
              >
                <RefreshCcw v-if="!store.fetchingSourceIds[src.id]" class="h-3 w-3" />
                <Loader2 v-else class="h-3 w-3 animate-spin" />
                {{ t('reading.retry') || '重试' }}
              </Button>
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
              <Button variant="ghost" size="icon" class="h-6 w-6 text-destructive" @click="removeSource(src)">
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-4 py-3">
        <span class="text-xs text-muted-foreground">
          {{ filteredSources.length }} / {{ store.sources.length }} {{ t('reading.sourcesCount') }}
        </span>
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="store.resetToDefaults()">
          {{ t('reading.resetDefaults') }}
        </Button>
      </div>
    </div>

    <!-- 编辑源对话框 -->
    <AddSourceDialog v-if="editingSource" :source="editingSource" @close="editingSource = null" />

    <!-- 网页采集导入（JSON） -->
    <CSSImportDialog v-if="showCSSImport" @close="showCSSImport = false" @imported="showCSSImport = false" />
  </div>
</template>
