<script setup lang="ts">
import type { CollectorSelectors, FetchStrategy, Source } from '@/stores/reading'
import { Loader2, Plus, Search, Settings2, X } from '@lucide/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCollectorAI } from '@/composables/useCollectorAI'
import { useReadingStore } from '@/stores/reading'

const props = defineProps<{
  /** 编辑模式：传入已有源 */
  source?: Source
}>()

const emit = defineEmits<{
  close: []
  added: [source: Source]
}>()

const { t } = useI18n()
const store = useReadingStore()
const { analyzePage } = useCollectorAI()

// ── 表单状态 ──────────────────────────────────────────

const url = ref(props.source?.url || '')
const title = ref(props.source?.title || '')
const category = ref(props.source?.category || '')
const refreshInterval = ref(props.source?.refreshInterval ?? 30)
const strategy = ref<FetchStrategy>(props.source?.strategy || 'rss')
const selectors = ref<CollectorSelectors>(
  props.source?.selectors || { item: '', title: '', link: '', content: '', summary: '', author: '', date: '' },
)
const description = ref(props.source?.description || '')

// ── 检测状态 ──────────────────────────────────────────

const step = ref<'input' | 'config'>(props.source ? 'config' : 'input')
const detecting = ref(false)
const detectError = ref('')
const detectedTitle = ref('')
const detectedItemCount = ref(0)
const previewArticles = ref<Array<{ title: string, link: string }>>([])
const previewing = ref(false)
const showAdvanced = ref(false)
const discoveredRoutes = ref<Array<{ name: string, path: string }>>([])

const isEdit = !!props.source

const REFRESH_OPTIONS = [
  { value: 0, label: () => t('common.close') },
  { value: 15, label: () => t('reading.minutes', { n: 15 }) },
  { value: 30, label: () => t('reading.minutes', { n: 30 }) },
  { value: 60, label: () => t('reading.hours', { n: 1 }) },
  { value: 120, label: () => t('reading.hours', { n: 2 }) },
  { value: 360, label: () => t('reading.hours', { n: 6 }) },
  { value: 1440, label: () => t('reading.hours', { n: 24 }) },
]

const STRATEGY_OPTIONS: Array<{ value: FetchStrategy, label: string }> = [
  { value: 'rss', label: t('reading.strategyRss') },
  { value: 'css-selector', label: t('reading.strategyCssSelector') },
  { value: 'json-api', label: t('reading.strategyJsonApi') },
]

// ── 采集脚本模板 ──────────────────────────────────────

interface ScriptTemplate {
  label: string
  selectors: CollectorSelectors
}

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    label: t('reading.templateNewsList'),
    selectors: {
      item: '.news-list li, .article-list li, .list-item, article',
      title: 'a, h2 a, h3 a, .title a',
      link: 'a[href]',
      content: '',
      summary: '.summary, .desc, .description, p',
      author: '.author, .source',
      date: '.date, .time, time, .publish-date',
    },
  },
  {
    label: t('reading.templateBlogPosts'),
    selectors: {
      item: '.post, .article, .entry, article',
      title: 'h2 a, h3 a, .post-title a, .entry-title a',
      link: 'a[href]',
      content: '',
      summary: '.excerpt, .post-excerpt, .entry-summary, .post-body p',
      author: '.author, .post-author',
      date: '.post-date, time, .date',
    },
  },
  {
    label: t('reading.templateForumThreads'),
    selectors: {
      item: '.thread, .topic, .post-item, tr',
      title: '.thread-title a, .topic-title a, td a',
      link: 'a[href]',
      content: '',
      summary: '',
      author: '.author, .username, .poster',
      date: '.post-date, .time, td:last-child',
    },
  },
  {
    label: t('reading.templateGovPolicy'),
    selectors: {
      item: 'li, .news_item, .list-item, tr',
      title: 'a',
      link: 'a[href]',
      content: '',
      summary: '',
      author: '',
      date: 'span, .date, time, td:last-child',
    },
  },
  {
    label: t('reading.templateLegalDoc'),
    selectors: {
      item: 'a[href*="article"], a[href*="content"], li a',
      title: '',
      link: '',
      content: '',
      summary: '',
      author: '',
      date: '.date, .time, span, time',
    },
  },
]

// ── 自动检测 ──────────────────────────────────────────

