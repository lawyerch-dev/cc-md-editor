<!-- @workspace reading -->
<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Image, Music, Play, Square } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useReadingStore } from '@/stores/reading'

defineProps<{
  articles: Article[]
  activeId: string | null
  isSelecting: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const { t } = useI18n()
const readingStore = useReadingStore()

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

function safeMedia(article: Article) { return article.media || [] }

/** 缩略图 URL — 优先取 media 中的 photo */
function thumbnailUrl(article: Article): string | null {
  const photo = safeMedia(article).find(m => m.type === 'photo')
  return photo?.previewImageUrl || photo?.url || null
}

/** 是否有视频 media */
function hasVideo(article: Article): boolean {
  return safeMedia(article).some(m => m.type === 'video')
}

/** 媒体类型标签 — 按源的实际视图类型匹配，而非猜测 media 内容 */
function articleViewType(article: Article): string {
  const src = readingStore.sources.find(s => s.id === article.sourceId)
  if (src) {
    const map: Record<number, string> = { 0: 'article', 1: 'picture', 2: 'video', 3: 'audio' }
    return map[src.view] || 'article'
  }
  // 降级：从 media/attachments 推断
  const media = safeMedia(article)
  if (media.some(m => m.type === 'video'))
    return 'video'
  if (media.some(m => m.type === 'audio') || article.attachments?.some(a => a.mimeType?.startsWith('audio/')))
    return 'audio'
  if (media.some(m => m.type === 'photo'))
    return 'picture'
  return 'article'
}

/** 非缩略图 photo media 数量 */
function extraMediaCount(article: Article): number {
  const media = safeMedia(article)
  const firstPhotoIndex = media.findIndex(m => m.type === 'photo')
  const photos = media.filter(m => m.type === 'photo')
  return Math.max(0, photos.length - (firstPhotoIndex >= 0 ? 1 : 0))
}

/** 摘要行 — 截断到 80 字符 */
const summaryLine = computed(() => (article: Article) => {
  const s = article.summary?.replace(/\[!--begin:\w+--\][\s\S]*?\[!--end:\w+--\]/g, '').trim()
  if (s) {
    return s.length > 80 ? `${s.slice(0, 80)}…` : s
  }
  return null
})
</script>

<template>
  <div>
    <div
      v-for="(article, idx) in articles"
      :key="article.id"
      class="relative flex items-start gap-2 px-3 py-3 min-h-[82px] rounded-lg cursor-pointer transition-colors"
      :class="activeId === article.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
      @click="emit('select', article.id)"
    >
      <!-- 渐变分割线 -->
      <div
        v-if="idx < articles.length - 1"
        class="absolute left-3 right-3 bottom-0 h-px bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent pointer-events-none"
      />
      <span class="mt-1 shrink-0 w-5 text-right text-[11px] tabular-nums text-neutral-300 dark:text-neutral-600 select-none">{{ idx + 1 }}</span>
      <!-- 未读/选中状态 -->
      <div v-if="!isSelecting" class="mt-1.5 size-1.5 shrink-0 rounded-full" :class="!article.read ? 'bg-orange-500' : 'bg-transparent'" />
      <div v-if="isSelecting" class="mt-1 shrink-0">
        <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-orange-500" />
        <Square v-else class="h-4 w-4 text-neutral-400" />
      </div>

      <!-- 正文区域 -->
      <div class="flex-1 min-w-0">
        <!-- 来源标题行 + 徽章+时间（右上角） -->
        <div class="flex items-start gap-2">
          <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 min-w-0 flex-1">
            <span class="size-3.5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">
              {{ article.sourceTitle?.charAt(0)?.toUpperCase() || 'R' }}
            </span>
            <span class="truncate">{{ article.sourceTitle }}</span>
          </div>
          <!-- 右上角：媒体类型徽章 + 时间（按源视图类型） -->
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="inline-flex items-center gap-0.5 text-[10px] font-medium"
              :class="{
                'text-blue-500 dark:text-blue-400': articleViewType(article) === 'article',
                'text-green-600 dark:text-green-400': articleViewType(article) === 'picture',
                'text-red-500 dark:text-red-400': articleViewType(article) === 'video',
                'text-purple-500 dark:text-purple-400': articleViewType(article) === 'audio',
              }"
            >
              <template v-if="articleViewType(article) === 'video'">
                <Play class="size-2.5" />{{ t('reading.mediaVideo') }}
              </template>
              <template v-else-if="articleViewType(article) === 'audio'">
                <Music class="size-2.5" />{{ t('reading.mediaAudio') }}
              </template>
              <template v-else-if="articleViewType(article) === 'picture'">
                <Image class="size-2.5" />{{ t('reading.mediaPhoto') }}
              </template>
              <template v-else>
                <span class="size-2.5 inline-flex items-center justify-center text-[8px] font-bold">A</span>{{ t('reading.mediaArticle') }}
              </template>
            </span>
            <span class="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums whitespace-nowrap">
              {{ formatTime(article.publishedAt) }}
            </span>
          </div>
        </div>

        <!-- 标题行 → 带缩略图 -->
        <div class="flex items-start gap-2 mt-0.5">
          <span
            class="block text-[13px] leading-snug flex-1 min-w-0"
            :class="[
              article.read ? 'text-neutral-500' : 'font-medium text-neutral-900 dark:text-neutral-100',
              { truncate: !summaryLine(article) },
            ]"
          >{{ article.title || t('reading.untitled') }}</span>

          <!-- 缩略图（仅照片/视频） -->
          <div
            v-if="thumbnailUrl(article)"
            class="relative size-10 shrink-0 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 mt-0.5"
          >
            <img
              :src="thumbnailUrl(article)!"
              class="h-full w-full object-cover"
              alt=""
              loading="lazy"
            >
            <!-- 视频播放图标 -->
            <div
              v-if="hasVideo(article)"
              class="absolute inset-0 flex items-center justify-center bg-black/20"
            >
              <Play class="size-4 text-white drop-shadow" fill="white" />
            </div>
            <!-- 多图计数 -->
            <span
              v-if="extraMediaCount(article) > 0"
              class="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 py-0.5 text-[9px] text-white leading-none tabular-nums"
            >+{{ extraMediaCount(article) }}</span>
          </div>
        </div>

        <!-- 摘要/描述行 -->
        <div v-if="summaryLine(article)" class="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed line-clamp-2">
          {{ summaryLine(article) }}
        </div>
      </div>
    </div>
    <div v-if="!articles.length" class="py-12 text-center text-sm text-neutral-400">
      {{ t('reading.noArticles') }}
    </div>
  </div>
</template>

<style scoped>
/* 多行文字截断 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
