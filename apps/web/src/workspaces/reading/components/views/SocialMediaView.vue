<!-- @workspace reading -->
<script setup lang="ts">
import type { Article, MediaItem } from '@/workspaces/reading/stores'
import { Star } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReadingStore } from '@/workspaces/reading/stores'

defineProps<{
  articles: Article[]
  activeId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  preview: [images: Array<{ url: string, width?: number, height?: number }>, index: number]
}>()

const store = useReadingStore()
const { t } = useI18n()

// ── Twitter/X handle 解析 ──
function parseHandle(article: Article): string | null {
  // 从 URL 或 sourceTitle 中提取 @handle
  const url = article.link || ''
  const xMatch = url.match(/(?:twitter\.com|x\.com)\/(\w{1,15})/i)
  if (xMatch)
    return `@${xMatch[1]}`
  // 从 sourceTitle 提取（如 "Twitter @小倉ちょ"）
  const titleMatch = article.sourceTitle.match(/@(\S+)/)
  if (titleMatch)
    return `@${titleMatch[1]}`
  return null
}

// ── 内容折叠 ──
const collapsedItems = ref(new Set<string>())

function isCollapsed(id: string) {
  return collapsedItems.value.has(id)
}

function toggleCollapse(id: string) {
  const s = new Set(collapsedItems.value)
  if (s.has(id))
    s.delete(id)
  else s.add(id)
  collapsedItems.value = s
}

// ── 媒体画廊布局 ──
function getGalleryClass(media: MediaItem[]) {
  const count = Math.min(media.length, 4)
  if (count === 1)
    return 'grid-cols-1'
  if (count === 2)
    return 'grid-cols-2'
  return 'grid-cols-2'
}

function getImageClass(_media: MediaItem[], _index: number) {
  if (media.length === 1)
    return 'max-h-80 w-full object-contain'
  return 'aspect-square w-full object-cover'
}

// ── 相对时间 ──
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

// ── 点击图片预览 ──
function onImageClick(article: Article, index: number) {
  const images = article.media
    .filter(m => m.type === 'photo')
    .map(m => ({ url: m.url, width: m.width, height: m.height }))
  emit('preview', images, index)
}
</script>

<template>
  <div class="space-y-1 p-2">
    <article
      v-for="article in articles"
      :key="article.id"
      class="group relative rounded-lg border px-4 py-3 transition-colors cursor-pointer"
      :class="activeId === article.id
        ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'"
      @click="emit('select', article.id)"
    >
      <!-- 未读标记 -->
      <span
        v-if="!article.read"
        class="absolute top-3 right-3 size-2 rounded-full bg-orange-500"
      />

      <!-- 头部：头像 + 作者 + handle + 时间 -->
      <div class="flex items-start gap-3 mb-2">
        <!-- 头像 -->
        <div class="size-9 shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
          {{ (article.author || article.sourceTitle).charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ article.author || article.sourceTitle }}
            </span>
            <!-- Twitter handle badge -->
            <span
              v-if="parseHandle(article)"
              class="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
            >
              <svg class="size-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              {{ parseHandle(article) }}
            </span>
            <span class="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
              · {{ formatTime(article.publishedAt) }}
            </span>
          </div>
          <p class="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
            {{ article.sourceTitle }}
          </p>
        </div>
        <!-- 收藏 -->
        <button
          v-if="article.starred"
          class="shrink-0 text-amber-500"
          @click.stop="store.toggleStar(article.id)"
        >
          <Star class="size-3.5 fill-amber-500" />
        </button>
      </div>

      <!-- 内容（可折叠） -->
      <div
        class="relative"
        :class="{ 'max-h-[300px] overflow-hidden': isCollapsed(article.id) }"
      >
        <div
          class="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words"
          v-html="article.summary || article.title"
        />
        <!-- 折叠渐变遮罩 -->
        <div
          v-if="isCollapsed(article.id)"
          class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent"
        />
      </div>
      <button
        v-if="(article.summary || article.title).length > 200"
        class="mt-1 text-xs font-medium text-orange-500 hover:text-orange-600"
        @click.stop="toggleCollapse(article.id)"
      >
        {{ isCollapsed(article.id) ? '展开全文' : '收起' }}
      </button>

      <!-- 媒体画廊 -->
      <div
        v-if="article.media.some(m => m.type === 'photo')"
        class="mt-2.5 overflow-hidden rounded-lg"
        :class="getGalleryClass(article.media.filter(m => m.type === 'photo'))"
      >
        <div
          class="grid gap-0.5"
          :class="getGalleryClass(article.media.filter(m => m.type === 'photo'))"
        >
          <div
            v-for="(m, i) in article.media.filter(m => m.type === 'photo').slice(0, 4)"
            :key="m.url"
            class="relative overflow-hidden bg-neutral-100 dark:bg-neutral-800"
            :class="[
              article.media.filter(m => m.type === 'photo').length === 1 ? 'max-h-80' : 'aspect-square',
              i === 0 && article.media.filter(m => m.type === 'photo').length === 3 ? 'row-span-2' : '',
            ]"
            @click.stop="onImageClick(article, i)"
          >
            <img
              :src="m.url"
              :class="getImageClass(article.media.filter(m => m.type === 'photo'), i)"
              loading="lazy"
              alt=""
            >
            <!-- 第4张时显示剩余数量 -->
            <div
              v-if="i === 3 && article.media.filter(m => m.type === 'photo').length > 4"
              class="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white"
            >
              +{{ article.media.filter(m => m.type === 'photo').length - 4 }}
            </div>
          </div>
        </div>
      </div>

      <!-- 视频缩略图 -->
      <div
        v-if="article.media.some(m => m.type === 'video')"
        class="mt-2.5 overflow-hidden rounded-lg"
      >
        <div
          v-for="m in article.media.filter(m => m.type === 'video').slice(0, 1)"
          :key="m.url"
          class="relative aspect-video bg-neutral-100 dark:bg-neutral-800"
          @click.stop
        >
          <img
            v-if="m.previewImageUrl"
            :src="m.previewImageUrl"
            class="h-full w-full object-cover"
            loading="lazy"
            alt=""
          >
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="rounded-full bg-black/60 p-3">
              <svg class="size-6 text-white" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </div>
          <!-- 时长徽标 -->
          <span
            v-if="m.durationInSeconds"
            class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
          >
            {{ formatDuration(m.durationInSeconds) }}
          </span>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="mt-2 flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
        <button
          class="flex items-center gap-1 text-xs hover:text-orange-500 transition-colors"
          @click.stop="store.toggleStar(article.id)"
        >
          <Star class="size-3.5" :class="article.starred ? 'fill-amber-500 text-amber-500' : ''" />
          <span v-if="article.starred">{{ t('reading.starred') }}</span>
        </button>
        <a
          v-if="article.link"
          :href="article.link"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs hover:text-blue-500 transition-colors"
          @click.stop
        >
          ↗
        </a>
      </div>
    </article>

    <div v-if="!articles.length" class="py-12 text-center text-sm text-neutral-400">
      {{ t('reading.noArticles') }}
    </div>
  </div>
</template>