async function handleDetect() {
  if (!url.value.trim())
    return
  detecting.value = true
  detectError.value = ''
  detectedTitle.value = ''
  detectedItemCount.value = 0
  discoveredRoutes.value = []

  try {
    // 1. 先尝试 RSS
    const probe = await store.probeRSS(url.value.trim())
    if (probe.isRSS) {
      strategy.value = 'rss'
      detectedTitle.value = probe.title || ''
      detectedItemCount.value = probe.itemCount || 0
      if (!title.value && probe.title)
        title.value = probe.title
      step.value = 'config'
      return
    }

    // 2. 不是 RSS → 尝试 RSSHub 发现
    const routes = await store.discoverRSSHubRoutes(url.value.trim())
    if (routes.length > 0) {
      discoveredRoutes.value = routes
      // 不自动切换到 config，让用户选择路由
    }

    // 3. 尝试 AI 分析生成 CSS 选择器
    const html = await store.fetchPageHTML(url.value.trim())
    const analyzed = await analyzePage(
      url.value.trim(),
      html,
      description.value.trim() || t('reading.autoDetectDesc'),
    )
    strategy.value = 'css-selector'
    selectors.value = analyzed
    if (!title.value)
      title.value = new URL(url.value.trim()).hostname

    // 自动预览
    const articles = await store.previewSelectors(url.value.trim(), analyzed)
    previewArticles.value = articles.slice(0, 5).map(a => ({ title: a.title, link: a.link }))

    step.value = 'config'
  }
  catch (e) {
    detectError.value = e instanceof Error ? e.message : t('reading.detectFailed')
  }
  finally {
    detecting.value = false
  }
}

function useRoute(route: { name: string, path: string }) {
  url.value = route.path
  title.value = route.name.split('/').pop() || route.name
  category.value = 'RSSHub'
  strategy.value = 'rss'
  discoveredRoutes.value = []
  step.value = 'config'
}

// ── 预览 ──────────────────────────────────────────────

async function handlePreview() {
  if (!url.value.trim())
    return
  previewing.value = true
  previewArticles.value = []
  try {
    if (strategy.value === 'css-selector') {
      const articles = await store.previewSelectors(url.value.trim(), selectors.value)
      previewArticles.value = articles.slice(0, 5).map(a => ({ title: a.title, link: a.link }))
    }
  }
  catch {
    previewArticles.value = []
  }
  finally {
    previewing.value = false
  }
}

// ── 保存 ──────────────────────────────────────────────

function handleSave() {
  if (!url.value.trim())
    return

  const data = {
    url: url.value.trim(),
    title: title.value.trim() || url.value.trim(),
    category: category.value.trim() || t('reading.categoryPlaceholder'),
    refreshInterval: refreshInterval.value,
    strategy: strategy.value,
    selectors: strategy.value === 'css-selector' ? selectors.value : undefined,
    description: description.value.trim() || undefined,
  }

  if (isEdit && props.source) {
    store.updateSource(props.source.id, data)
  }
  else {
    store.addSource(data)
  }

  emit('close')
}

// ── 辅助 ──────────────────────────────────────────────

function updateSelector(key: keyof CollectorSelectors, value: string) {
  selectors.value = { ...selectors.value, [key]: value }
}

function applyTemplate(template: ScriptTemplate) {
  selectors.value = { ...template.selectors }
}

