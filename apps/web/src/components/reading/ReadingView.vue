<script setup lang="ts">
import { CheckSquare, Loader2, PanelLeftOpen, PanelRightOpen, Plus, RefreshCcw, Search, Settings, Square, Star, Trash2, X } from '@lucide/vue'
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

const sidebarCollapsed = ref(false)
const articleListCollapsed = ref(false)
const showSourceConfig = ref(false)
const showAIConfig = ref(false)
const showStarredOnly = ref(false)
const activeListId = ref<string | null>(null)
const searchQuery = ref('')

// ── 多选 ──────────────────────────────────────────────
const isSelecting = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function selectAll() {
  const articles = store.filteredArticles
  if (selectedIds.value.size === articles.length) {
    selectedIds.value = new Set()
  }
  else {
    selectedIds.value = new Set(articles.map(a => a.id))
  }
}

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id))
    s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function clearSelection() {
  selectedIds.value = new Set()
  isSelecting.value = false
}

function batchStar() {
  store.starArticles(selectedIds.value)
  clearSelection()
}

function batchDelete() {
  store.deleteArticles(selectedIds.value)
  clearSelection()
}

// ── 日期格式化 ────────────────────────────────────────
function formatDate(ts: number) {
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

// ── 文章列表 ──────────────────────────────────────────
const displayArticles = computed(() => {
  if (showStarredOnly.value)
    return store.articles.filter(a => a.starred).sort((a, b) => b.publishedAt - a.publishedAt)
  if (activeListId.value)
    return store.getListArticles(activeListId.value)
  return store.filteredArticles
})

// ── 键盘导航 ──────────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return

  if (e.ctrlKey || e.metaKey) {
    if (e.key === '[') { e.preventDefault(); sidebarCollapsed.value = !sidebarCollapsed.value }
    else if (e.key === ']') { e.preventDefault(); articleListCollapsed.value = !articleListCollapsed.value }
    return
  }

  const articles = displayArticles.value
  if (!articles.length)
    return

  switch (e.key) {
    case 'j': case 'ArrowDown': {
      e.preventDefault()
      const idx = articles.findIndex(a => a.id === store.activeArticleId)
      const next = idx < 0 ? 0 : Math.min(idx + 1, articles.length - 1)
      store.setActiveArticle(articles[next].id)
      break
    }
    case 'k': case 'ArrowUp': {
      e.preventDefault()
      const idx = articles.findIndex(a => a.id === store.activeArticleId)
      const prev = idx < 0 ? 0 : Math.max(idx - 1, 0)
      store.setActiveArticle(articles[prev].id)
      break
    }
    case 's': { if (store.activeArticleId)
      store.toggleStar(store.activeArticleId); break }
    case 'r': { if (!e.metaKey && !e.ctrlKey)
      store.fetchAll(true); break }
  }
}

// ── 搜索防抖 ──────────────────────────────────────────
watch(searchQuery, (val) => { store.searchQuery = val })

