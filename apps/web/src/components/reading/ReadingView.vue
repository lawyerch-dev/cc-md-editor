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

function clearSelection() {
  selectedIds.value = new Set()
  isSelecting.value = false
}

// ── 文章列表 ──────────────────────────────────────────
const displayArticles = computed(() => {
  let result: Article[]
  if (activeFilter.value === 'starred') {
    result = store.articles.filter(a => a.starred)
  }
  else if (store.activeSourceId) {
    result = store.articles.filter(a => a.sourceId === store.activeSourceId)
  }
  else {
    result = store.articles
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(a => a.title.toLowerCase().includes(q) || a.sourceTitle.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.publishedAt - a.publishedAt)
})

// ── 时间格式化 ────────────────────────────────────────
function formatTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000)
    return t('reading.justNow')
  if (diff < 3600000)
    return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000)
    return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000)
    return `${Math.floor(diff / 86400000)}d`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── 键盘 ──────────────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return
  const articles = displayArticles.value
  if (!articles.length)
    return
  switch (e.key) {
    case 'j': case 'ArrowDown': {
      e.preventDefault()
      const idx = articles.findIndex(a => a.id === store.activeArticleId)
      store.setActiveArticle(articles[Math.min(idx + 1, articles.length - 1)]?.id ?? articles[0].id)
      break
    }
    case 'k': case 'ArrowUp': {
      e.preventDefault()
      const idx = articles.findIndex(a => a.id === store.activeArticleId)
      store.setActiveArticle(articles[Math.max(idx - 1, 0)]?.id ?? articles[0].id)
      break
    }
    case 's': { if (store.activeArticleId)
      store.toggleStar(store.activeArticleId); break }
    case 'r': { store.fetchAll(true); break }
  }
}

watch(searchQuery, (v) => { store.searchQuery = v })

