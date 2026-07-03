<script setup lang="ts">
import { Globe, Loader2, Moon, Plus, RefreshCcw, Search, Square, Star, Sun, X } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AIConfig from '@/components/ai/chat-box/AIConfig.vue'
import SyncButton from '@/components/shared/SyncButton.vue'
import ViewNav from '@/components/shared/ViewNav.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocaleStore } from '@/stores/locale'
import { useReadingStore } from '@/stores/reading'
import { useUIStore } from '@/stores/ui'
import ArticleReader from './ArticleReader.vue'
import SourceConfigDialog from './SourceConfigDialog.vue'
import ArticleListView from './views/ArticleListView.vue'

const { t } = useI18n()
const store = useReadingStore()
const uiStore = useUIStore()
const localeStore = useLocaleStore()

const showSourceConfig = ref(false)
const showAIConfig = ref(false)
const activeFilter = ref<'all' | 'starred'>('all')
const searchQuery = ref('')
const sidebarWidth = ref(300)
const listWidth = ref(320)
const sidebarCollapsed = ref(false)
const listCollapsed = ref(false)

// ── 多选 ──────────────────────────────────────────────
const isSelecting = ref(false)
const selectedIds = ref<Set<string>>(new Set())
function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedIds.value = s
}

function clearSelection() { selectedIds.value = new Set(); isSelecting.value = false }

// ── 文章列表 ──────────────────────────────────────────
const displayArticles = computed(() => {
  if (activeFilter.value === 'starred')
    return store.filteredArticles.filter(a => a.starred)
  return store.filteredArticles
})

function selectAll() {
  selectedIds.value = new Set(displayArticles.value.map(a => a.id))
}

/** 当前激活源的内容视图类型（-1 = 全部，0 = 文章，1 = 图片，2 = 视频，3 = 音频，4 = 社交媒体） */
const activeView = ref<number>(-1)

/** 选中源时自动切换视图 */
watch(() => store.activeSourceId, (id) => {
  if (!id) {
    activeView.value = -1
    return
  }
  const src = store.sources.find(s => s.id === id)
  activeView.value = src?.view ?? 0
})

/** 各视图类型的未读数（用于显示视图图标计数） */
const viewCounts = computed<Record<number, number>>(() => {
  const srcViewMap = new Map(store.sources.map(s => [s.id, s.view ?? 0]))
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const a of store.articles) {
    if (!a.read) {
      const view = srcViewMap.get(a.sourceId) ?? 0
      counts[view] = (counts[view] || 0) + 1
    }
  }
  return counts
})

// ── 键盘 ──────────────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA')
    return
  const articles = displayArticles.value
  if (!articles.length)
    return
  switch (e.key) {
    case 'j': case 'ArrowDown': { e.preventDefault(); const idx = articles.findIndex(a => a.id === store.activeArticleId); store.setActiveArticle(articles[Math.min(idx + 1, articles.length - 1)]?.id ?? articles[0].id); break }
    case 'k': case 'ArrowUp': { e.preventDefault(); const idx = articles.findIndex(a => a.id === store.activeArticleId); store.setActiveArticle(articles[Math.max(idx - 1, 0)]?.id ?? articles[0].id); break }
    case 's': { if (store.activeArticleId)
      store.toggleStar(store.activeArticleId); break }
  }
}

// ── 拖拽调整宽度 ──────────────────────────────────
const MIN_SIDEBAR = 160
const MAX_SIDEBAR = 400
const MIN_LIST = 240
const MAX_LIST = 600

