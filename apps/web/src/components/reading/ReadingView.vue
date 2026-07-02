<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Loader2, Plus, RefreshCcw, Search, Settings, Square, Star, X } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AIConfig from '@/components/ai/chat-box/AIConfig.vue'
import SyncButton from '@/components/shared/SyncButton.vue'
import ViewNav from '@/components/shared/ViewNav.vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useLocaleStore } from '@/stores/locale'
import { useReadingStore } from '@/stores/reading'
import { useUIStore } from '@/stores/ui'
import ArticleReader from './ArticleReader.vue'
import SourceConfigDialog from './SourceConfigDialog.vue'

const { t } = useI18n()
const store = useReadingStore()
const uiStore = useUIStore()
const localeStore = useLocaleStore()

const showSourceConfig = ref(false)
const showAIConfig = ref(false)
const activeFilter = ref<'all' | 'starred'>('all')
const searchQuery = ref('')

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
  let result: Article[]
  if (activeFilter.value === 'starred')
    result = store.articles.filter(a => a.starred)
  else if (store.activeSourceId)
    result = store.articles.filter(a => a.sourceId === store.activeSourceId)
  else result = store.articles
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(a => a.title.toLowerCase().includes(q) || a.sourceTitle.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.publishedAt - a.publishedAt)
})

function formatTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000)
    return '刚刚'
  if (diff < 3600000)
    return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000)
    return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000)
    return `${Math.floor(diff / 86400000)} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

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

watch(searchQuery, (v) => { store.searchQuery = v })

onMounted(() => { store.startAutoRefresh(); void store.fetchAll(); window.addEventListener('keydown', handleKeydown) })
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
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            <Settings class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-40">
          <DropdownMenuItem @click="showSourceConfig = true">
            {{ t('reading.sourceManage') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="showAIConfig = true">
            {{ t('reading.aiConfig') }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
            {{ localeStore.locale === 'zh-CN' ? 'English' : '中文' }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="uiStore.toggleDark()">
            {{ uiStore.isDark ? t('reading.lightMode') : t('reading.darkMode') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SyncButton />
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- ═══ 左栏 (Folo: ~220px, bg-neutral-50) ═══ -->
      <aside class="w-[220px] shrink-0 flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800">
        <!-- Logo + Actions -->
        <div class="flex items-center justify-between px-4 h-12 shrink-0 border-b border-neutral-100 dark:border-neutral-800">
          <div class="flex items-center gap-1.5">
            <div class="size-7 rounded-lg bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
              F
            </div>
            <span class="text-base font-semibold text-neutral-800 dark:text-neutral-100">Folo</span>
          </div>
          <div class="flex items-center gap-1">
            <button class="size-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors">
              <Plus class="h-4 w-4" />
            </button>
            <div class="size-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[10px] font-bold text-white">
              U
            </div>
          </div>
        </div>

        <!-- Stats bar -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
          <div class="flex items-center gap-0.5 text-neutral-400">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <span class="text-xs font-semibold tabular-nums">20</span>
          </div>
          <div class="flex items-center gap-0.5 text-neutral-400">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span class="text-xs font-semibold tabular-nums">9</span>
          </div>
          <div class="flex items-center gap-0.5 text-neutral-400">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span class="text-xs font-semibold tabular-nums">0</span>
          </div>
          <div class="flex items-center gap-0.5 text-neutral-400">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            <span class="text-xs font-semibold tabular-nums">11</span>
          </div>
        </div>

        <!-- 全部 + 收藏 -->
        <div class="px-2 pt-2 pb-1 space-y-0.5">
          <button
            class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors"
            :class="activeFilter === 'all' && !store.activeSourceId ? 'bg-neutral-200/60 dark:bg-neutral-700/60 font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30'"
            @click="activeFilter = 'all'; store.activeSourceId = null"
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
        </div>

        <!-- 源列表 (flat, no categories) -->
        <nav class="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          <div
            v-for="src in store.sources"
            :key="src.id"
            class="flex items-center justify-between px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-sm"
            :class="store.activeSourceId === src.id ? 'bg-neutral-200/60 dark:bg-neutral-700/60 font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30'"
            @click="store.activeSourceId = src.id; activeFilter = 'all'"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div class="size-5 shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500 dark:text-neutral-400 overflow-hidden">
                {{ src.title.charAt(0) }}
              </div>
              <span class="truncate">{{ src.title }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button v-if="!store.fetchingSourceIds[src.id]" class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50" @click.stop="store.fetchSingleSource(src.id)">
                <RefreshCcw class="h-3 w-3 text-neutral-400" />
              </button>
              <Loader2 v-else class="h-3 w-3 animate-spin text-orange-500" />
              <span v-if="store.unreadCountMap[src.id]" class="text-xs tabular-nums font-medium text-neutral-500 dark:text-neutral-400">{{ store.unreadCountMap[src.id] }}</span>
            </div>
          </div>

          <button
            class="flex items-center gap-2 w-full px-2.5 py-1 rounded-lg text-sm text-neutral-500 hover:bg-neutral-200/30 dark:hover:bg-neutral-700/30 transition-colors"
            @click="showSourceConfig = true"
          >
            <Plus class="size-4" />
            <span>{{ t('reading.addSource') }}</span>
          </button>
        </nav>
      </aside>

      <!-- ═══ 中栏 (Folo: 320px) ═══ -->
      <section class="w-[320px] shrink-0 flex flex-col bg-white dark:bg-neutral-950">
        <!-- 列表标题 -->
        <div class="flex items-center justify-between px-4 h-11 shrink-0 border-b border-neutral-100 dark:border-neutral-800">
          <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {{ activeFilter === 'starred' ? t('reading.starred') : store.activeSourceId ? store.sources.find(s => s.id === store.activeSourceId)?.title : t('reading.allArticles') }}
          </span>
          <div class="flex items-center gap-0.5">
            <button class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" @click="store.fetchAll(true)">
              <RefreshCcw class="h-4 w-4" :class="{ 'animate-spin text-orange-500': store.loading }" />
            </button>
            <button class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" @click="isSelecting = !isSelecting">
              <Square class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- 多选操作栏 -->
        <div v-if="isSelecting" class="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <span class="text-xs text-neutral-500">{{ t('reading.selected', { count: selectedIds.size }) }}</span>
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

        <!-- 文章列表 -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="article in displayArticles"
            :key="article.id"
            class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-neutral-50 dark:border-neutral-800/50"
            :class="store.activeArticleId === article.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
            @click="isSelecting ? toggleSelect(article.id) : store.setActiveArticle(article.id)"
          >
            <div v-if="!isSelecting" class="size-2 shrink-0 rounded-full" :class="!article.read ? 'bg-orange-500' : 'bg-transparent'" />
            <div v-if="isSelecting" class="shrink-0">
              <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-orange-500" />
              <Square v-else class="h-4 w-4 text-neutral-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span class="size-3.5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">R</span>
                <span class="truncate">{{ article.sourceTitle }}</span>
              </div>
              <span
                class="block mt-0.5 text-[13px] leading-snug truncate"
                :class="article.read ? 'text-neutral-500' : 'font-medium text-neutral-900 dark:text-neutral-100'"
              >{{ article.title }}</span>
            </div>
            <span class="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0 whitespace-nowrap tabular-nums">
              {{ formatTime(article.publishedAt) }}
            </span>
          </div>

          <div v-if="!displayArticles.length" class="flex h-32 items-center justify-center text-xs text-neutral-400">
            {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
          </div>
        </div>
      </section>

      <!-- ═══ 右栏 ═══ -->
      <main class="flex-1 flex flex-col min-w-0 border-l border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
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