onMounted(() => {
  store.startAutoRefresh()
  void store.fetchAll()
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  store.stopAutoRefresh()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- ═══ Header（保留原菜单栏） ═══ -->
    <header class="flex items-center gap-3 border-b px-4 py-2 shrink-0">
      <ViewNav />
      <div class="flex-1" />
      <div class="relative flex-1 max-w-xs">
        <Search class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="searchQuery" :placeholder="t('reading.search')" class="h-8 pl-7 text-xs w-full" />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="h-8 w-8 p-0">
            <Settings class="h-3.5 w-3.5" />
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

    <!-- ═══ 主体：三栏 ═══ -->
    <div class="flex flex-1 overflow-hidden">
      <!-- ── 左栏：源列表 (Folo style: 200px, no categories) ── -->
      <aside class="w-[200px] shrink-0 flex flex-col bg-background">
        <!-- Tabs: 全部 / 收藏 -->
        <div class="flex h-10 items-center gap-1 px-2 shrink-0">
          <button
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors"
            :class="activeFilter === 'all' && !store.activeSourceId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
            @click="activeFilter = 'all'; store.activeSourceId = null"
          >
            {{ t('reading.allArticles') }}
            <span v-if="store.totalUnread" class="text-[11px] tabular-nums">{{ store.totalUnread }}</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors"
            :class="activeFilter === 'starred' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
            @click="activeFilter = 'starred'; store.activeSourceId = null"
          >
            <Star class="size-4 text-amber-500 fill-amber-500" />
          </button>
        </div>

        <!-- 源列表（纯平铺，无分组） -->
        <nav class="flex-1 overflow-y-auto px-1.5 pb-2">
          <div
            v-for="src in store.sources"
            :key="src.id"
            class="group flex items-center justify-between rounded-md px-2 py-[3px] cursor-pointer transition-colors text-sm font-medium"
            :class="store.activeSourceId === src.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-foreground/80'"
            @click="store.activeSourceId = src.id; activeFilter = 'all'"
          >
            <div class="flex items-center min-w-0 gap-1.5">
              <div class="size-4 shrink-0 rounded bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground overflow-hidden">
                {{ src.title.charAt(0) }}
              </div>
              <span class="truncate text-[13px]">{{ src.title }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-if="!store.fetchingSourceIds[src.id]"
                class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted-foreground/10"
                @click.stop="store.fetchSingleSource(src.id)"
              >
                <RefreshCcw class="h-3 w-3 text-muted-foreground" />
              </button>
              <Loader2 v-else class="h-3 w-3 animate-spin text-primary" />
              <span v-if="src.health?.status === 'error'" class="size-1.5 rounded-full bg-destructive" />
              <span v-if="store.unreadCountMap[src.id]" class="text-[11px] tabular-nums text-muted-foreground font-medium">
                {{ store.unreadCountMap[src.id] }}
              </span>
            </div>
          </div>

          <!-- 添加源 -->
          <button
            class="flex items-center gap-1.5 w-full rounded-md px-2 py-[3px] text-[13px] text-muted-foreground hover:bg-muted transition-colors mt-1"
            @click="showSourceConfig = true"
          >
            <Plus class="size-4" />
            {{ t('reading.addSource') }}
          </button>
        </nav>
      </aside>

      <!-- ── 中栏：文章列表 (Folo style: 340px) ── -->
      <section class="w-[340px] shrink-0 flex flex-col border-l">
        <!-- 列表头部 -->
        <div class="flex items-center justify-between px-4 h-10 shrink-0">
          <span class="text-[15px] font-semibold">
            {{ activeFilter === 'starred' ? t('reading.starred') : store.activeSourceId ? store.sources.find(s => s.id === store.activeSourceId)?.title : t('reading.allArticles') }}
          </span>
          <div class="flex items-center gap-0.5">
            <button
              class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              @click="store.fetchAll(true)"
            >
              <RefreshCcw class="h-4 w-4" :class="{ 'animate-spin': store.loading }" />
            </button>
            <button
              class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              @click="isSelecting = !isSelecting"
            >
              <CheckSquare v-if="isSelecting" class="h-4 w-4" />
              <Square v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- 批量操作 -->
        <div v-if="isSelecting" class="flex items-center gap-2 px-4 py-1.5 border-t bg-muted/30">
          <span class="text-xs text-muted-foreground">{{ t('reading.selected', { count: selectedIds.size }) }}</span>
          <div class="flex-1" />
          <button class="rounded p-1 hover:bg-muted" @click="store.starArticles(selectedIds); clearSelection()">
            <Star class="h-3.5 w-3.5 text-amber-500" />
          </button>
          <button class="rounded p-1 hover:bg-muted text-destructive" @click="store.deleteArticles(selectedIds); clearSelection()">
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- 文章列表 -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="article in displayArticles"
            :key="article.id"
            class="group relative flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 border-t"
            :class="{ 'bg-accent/5': store.activeArticleId === article.id }"
            @click="isSelecting ? toggleSelect(article.id) : store.setActiveArticle(article.id)"
          >
            <!-- 未读点 -->
            <div v-if="!article.read" class="absolute left-1.5 top-[14px] size-2 rounded-full bg-primary shrink-0" />

            <!-- 复选框 -->
            <div v-if="isSelecting" class="shrink-0">
              <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-primary" />
              <Square v-else class="h-4 w-4 text-muted-foreground" />
            </div>

            <!-- 标题（单行） -->
            <span
              class="flex-1 min-w-0 truncate text-[14px]"
              :class="article.read ? 'text-muted-foreground' : 'font-medium text-foreground'"
            >
              {{ article.title }}
            </span>

            <!-- 右侧时间 -->
            <span class="text-[11px] text-muted-foreground shrink-0 tabular-nums">
              {{ formatTime(article.publishedAt) }}
            </span>
          </div>

          <!-- 空状态 -->
          <div v-if="!displayArticles.length" class="flex h-32 items-center justify-center text-xs text-muted-foreground/40">
            {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
          </div>
        </div>
      </section>

      <!-- ── 右栏：文章阅读 ── -->
      <main class="flex-1 flex flex-col min-w-0">
        <ArticleReader v-if="store.activeArticle" :article="store.activeArticle" />
        <div v-else class="flex flex-1 items-center justify-center text-sm text-muted-foreground/30">
          {{ t('reading.selectArticle') }}
        </div>
      </main>
    </div>

    <!-- 对话框 -->
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