function startResize(e: MouseEvent, target: 'sidebar' | 'list') {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = target === 'sidebar' ? sidebarWidth.value : listWidth.value
  const min = target === 'sidebar' ? MIN_SIDEBAR : MIN_LIST
  const max = target === 'sidebar' ? MAX_SIDEBAR : MAX_LIST

  function onMove(ev: MouseEvent) {
    const delta = ev.clientX - startX
    const newWidth = Math.min(max, Math.max(min, startWidth + delta))
    if (target === 'sidebar') {
      sidebarWidth.value = newWidth
      sidebarCollapsed.value = newWidth < min + 20
    }
    else {
      listWidth.value = newWidth
      listCollapsed.value = newWidth < min + 20
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

watch(searchQuery, (v) => { store.searchQuery = v })
onMounted(async () => {
  await store.hydrate()
  store.setupBeforeUnload()
  // 首次加载用渐进式刷新，避免大量并发请求阻塞
  void store.fetchAllGradual(300)
  store.startAutoRefresh()
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => { store.stopAutoRefresh(); window.removeEventListener('keydown', handleKeydown) })
</script>

<template>
  <div class="flex h-screen flex-col bg-white dark:bg-neutral-950">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 px-4 py-2 shrink-0 bg-white dark:bg-neutral-950">
      <ViewNav />
      <div class="flex-1" />
      <div class="relative w-56">
        <Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <Input v-model="searchQuery" :placeholder="t('reading.search')" class="h-8 pl-8 text-xs rounded-lg border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
      </div>
      <Button variant="ghost" size="sm" class="gap-1 text-xs text-neutral-500" @click="showSourceConfig = true">
        {{ t('reading.sourceManage') }}
      </Button>
      <Button variant="ghost" size="sm" class="gap-1 text-xs text-neutral-500" @click="showAIConfig = true">
        {{ t('reading.aiConfig') }}
      </Button>
      <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </Button>
      <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="uiStore.toggleDark()">
        <Sun v-if="uiStore.isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </Button>
      <SyncButton />
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- ═══ 左栏 ═══ -->
      <aside
        class="flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 overflow-hidden shrink-0"
        :style="{ width: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
      >
        <div v-show="!sidebarCollapsed" class="flex-1 overflow-y-auto px-2 pt-3 space-y-0.5">
          <!-- 视图图标（根据源自动切换） -->
          <div class="flex items-center justify-between px-1 pb-3">
            <button class="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors" :class="activeView === -1 && !store.activeSourceId ? 'text-orange-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'" :title="t('reading.allArticles')" @click="activeView = -1; activeFilter = 'all'; store.activeSourceId = null">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              <span class="text-[9px] font-semibold tabular-nums">{{ store.totalUnread }}</span>
            </button>
            <button class="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors" :class="activeView === 0 && !store.activeSourceId ? 'text-orange-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'" :title="t('reading.viewArticles')" @click="activeView = 0; activeFilter = 'all'; store.activeSourceId = null">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
              <span class="text-[9px] font-semibold tabular-nums">{{ viewCounts[0] }}</span>
            </button>
            <button class="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors" :class="activeView === 4 && !store.activeSourceId ? 'text-blue-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'" :title="t('reading.viewSocialMedia')" @click="activeView = 4; activeFilter = 'all'; store.activeSourceId = null">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span class="text-[9px] font-semibold tabular-nums">{{ viewCounts[4] }}</span>
            </button>
            <button class="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors" :class="activeView === 1 && !store.activeSourceId ? 'text-green-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'" :title="t('reading.viewPictures')" @click="activeView = 1; activeFilter = 'all'; store.activeSourceId = null">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              <span class="text-[9px] font-semibold tabular-nums">{{ viewCounts[1] }}</span>
            </button>
            <button class="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors" :class="activeView === 2 && !store.activeSourceId ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'" :title="t('reading.viewVideos')" @click="activeView = 2; activeFilter = 'all'; store.activeSourceId = null">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              <span class="text-[9px] font-semibold tabular-nums">{{ viewCounts[2] }}</span>
            </button>
          </div>
          <button
            class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors"
            :class="activeFilter === 'all' && !store.activeSourceId ? 'bg-neutral-200/60 dark:bg-neutral-700/60 font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30'"
            @click="activeView = -1; activeFilter = 'all'; store.activeSourceId = null"
          >
            <svg class="size-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <span class="flex-1 text-left">{{ t('reading.allArticles') }}</span>
            <span class="text-xs tabular-nums font-medium text-neutral-500">{{ store.totalUnread }}</span>
          </button>
          <button
            class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors"
            :class="activeFilter === 'starred' ? 'bg-neutral-200/60 dark:bg-neutral-700/60 font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30'"
            @click="activeFilter = 'starred'; store.activeSourceId = null"
          >
            <Star class="size-4 text-amber-500 fill-amber-500" />
            <span>{{ t('reading.starred') }}</span>
          </button>

          <div class="h-px bg-neutral-100 dark:bg-neutral-800 my-2" />

          <div
            v-for="src in store.sources"
            :key="src.id"
            class="group flex items-center justify-between px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-sm"
            :class="store.activeSourceId === src.id ? 'bg-neutral-200/60 dark:bg-neutral-700/60 font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30'"
            @click="store.activeSourceId = src.id; activeFilter = 'all'; store.fetchSingleSource(src.id)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <!-- 状态圆点：绿色=正常，红色=错误，黄色=加载中 -->
              <span
                class="size-2 shrink-0 rounded-full"
                :class="{
                  'bg-green-500': src.health?.status === 'ok',
                  'bg-red-500': src.health?.status === 'error',
                  'bg-yellow-400 animate-pulse': src.health?.status === 'pending' || store.fetchingSourceIds[src.id],
                  'bg-neutral-400': !src.health?.status && !store.fetchingSourceIds[src.id],
                }"
                :title="src.health?.status === 'error' ? src.health.lastError : undefined"
              />
              <div class="size-5 shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500 dark:text-neutral-400 overflow-hidden">
                {{ src.title.charAt(0) }}
              </div>
              <span class="truncate">{{ src.title }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span v-if="store.unreadCountMap[src.id]" class="text-xs tabular-nums font-medium text-neutral-500 dark:text-neutral-400">{{ store.unreadCountMap[src.id] }}</span>
              <Loader2 v-if="store.fetchingSourceIds[src.id]" class="h-3 w-3 animate-spin text-orange-500" />
              <button v-else class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded p-0.5 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50" @click.stop="store.fetchSingleSource(src.id)">
                <RefreshCcw class="h-3 w-3 text-neutral-400" />
              </button>
            </div>
          </div>
        </div>

        <!-- 固定底部的添加源按钮 -->
        <div v-show="!sidebarCollapsed" class="shrink-0 border-t border-neutral-100 dark:border-neutral-800 px-2 py-2">
          <button class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm text-neutral-500 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30 transition-colors" @click="showSourceConfig = true">
            <Plus class="size-4" />
            <span>{{ t('reading.addSource') }}</span>
          </button>
        </div>
      </aside>

      <!-- 左栏分隔线 + 折叠按钮 -->
      <div
        class="relative flex items-center justify-center w-1.5 shrink-0 bg-neutral-200/60 dark:bg-neutral-700/60 cursor-col-resize"
        @mousedown.left="startResize($event, 'sidebar')"
      >
        <!-- 收起按钮（展开时显示在分隔线左侧） -->
        <button
          v-if="!sidebarCollapsed"
          class="absolute z-20 flex flex-col items-center justify-center w-5 h-14 rounded-l-md bg-orange-200 dark:bg-orange-900/50 hover:bg-orange-300 dark:hover:bg-orange-800/60 transition-colors left-0 translate-x-[-100%] top-1/2 -translate-y-1/2"
          title="收起源列表"
          @dblclick.stop
          @mousedown.stop="sidebarCollapsed = true"
        >
          <svg class="size-3.5 text-orange-700 dark:text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6" /></svg>
          <span class="text-[10px] text-orange-700 dark:text-orange-300 font-semibold select-none leading-tight">源</span>
        </button>
        <!-- 展开按钮（收起时显示在分隔线右侧，顶部） -->
        <button
          v-if="sidebarCollapsed"
          class="absolute z-20 flex flex-col items-center justify-center w-5 h-14 rounded-r-md bg-orange-200 dark:bg-orange-900/50 hover:bg-orange-300 dark:hover:bg-orange-800/60 transition-colors right-0 translate-x-[100%] top-4"
          title="展开源列表"
          @dblclick.stop
          @mousedown.stop="sidebarCollapsed = false"
        >
          <span class="text-[10px] text-orange-700 dark:text-orange-300 font-semibold select-none leading-tight">源</span>
          <svg class="size-3.5 text-orange-700 dark:text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <!-- ═══ 中栏 ═══ -->
      <section
        class="flex flex-col bg-white dark:bg-neutral-950 overflow-hidden shrink-0"
        :style="{ width: listCollapsed ? '0px' : `${listWidth}px` }"
      >
        <div v-show="!listCollapsed" class="flex flex-col h-full">
          <div class="flex items-center justify-between px-4 h-11 shrink-0 border-b border-neutral-100 dark:border-neutral-800">
            <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ activeFilter === 'starred' ? t('reading.starred') : store.activeSourceId ? store.sources.find(s => s.id === store.activeSourceId)?.title : activeView === -1 ? t('reading.allArticles') : activeView === 0 ? t('reading.viewArticles') : activeView === 1 ? t('reading.viewPictures') : activeView === 2 ? t('reading.viewVideos') : activeView === 3 ? t('reading.viewAudios') : activeView === 4 ? t('reading.viewSocialMedia') : t('reading.allArticles') }}
            </span>
            <div class="flex items-center gap-0.5">
              <button
                class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                :disabled="store.activeSourceId ? store.fetchingSourceIds[store.activeSourceId] : store.loading"
                @click="store.activeSourceId ? store.fetchSingleSource(store.activeSourceId) : store.fetchAll(true)"
              >
                <RefreshCcw
                  class="h-4 w-4"
                  :class="{
                    'animate-spin text-orange-500': store.activeSourceId ? store.fetchingSourceIds[store.activeSourceId] : store.loading,
                    'animate-spin text-neutral-400': store.backgroundRefreshing && !store.loading && !store.activeSourceId,
                  }"
                />
              </button>
              <button class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" @click="isSelecting = !isSelecting">
                <Square class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div v-if="isSelecting" class="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <span class="text-xs text-neutral-500">{{ t('reading.selected', { count: selectedIds.size }) }}</span>
            <button class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ml-1" @click="selectAll">
              {{ t('reading.selectAll') }}
            </button>
            <div class="flex-1" />
            <button class="rounded p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50" @click="store.starArticles(selectedIds); clearSelection()">
              <Star class="h-3.5 w-3.5 text-amber-500" />
            </button>
            <button class="rounded p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 text-red-500" @click="store.deleteArticles(selectedIds); clearSelection()">
              <X class="h-3.5 w-3.5" />
            </button>
            <button class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ml-1" @click="clearSelection">
              {{ t('common.cancel') }}
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <!-- View-driven rendering -->
            <ArticleListView
              v-if="activeView === 0"
              :articles="displayArticles"
              :active-id="store.activeArticleId"
              :is-selecting="isSelecting"
              :selected-ids="selectedIds"
              @select="isSelecting ? toggleSelect($event) : store.setActiveArticle($event)"
            />
            <div v-else-if="activeView === 1" class="flex flex-col items-center justify-center h-full gap-2 text-neutral-400">
              <svg class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              <span class="text-sm">{{ t('reading.viewPictures') }}</span>
              <span class="text-xs text-neutral-500">{{ t('reading.noContent') }}</span>
            </div>
            <div v-else-if="activeView === 2" class="flex flex-col items-center justify-center h-full gap-2 text-neutral-400">
              <svg class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              <span class="text-sm">{{ t('reading.viewVideos') }}</span>
              <span class="text-xs text-neutral-500">{{ t('reading.noContent') }}</span>
            </div>
            <div v-else-if="activeView === 3" class="flex flex-col items-center justify-center h-full gap-2 text-neutral-400">
              <svg class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
              <span class="text-sm">{{ t('reading.viewAudios') }}</span>
              <span class="text-xs text-neutral-500">{{ t('reading.noContent') }}</span>
            </div>
            <div v-else-if="activeView === 4" class="flex flex-col items-center justify-center h-full gap-2 text-neutral-400">
              <svg class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span class="text-sm">{{ t('reading.viewSocialMedia') }}</span>
              <span class="text-xs text-neutral-500">{{ t('reading.noContent') }}</span>
            </div>
            <ArticleListView
              v-else
              :articles="displayArticles"
              :active-id="store.activeArticleId"
              :is-selecting="isSelecting"
              :selected-ids="selectedIds"
              @select="isSelecting ? toggleSelect($event) : store.setActiveArticle($event)"
            />
            <div v-if="!displayArticles.length" class="flex h-32 items-center justify-center text-xs text-neutral-400">
              {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
            </div>
          </div>
        </div>
      </section>

      <!-- 中栏分隔线 + 折叠按钮 -->
      <div
        class="relative flex items-center justify-center w-1.5 shrink-0 bg-neutral-200/60 dark:bg-neutral-700/60 cursor-col-resize"
        @mousedown.left="startResize($event, 'list')"
      >
        <!-- 收起按钮（展开时显示在分隔线左侧） -->
        <button
          v-if="!listCollapsed"
          class="absolute z-20 flex flex-col items-center justify-center w-5 h-14 rounded-l-md bg-blue-200 dark:bg-blue-900/50 hover:bg-blue-300 dark:hover:bg-blue-800/60 transition-colors left-0 translate-x-[-100%] top-1/2 -translate-y-1/2"
          title="收起文章列表"
          @dblclick.stop
          @mousedown.stop="listCollapsed = true"
        >
          <svg class="size-3.5 text-blue-700 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6" /></svg>
          <span class="text-[10px] text-blue-700 dark:text-blue-300 font-semibold select-none leading-tight">列</span>
        </button>
        <!-- 展开按钮（收起时显示在分隔线右侧，偏下） -->
        <button
          v-if="listCollapsed"
          class="absolute z-20 flex flex-col items-center justify-center w-5 h-14 rounded-r-md bg-blue-200 dark:bg-blue-900/50 hover:bg-blue-300 dark:hover:bg-blue-800/60 transition-colors right-0 translate-x-[100%] top-20"
          title="展开文章列表"
          @dblclick.stop
          @mousedown.stop="listCollapsed = false"
        >
          <span class="text-[10px] text-blue-700 dark:text-blue-300 font-semibold select-none leading-tight">列</span>
          <svg class="size-3.5 text-blue-700 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <!-- ═══ 右栏 ═══ -->
      <main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-950">
        <ArticleReader v-if="store.activeArticle" :article="store.activeArticle" />
        <div v-else class="flex flex-1 items-center justify-center text-sm text-neutral-300 dark:text-neutral-600">
          {{ t('reading.selectArticle') }}
        </div>
      </main>
    </div>

    <SourceConfigDialog v-if="showSourceConfig" @close="showSourceConfig = false" />
    <div v-if="showAIConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAIConfig = false">
      <div class="flex h-[80vh] w-[620px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <span class="text-sm font-semibold">{{ t('reading.aiConfig') }}</span>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="showAIConfig = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <AIConfig />
        </div>
      </div>
    </div>
  </div>
</template>