// 监听 URL 变化，重置到输入步骤
watch(url, () => {
  if (!isEdit)
    step.value = 'input'
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="flex h-[80vh] w-[700px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">
          {{ isEdit ? t('reading.editSource') : t('reading.addSourceTitle') }}
        </h2>
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Step 1: URL 输入 + 检测 -->
      <div class="border-b p-4 space-y-3">
        <div class="flex gap-2">
          <Input
            v-model="url"
            :placeholder="t('reading.urlPlaceholder')"
            class="h-8 text-xs flex-1"
            :disabled="isEdit"
            @keydown.enter="handleDetect"
          />
          <Button
            v-if="!isEdit"
            size="sm"
            variant="outline"
            class="h-8 gap-1"
            :disabled="!url.trim() || detecting"
            @click="handleDetect"
          >
            <Loader2 v-if="detecting" class="h-3.5 w-3.5 animate-spin" />
            <Search v-else class="h-3.5 w-3.5" />
            {{ detecting ? t('reading.detecting') : t('reading.autoDetect') }}
          </Button>
        </div>

        <!-- 检测错误 -->
        <p v-if="detectError" class="text-[11px] text-destructive">
          {{ detectError }}
        </p>

        <!-- RSS 检测结果 -->
        <p v-if="detectedTitle && strategy === 'rss'" class="text-[11px] text-green-600 dark:text-green-400">
          ✓ {{ t('reading.rssDetected') }}：{{ detectedTitle }}（{{ detectedItemCount }} {{ t('reading.items') }}）
        </p>

        <!-- CSS 检测结果 -->
        <p v-if="strategy === 'css-selector' && previewArticles.length > 0" class="text-[11px] text-blue-600 dark:text-blue-400">
          ✓ {{ t('reading.cssDetected') }}（{{ previewArticles.length }} {{ t('reading.items') }}）
        </p>

        <!-- RSSHub 发现结果 -->
        <div v-if="discoveredRoutes.length" class="rounded-md border bg-muted/30 p-2">
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

      <!-- Step 2: 配置 -->
      <div v-if="step === 'config' || isEdit" class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- 基本信息 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t('reading.titlePlaceholder') }}</Label>
            <Input v-model="title" class="h-8 text-xs" :placeholder="t('reading.titlePlaceholder')" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t('reading.categoryPlaceholder') }}</Label>
            <Input v-model="category" class="h-8 text-xs" :placeholder="t('reading.categoryPlaceholder')" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t('reading.strategyLabel') }}</Label>
            <select
              v-model="strategy"
              class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="opt in STRATEGY_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t('reading.refreshInterval') }}</Label>
            <select
              v-model="refreshInterval"
              class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="opt in REFRESH_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label() }}
              </option>
            </select>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label class="text-xs">{{ t('reading.description') }}</Label>
          <Input v-model="description" class="h-8 text-xs" :placeholder="t('reading.descriptionPlaceholder')" />
        </div>

        <!-- CSS 选择器编辑器（仅 css-selector 策略） -->
        <div v-if="strategy === 'css-selector'" class="space-y-3 rounded-md border p-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium flex items-center gap-1.5">
              <Settings2 class="h-3.5 w-3.5" />
              {{ t('reading.scriptEditor') }}
            </span>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" class="h-6 text-[10px]" @click="showAdvanced = !showAdvanced">
                {{ showAdvanced ? t('reading.simpleView') : t('reading.advancedEdit') }}
              </Button>
            </div>
          </div>

          <!-- 脚本模板 -->
          <div>
            <span class="text-[10px] text-muted-foreground mr-2">{{ t('reading.scriptTemplates') }}：</span>
            <div class="inline-flex flex-wrap gap-1 mt-1">
              <button
                v-for="tmpl in SCRIPT_TEMPLATES"
                :key="tmpl.label"
                class="rounded bg-background border px-2 py-0.5 text-[10px] hover:bg-primary/10 hover:border-primary/30 transition-colors"
                @click="applyTemplate(tmpl)"
              >
                {{ tmpl.label }}
              </button>
            </div>
          </div>

          <!-- 简略视图 -->
          <div v-if="!showAdvanced" class="space-y-1.5">
            <div v-for="key in (['item', 'title', 'link', 'summary', 'date'] as const)" :key="key" class="flex items-center gap-2">
              <span class="w-12 text-[10px] text-muted-foreground text-right shrink-0">
                {{ t(`reading.selector${key.charAt(0).toUpperCase() + key.slice(1)}`) }}
              </span>
              <Input
                :model-value="selectors[key]"
                class="h-7 text-[10px] flex-1 font-mono"
                :placeholder="key === 'item' ? 'CSS selector for list items' : 'CSS selector (relative to item)'"
                @update:model-value="updateSelector(key, String($event))"
              />
            </div>
          </div>

          <!-- 高级编辑 -->
          <div v-if="showAdvanced" class="space-y-1.5">
            <div v-for="key in (['item', 'title', 'link', 'content', 'summary', 'author', 'date'] as const)" :key="key" class="flex items-center gap-2">
              <span class="w-12 text-[10px] text-muted-foreground text-right shrink-0">
                {{ t(`reading.selector${key.charAt(0).toUpperCase() + key.slice(1)}`) }}
              </span>
              <Input
                :model-value="selectors[key]"
                class="h-7 text-[10px] flex-1 font-mono"
                :placeholder="key === 'item' ? 'CSS selector for list items' : 'CSS selector (relative to item)'"
                @update:model-value="updateSelector(key, String($event))"
              />
            </div>
          </div>

          <!-- 预览 -->
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-7 gap-1 text-[10px]" :disabled="previewing" @click="handlePreview">
              <Loader2 v-if="previewing" class="h-3 w-3 animate-spin" />
              {{ t('reading.testCollect') }}
            </Button>
          </div>
        </div>

        <!-- 预览结果 -->
        <div v-if="previewArticles.length" class="rounded-md border bg-muted/20 p-3 space-y-1.5">
          <p class="text-[10px] text-muted-foreground font-medium">
            {{ t('reading.previewCount', { n: previewArticles.length }) }}
          </p>
          <div v-for="(article, i) in previewArticles" :key="i" class="text-[11px] truncate">
            <span class="text-muted-foreground mr-1">{{ i + 1 }}.</span>
            <a v-if="article.link" :href="article.link" target="_blank" class="text-primary hover:underline">
              {{ article.title }}
            </a>
            <span v-else>{{ article.title }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-4 py-3">
        <div class="flex items-center gap-2">
          <span
            class="rounded px-1.5 py-0.5 text-[9px]"
            :class="{
              'bg-green-500/10 text-green-600': strategy === 'rss',
              'bg-blue-500/10 text-blue-600': strategy === 'css-selector',
              'bg-purple-500/10 text-purple-600': strategy === 'json-api',
            }"
          >
            {{ STRATEGY_OPTIONS.find(o => o.value === strategy)?.label }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-8" @click="emit('close')">
            {{ t('common.cancel') }}
          </Button>
          <Button size="sm" class="h-8 gap-1" :disabled="!url.trim() || detecting" @click="handleSave">
            <Plus v-if="!isEdit" class="h-3.5 w-3.5" />
            {{ isEdit ? t('common.save') : t('reading.confirmAdd') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
