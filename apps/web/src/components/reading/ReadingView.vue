<script setup lang="ts">
import { CheckSquare, Globe, Loader2, Moon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, RefreshCcw, Search, Settings, Square, Star, Sun, Trash2, X } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
const showStarredOnly = ref(false)
const activeListId = ref<string | null>(null)
const sidebarCollapsed = ref(false)
const articleListCollapsed = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const isSelecting = computed(() => selectedIds.value.size > 0)

const displayArticles = computed(() => {
  if (showStarredOnly.value)
    return store.filteredArticles.filter(a => a.starred)
  if (activeListId.value)
    return store.getListArticles(activeListId.value)
  return store.filteredArticles
})

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id))
    s.delete(id)
  else
    s.add(id)
  selectedIds.value = s
}

function selectAll() {
  selectedIds.value = new Set(displayArticles.value.map(a => a.id))
}

function clearSelection() {
  selectedIds.value = new Set()
}

function batchDelete() {
  store.deleteArticles(selectedIds.value)
  clearSelection()
}

function batchStar() {
  store.starArticles(selectedIds.value)
  clearSelection()
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    if (hours < 1)
      return t('reading.justNow')
    return t('reading.hoursAgo', { n: hours })
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('reading.daysAgo', { n: days })
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function confirmDelete(e: MouseEvent, articleId: string) {
  e.stopPropagation()
  store.deleteArticle(articleId)
}

onMounted(() => {
  store.startAutoRefresh()
  // 进入页面立即智能刷新（只刷新到期的源）
  void store.fetchAll()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  store.stopAutoRefresh()
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  // Don't handle if user is typing in an input
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return

  if (e.ctrlKey || e.metaKey) {
    if (e.key === '[') {
      e.preventDefault()
      sidebarCollapsed.value = !sidebarCollapsed.value
    }
    else if (e.key === ']') {
      e.preventDefault()
      articleListCollapsed.value = !articleListCollapsed.value
    }
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
    case 's': {
      if (store.activeArticleId)
        store.toggleStar(store.activeArticleId)
      break
    }
    case 'm': {
      if (store.activeArticleId) {
        const article = articles.find(a => a.id === store.activeArticleId)
        if (article) {
          article.read = !article.read
          // save handled by store
        }
      }
      break
    }
    case 'r': {
      if (!e.metaKey && !e.ctrlKey)
        store.fetchAll(true)
      break
    }
  }
}

const showNewListInput = ref(false)
const newListName = ref('')

function handleAddList() {
  showNewListInput.value = true
  newListName.value = ''
}

function confirmAddList() {
  if (newListName.value.trim()) {
    store.addList(newListName.value.trim())
  }
  showNewListInput.value = false
  newListName.value = ''
}

function cancelAddList() {
  showNewListInput.value = false
  newListName.value = ''
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b px-4 py-2">
      <ViewNav />

      <div class="flex-1" />

      <div class="relative flex-1 max-w-xs">
        <Search class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="store.searchQuery"
          :placeholder="t('reading.search')"
          class="h-8 pl-7 text-xs w-full"
        />
      </div>

      <Button variant="outline" size="sm" class="gap-1" @click="store.fetchAll(true)">
        <RefreshCcw class="h-3.5 w-3.5" :class="{ 'animate-spin': store.loading }" />
        {{ t('reading.refresh') }}
      </Button>

      <!-- 设置下拉菜单 -->
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
            <Globe class="h-3.5 w-3.5 mr-2" />
            {{ localeStore.locale === 'zh-CN' ? 'English' : '中文' }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="uiStore.toggleDark()">
            <Sun v-if="uiStore.isDark" class="h-3.5 w-3.5 mr-2" />
            <Moon v-else class="h-3.5 w-3.5 mr-2" />
            {{ uiStore.isDark ? t('reading.lightMode') : t('reading.darkMode') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SyncButton />
    </header>

    <!-- 主体 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左栏：分类 + 源列表 -->
      <div
        class="flex flex-col transition-all duration-200 ease-in-out overflow-hidden bg-muted/30"
        :class="sidebarCollapsed ? 'w-0' : 'w-56'"
      >
        <div class="px-4 py-3 flex items-center">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{{ t('reading.categories') }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="ml-auto h-6 w-6 p-0"
            :title="t('reading.collapseSidebar')"
            @click="sidebarCollapsed = true"
          >
            <PanelLeftClose class="h-3.5 w-3.5" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <button
            class="flex items-center gap-2 w-full px-4 py-1.5 text-left text-sm transition-colors"
            :class="!store.activeSourceId && !store.activeCategory && !showStarredOnly && !activeListId ? 'bg-muted/50 font-medium' : 'hover:bg-muted/40'"
            @click="store.clearFilter(); showStarredOnly = false; activeListId = null"
          >
            <span class="flex-1">{{ t('reading.allArticles') }}</span>
            <span v-if="store.totalUnread" class="text-[10px] font-bold text-muted-foreground">{{ store.totalUnread }}</span>
          </button>
          <button
            class="flex items-center gap-2 w-full px-4 py-1.5 text-left text-sm transition-colors"
            :class="showStarredOnly ? 'bg-muted/50 font-medium' : 'hover:bg-muted/40'"
            @click="showStarredOnly = true; store.activeSourceId = null; store.clearFilter(); activeListId = null"
          >
            <Star class="size-4 text-amber-500 fill-amber-500" />
            <span class="flex-1">{{ t('reading.starred') }}</span>
          </button>
          <div v-for="cat in store.categories" :key="cat" class="mt-3">
            <div
              class="px-4 py-1 text-[10px] font-bold uppercase cursor-pointer hover:text-foreground transition-colors"
              :class="store.activeCategory === cat ? 'text-foreground' : 'text-muted-foreground'"
              @click="store.filterCategory(cat)"
            >
              {{ cat }}
            </div>
            <div
              v-for="src in store.sources.filter(s => s.category === cat)"
              :key="src.id"
              class="group flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors hover:bg-muted/40"
              :class="store.activeSourceId === src.id ? 'bg-muted/50 font-medium' : ''"
              @click="store.activeSourceId = src.id; store.activeCategory = null; showStarredOnly = false; activeListId = null"
            >
              <!-- 源图标（首字母） -->
              <div class="size-5 shrink-0 rounded bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                {{ src.title.charAt(0) }}
              </div>
              <span class="flex-1 truncate text-sm">{{ src.title }}</span>
              <!-- 单源刷新按钮 -->
              <button
                v-if="!store.fetchingSourceIds[src.id]"
                class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted-foreground/10"
                :title="t('reading.refreshSource')"
                @click.stop="store.fetchSingleSource(src.id)"
              >
                <RefreshCcw class="h-3 w-3 text-muted-foreground" />
              </button>
              <Loader2 v-else class="h-3 w-3 animate-spin text-primary shrink-0" />
              <!-- 健康状态 -->
              <span
                v-if="src.health?.status === 'error'"
                class="size-1.5 rounded-full bg-destructive shrink-0"
                :title="src.health.lastError"
              />
              <!-- 未读数 -->
              <span v-if="store.unreadCountMap[src.id]" class="text-[10px] font-bold text-muted-foreground shrink-0">
                {{ store.unreadCountMap[src.id] }}
              </span>
            </div>
          </div>

          <!-- 自定义列表 -->
          <div class="mt-3">
            <div class="px-4 py-1 text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              {{ t('reading.lists') }}
              <button
                class="text-muted-foreground hover:text-foreground transition-colors"
                :title="t('reading.addList')"
                @click="handleAddList"
              >
                <Plus class="h-3 w-3" />
              </button>
            </div>
            <!-- 新建列表输入框 -->
            <div v-if="showNewListInput" class="px-4 py-1.5">
              <Input
                v-model="newListName"
                class="h-7 text-xs"
                :placeholder="t('reading.listNamePrompt')"
                autofocus
                @keydown.enter="confirmAddList"
                @keydown.escape="cancelAddList"
                @blur="confirmAddList"
              />
            </div>
            <button
              v-for="list in store.lists"
              :key="list.id"
              class="w-full px-4 py-2 text-left text-sm transition-colors"
              :class="activeListId === list.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
              @click="activeListId = list.id; store.activeSourceId = null; showStarredOnly = false"
            >
              {{ list.name }}
              <span class="ml-1 text-[10px] text-muted-foreground/60">{{ list.articleIds.length }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 左栏折叠时的展开按钮 -->
      <div
        v-if="sidebarCollapsed"
        class="flex flex-col items-center justify-start gap-2 py-3 w-8 cursor-pointer hover:bg-muted/30 transition-colors"
        :title="t('reading.expandSidebar')"
        @click="sidebarCollapsed = false"
      >
        <PanelLeftOpen class="h-4 w-4 text-muted-foreground/50" />
      </div>

      <!-- 中栏：文章列表 -->
      <div
        class="flex flex-col transition-all duration-200 ease-in-out overflow-hidden"
        :class="articleListCollapsed ? 'w-0' : 'w-80'"
      >
        <!-- 批量操作栏 -->
        <div v-if="isSelecting" class="px-4 py-2 border-b flex items-center gap-2 bg-primary/5">
          <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" @click="clearSelection">
            <X class="h-3 w-3" />
            {{ t('reading.selected', { count: selectedIds.size }) }}
          </Button>
          <div class="flex-1" />
          <Button variant="outline" size="sm" class="h-7 gap-1 text-xs" @click="batchStar">
            <Star class="h-3 w-3" />
            {{ t('reading.batchStar') }}
          </Button>
          <Button variant="outline" size="sm" class="h-7 gap-1 text-xs text-destructive hover:text-destructive" @click="batchDelete">
            <Trash2 class="h-3 w-3" />
            {{ t('reading.batchDelete') }}
          </Button>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selectAll">
            {{ t('reading.selectAll') }}
          </Button>
        </div>

        <div v-if="!isSelecting" class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-foreground">
            {{ t('reading.articles', { count: displayArticles.length }) }}
          </span>
          <div class="flex items-center gap-1">
            <span v-if="store.loading" class="text-xs text-muted-foreground animate-pulse">
              {{ t('common.loading') }}
            </span>
            <button
              v-if="store.totalUnread > 0"
              class="rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="store.markAllRead()"
            >
              {{ t('reading.markAllRead') }}
            </button>
            <button
              class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="selectAll"
            >
              <CheckSquare class="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 w-6 p-0"
              :title="t('reading.collapseList')"
              @click="articleListCollapsed = true"
            >
              <PanelRightClose class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="article in displayArticles"
            :key="article.id"
            class="group relative flex cursor-pointer py-3.5 pl-6 pr-3 transition-colors hover:bg-muted/40"
            :class="{
              'bg-muted/30': store.activeArticleId === article.id,
              'before:absolute before:left-2 before:top-5 before:block before:size-2 before:rounded-full before:bg-primary': !article.read,
            }"
            @click="isSelecting ? toggleSelect(article.id) : store.setActiveArticle(article.id)"
          >
            <!-- 复选框 -->
            <button
              v-if="isSelecting"
              class="mt-0.5 mr-2 shrink-0"
              @click.stop="toggleSelect(article.id)"
            >
              <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-primary" />
              <Square v-else class="h-4 w-4 text-muted-foreground" />
            </button>

            <!-- 源图标（首字母） -->
            <div
              class="mr-2 mt-0.5 size-6 shrink-0 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground"
            >
              {{ article.sourceTitle.charAt(0) }}
            </div>

            <div class="-mt-0.5 min-w-0 flex-1 text-sm leading-tight">
              <!-- 来源 + 时间 -->
              <div
                class="flex min-w-0 items-center gap-1 text-[10px] font-bold"
                :class="article.read ? 'text-muted-foreground/60' : 'text-muted-foreground'"
              >
                <span class="truncate">{{ article.sourceTitle }}</span>
                <span class="shrink-0">·</span>
                <span class="shrink-0">{{ formatDate(article.publishedAt) }}</span>
              </div>
              <!-- 标题 -->
              <div
                class="relative my-0.5 break-words"
                :class="article.read ? 'text-muted-foreground' : 'font-medium text-foreground'"
              >
                <span class="line-clamp-1">{{ article.title }}</span>
              </div>
              <!-- 摘要 -->
              <div
                v-if="article.summary"
                class="truncate text-[13px]"
                :class="article.read ? 'text-muted-foreground/50' : 'text-muted-foreground'"
              >
                {{ article.summary.replace(/<[^>]*>/g, '').slice(0, 100) }}
              </div>
            </div>

            <!-- 收藏星标 -->
            <Star
              v-if="article.starred"
              class="ml-2 mt-1 size-4 shrink-0 text-amber-500 fill-amber-500"
            />

            <!-- hover 操作 -->
            <div class="absolute right-2 top-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="rounded p-1 hover:bg-muted-foreground/10"
                @click.stop="store.toggleStar(article.id)"
              >
                <Star
                  class="h-3.5 w-3.5"
                  :class="article.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'"
                />
              </button>
              <button
                class="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                @click="confirmDelete($event, article.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div v-if="!displayArticles.length" class="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
          </div>
          <!-- 键盘快捷键提示 -->
          <div v-else class="px-4 py-2 text-[10px] text-muted-foreground/30 text-center">
            {{ t('reading.keyboardHint') }}
          </div>
        </div>
      </div>

      <!-- 中栏折叠时的展开按钮 -->
      <div
        v-if="articleListCollapsed"
        class="flex flex-col items-center justify-start gap-2 py-3 w-8 cursor-pointer hover:bg-muted/30 transition-colors"
        :title="t('reading.expandList')"
        @click="articleListCollapsed = false"
      >
        <PanelRightOpen class="h-4 w-4 text-muted-foreground/50" />
      </div>

      <!-- 右栏：文章阅读 -->
      <div class="flex-1 flex flex-col">
        <ArticleReader v-if="store.activeArticle" :article="store.activeArticle" />
        <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground/50">
          {{ t('reading.selectArticle') }}
        </div>
      </div>
    </div>

    <!-- 源管理对话框 -->
    <SourceConfigDialog v-if="showSourceConfig" @close="showSourceConfig = false" />

    <!-- AI 配置对话框 -->
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
