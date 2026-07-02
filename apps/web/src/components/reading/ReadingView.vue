<script setup lang="ts">
import { CheckSquare, Globe, Moon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCcw, Search, Settings, Square, Star, Sun, Trash2, X } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
  // 快捷键：Ctrl+[ 收起/展开侧栏，Ctrl+] 收起/展开列表
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  store.stopAutoRefresh()
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '[') {
      e.preventDefault()
      sidebarCollapsed.value = !sidebarCollapsed.value
    }
    else if (e.key === ']') {
      e.preventDefault()
      articleListCollapsed.value = !articleListCollapsed.value
    }
  }
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b px-4 py-2">
      <ViewNav />

      <div class="flex-1" />

      <div class="relative w-48">
        <Search class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="store.searchQuery"
          :placeholder="t('reading.search')"
          class="h-8 pl-7 text-xs"
        />
      </div>

      <Button variant="outline" size="sm" class="gap-1" @click="store.fetchAll()">
        <RefreshCcw class="h-3.5 w-3.5" :class="{ 'animate-spin': store.loading }" />
        {{ t('reading.refresh') }}
      </Button>

      <Button variant="outline" size="sm" @click="showSourceConfig = true">
        {{ t('reading.sourceManage') }}
      </Button>

      <Button variant="outline" size="sm" class="gap-1" @click="showAIConfig = true">
        <Settings class="h-3.5 w-3.5" />
        {{ t('reading.aiConfig') }}
      </Button>

      <SyncButton />

      <!-- 语言切换 -->
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1 text-xs"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </Button>

      <!-- 主题切换 -->
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0"
        @click="uiStore.toggleDark()"
      >
        <Sun v-if="uiStore.isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </Button>
    </header>

    <!-- 主体 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左栏：分类 + 源列表 -->
      <div
        class="border-r flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
        :class="sidebarCollapsed ? 'w-0' : 'w-56'"
      >
        <div class="px-4 py-3 border-b flex items-center">
          <span class="text-sm font-medium text-muted-foreground">{{ t('reading.categories') }}</span>
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
            class="w-full px-4 py-2 text-left text-sm transition-colors"
            :class="!store.activeSourceId && !showStarredOnly && !activeListId ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
            @click="store.activeSourceId = null; showStarredOnly = false; activeListId = null"
          >
            {{ t('reading.allArticles') }}
            <span v-if="store.totalUnread" class="ml-1.5 text-[10px] text-primary font-medium">{{ store.totalUnread }}</span>
          </button>
          <button
            class="w-full px-4 py-2 text-left text-sm transition-colors"
            :class="showStarredOnly ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
            @click="showStarredOnly = true; store.activeSourceId = null; activeListId = null"
          >
            <Star class="inline h-3.5 w-3.5 mr-1.5 text-amber-500" />
            {{ t('reading.starred') }}
          </button>
          <div v-for="cat in store.categories" :key="cat" class="mt-2">
            <div class="px-4 py-1 text-xs font-medium text-muted-foreground uppercase">
              {{ cat }}
            </div>
            <button
              v-for="src in store.allSources.filter(s => s.category === cat)"
              :key="src.id"
              class="w-full px-4 py-2 text-left text-sm transition-colors flex items-center"
              :class="store.activeSourceId === src.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
              @click="store.activeSourceId = src.id; showStarredOnly = false; activeListId = null"
            >
              <span class="flex-1 truncate">{{ src.title }}</span>
              <span v-if="src.sourceType === 'collector'" class="text-[9px] text-muted-foreground/50 mr-1">{{ t('reading.collector') }}</span>
              <span v-if="store.unreadCountMap[src.id]" class="text-[10px] text-primary font-medium">{{ store.unreadCountMap[src.id] }}</span>
            </button>
          </div>

          <!-- 自定义列表 -->
          <div v-if="store.lists.length" class="mt-3">
            <div class="px-4 py-1 text-xs font-medium text-muted-foreground uppercase">
              {{ t('reading.lists') }}
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
        class="flex flex-col items-center justify-start gap-2 py-3 w-10 border-r cursor-pointer hover:bg-muted/50 transition-colors"
        :title="t('reading.expandSidebar')"
        @click="sidebarCollapsed = false"
      >
        <PanelLeftOpen class="h-4 w-4 text-muted-foreground" />
        <span class="text-[10px] text-muted-foreground [writing-mode:vertical-rl]">{{ t('reading.categories') }}</span>
      </div>

      <!-- 中栏：文章列表 -->
      <div
        class="border-r flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
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

        <div v-if="!isSelecting" class="px-4 py-2.5 border-b flex items-center justify-between">
          <span class="text-sm text-muted-foreground">
            {{ t('reading.articles', { count: displayArticles.length }) }}
          </span>
          <div class="flex items-center gap-2">
            <span v-if="store.loading" class="text-xs text-muted-foreground">
              {{ t('common.loading') }}
            </span>
            <Button variant="ghost" size="sm" class="h-6 px-1.5 text-xs text-muted-foreground" @click="selectAll">
              {{ t('reading.multiSelect') }}
            </Button>
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
            class="group px-4 py-3 border-b cursor-pointer transition-colors hover:bg-muted/50"
            :class="{ 'bg-muted/30': store.activeArticleId === article.id }"
            @click="isSelecting ? toggleSelect(article.id) : store.setActiveArticle(article.id)"
          >
            <div class="flex items-start gap-2">
              <!-- 复选框 -->
              <button
                v-if="isSelecting"
                class="mt-0.5 shrink-0"
                @click.stop="toggleSelect(article.id)"
              >
                <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-primary" />
                <Square v-else class="h-4 w-4 text-muted-foreground" />
              </button>

              <div class="flex-1 min-w-0">
                <p
                  class="text-sm leading-snug line-clamp-2"
                  :class="article.read ? 'text-muted-foreground' : 'font-medium'"
                >
                  {{ article.title }}
                </p>
                <p class="mt-1.5 text-xs text-muted-foreground truncate">
                  {{ article.sourceTitle }} · {{ formatDate(article.publishedAt) }}
                </p>
              </div>
              <div v-if="!isSelecting" class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="store.toggleStar(article.id)"
                >
                  <Star
                    class="h-3.5 w-3.5"
                    :class="article.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'"
                  />
                </button>
                <button
                  class="text-muted-foreground hover:text-destructive"
                  @click="confirmDelete($event, article.id)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div v-if="!displayArticles.length" class="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            {{ store.loading ? t('reading.fetching') : t('reading.noArticles') }}
          </div>
        </div>
      </div>

      <!-- 中栏折叠时的展开按钮 -->
      <div
        v-if="articleListCollapsed"
        class="flex flex-col items-center justify-start gap-2 py-3 w-10 border-r cursor-pointer hover:bg-muted/50 transition-colors"
        :title="t('reading.expandList')"
        @click="articleListCollapsed = false"
      >
        <PanelRightOpen class="h-4 w-4 text-muted-foreground" />
        <span class="text-[10px] text-muted-foreground [writing-mode:vertical-rl]">{{ t('reading.lists') }}</span>
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