// ── 生命周期 ──────────────────────────────────────────
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
    <!-- Header（保留原菜单栏） -->
    <header class="flex items-center gap-3 border-b px-4 py-2">
      <ViewNav />
      <div class="flex-1" />
      <div class="relative flex-1 max-w-xs">
        <Search class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="searchQuery" :placeholder="t('reading.search')" class="h-8 pl-7 text-xs w-full" />
      </div>
      <Button variant="outline" size="sm" class="gap-1" @click="store.fetchAll(true)">
        <RefreshCcw class="h-3.5 w-3.5" :class="{ 'animate-spin': store.loading }" />
      </Button>
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

    <!-- 主体三栏 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- ═══ 左栏：源列表 ═══ -->
      <div
        class="flex flex-col transition-all duration-200 overflow-hidden shrink-0"
        :class="sidebarCollapsed ? 'w-0' : 'w-[200px]'"
      >
        <!-- 全部 + 收藏 -->
        <div class="px-3 pt-3 pb-1 space-y-0.5">
          <button
            class="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors"
            :class="!store.activeSourceId && !showStarredOnly ? 'bg-accent/10 font-medium' : 'hover:bg-muted/50'"
            @click="store.activeSourceId = null; store.clearFilter(); showStarredOnly = false; activeListId = null"
          >
            <span class="flex-1 text-left">{{ t('reading.allArticles') }}</span>
            <span class="text-[11px] tabular-nums text-muted-foreground font-medium">{{ store.totalUnread || '' }}</span>
          </button>
          <button
            class="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors"
            :class="showStarredOnly ? 'bg-accent/10 font-medium' : 'hover:bg-muted/50'"
            @click="showStarredOnly = true; store.activeSourceId = null; store.clearFilter(); activeListId = null"
          >
            <Star class="size-4 text-amber-500 fill-amber-500" />
            <span class="flex-1 text-left">{{ t('reading.starred') }}</span>
          </button>
        </div>

        <!-- 源列表（无分组，纯列表） -->
        <div class="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          <div
            v-for="src in store.sources"
            :key="src.id"
            class="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
            :class="store.activeSourceId === src.id ? 'bg-accent/10 font-medium' : 'hover:bg-muted/50'"
            @click="store.activeSourceId = src.id; store.clearFilter(); showStarredOnly = false; activeListId = null"
          >
            <!-- 源图标 -->
            <div class="size-5 shrink-0 rounded bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground overflow-hidden">
              {{ src.title.charAt(0) }}
            </div>
            <span class="flex-1 truncate text-[13px]">{{ src.title }}</span>
            <!-- 刷新 -->
            <button
              v-if="!store.fetchingSourceIds[src.id]"
              class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted-foreground/10"
              @click.stop="store.fetchSingleSource(src.id)"
            >
              <RefreshCcw class="h-3 w-3 text-muted-foreground" />
            </button>
            <Loader2 v-else class="h-3 w-3 animate-spin text-primary shrink-0" />
            <!-- 错误指示 -->
            <span v-if="src.health?.status === 'error'" class="size-1.5 rounded-full bg-destructive shrink-0" />
            <!-- 未读数 -->
            <span v-if="store.unreadCountMap[src.id]" class="text-[11px] tabular-nums text-muted-foreground font-medium shrink-0">
              {{ store.unreadCountMap[src.id] }}
            </span>
          </div>

          <!-- 添加源 -->
          <button
            class="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
            @click="showSourceConfig = true"
          >
            <Plus class="size-4" />
            <span>{{ t('reading.addSource') }}</span>
          </button>
        </div>
      </div>

      <!-- 左栏折叠按钮 -->
      <button
        v-if="sidebarCollapsed"
        class="flex items-center justify-center w-6 shrink-0 hover:bg-muted/30 transition-colors"
        @click="sidebarCollapsed = false"
      >
        <PanelLeftOpen class="h-4 w-4 text-muted-foreground/40" />
      </button>

      <!-- ═══ 中栏：文章列表 ═══ -->
      <div
        class="flex flex-col border-l transition-all duration-200 overflow-hidden shrink-0"
        :class="articleListCollapsed ? 'w-0' : 'w-[340px]'"
      >
        <!-- 列表头部 -->
        <div class="flex items-center justify-between px-4 py-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-[15px] font-semibold">{{ showStarredOnly ? t('reading.starred') : t('reading.allArticles') }}</span>
            <button
              class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              :class="{ 'animate-spin': store.loading }"
              @click="store.fetchAll(true)"
            >
              <RefreshCcw class="h-4 w-4" />
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="store.totalUnread > 0"
              class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              :title="t('reading.markAllRead')"
              @click="store.markAllRead()"
            >
              <CheckSquare class="h-4 w-4" />
            </button>
            <button
              class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              @click="isSelecting = !isSelecting"
            >
              <Square class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="isSelecting" class="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
          <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" @click="clearSelection">
            <X class="h-3 w-3" />
            {{ t('reading.selected', { count: selectedIds.size }) }}
          </Button>
          <div class="flex-1" />
          <Button variant="outline" size="sm" class="h-7 gap-1 text-xs" @click="batchStar">
            <Star class="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" class="h-7 gap-1 text-xs text-destructive" @click="batchDelete">
            <Trash2 class="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selectAll">
            {{ t('reading.selectAll') }}
          </Button>
        </div>

        <!-- 文章列表 -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="article in displayArticles"
            :key="article.id"
            class="group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 border-t"
            :class="{ 'bg-accent/5': store.activeArticleId === article.id }"
            @click="isSelecting ? toggleSelect(article.id) : store.setActiveArticle(article.id)"
          >
            <!-- 未读点 -->
            <div v-if="!article.read" class="absolute left-1.5 top-4 size-2 rounded-full bg-primary shrink-0" />

            <!-- 复选框 -->
            <div v-if="isSelecting" class="mt-0.5 shrink-0">
              <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-primary" />
              <Square v-else class="h-4 w-4 text-muted-foreground" />
            </div>

            <!-- 文章信息 -->
            <div class="flex-1 min-w-0">
              <p
                class="text-[14px] leading-snug"
                :class="article.read ? 'text-muted-foreground' : 'font-medium text-foreground'"
              >
                {{ article.title }}
              </p>
            </div>

            <!-- 右侧时间 -->
            <span class="text-[11px] text-muted-foreground shrink-0 mt-0.5 tabular-nums">
              {{ formatDate(article.publishedAt) }}
            </span>

            <!-- hover 操作 -->
            <div class="absolute right-3 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="rounded p-1 hover:bg-muted-foreground/10" @click.stop="store.toggleStar(article.id)">
                <Star class="h-3 w-3" :class="article.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'" />
              </button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!displayArticles.length" class="flex h-32 items-center justify-center text-xs text-muted-foreground/50">
            {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
          </div>
        </div>
      </div>

      <!-- 中栏折叠按钮 -->
      <button
        v-if="articleListCollapsed"
        class="flex items-center justify-center w-6 shrink-0 hover:bg-muted/30 transition-colors"
        @click="articleListCollapsed = false"
      >
        <PanelRightOpen class="h-4 w-4 text-muted-foreground/40" />
      </button>

      <!-- ═══ 右栏：文章阅读 ═══ -->
      <div class="flex-1 flex flex-col min-w-0">
        <ArticleReader v-if="store.activeArticle" :article="store.activeArticle" />
        <div v-else class="flex flex-1 items-center justify-center text-sm text-muted-foreground/40">
          {{ t('reading.selectArticle') }}
        </div>
      </div>
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
