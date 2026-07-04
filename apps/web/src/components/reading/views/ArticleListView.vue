<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Image, Music, Play, Square } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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

/** 缩略图 URL — 优先取 media 中的 photo */
function thumbnailUrl(article: Article): string | null {
  const photo = article.media.find(m => m.type === 'photo')
  return photo?.previewImageUrl || photo?.url || null
}

/** 是否有视频 media */
function hasVideo(article: Article): boolean {
  return article.media.some(m => m.type === 'video')
}

/** 是否有音频 media */
function hasAudio(article: Article): boolean {
  return article.media.some(m => m.type === 'audio')
}

/** 非缩略图 photo media 数量 */
function extraMediaCount(article: Article): number {
  const firstPhotoIndex = article.media.findIndex(m => m.type === 'photo')
  const photos = article.media.filter(m => m.type === 'photo')
  return Math.max(0, photos.length - (firstPhotoIndex >= 0 ? 1 : 0))
}

/** 摘要行 — 截断到 80 字符 */
const summaryLine = computed(() => (article: Article) => {
  const s = article.summary?.trim()
  if (s) {
    return s.length > 80 ? `${s.slice(0, 80)}…` : s
  }
  return null
})
</script>

<template>
  <div>
    <div
      v-for="article in articles"
      :key="article.id"
      class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-neutral-50 dark:border-neutral-800/50"
      :class="activeId === article.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
      @click="emit('select', article.id)"
    >
      <!-- 未读/选中状态 -->
      <div v-if="!isSelecting" class="mt-1.5 size-2 shrink-0 rounded-full" :class="!article.read ? 'bg-orange-500' : 'bg-transparent'" />
      <div v-if="isSelecting" class="mt-1 shrink-0">
        <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-orange-500" />
        <Square v-else class="h-4 w-4 text-neutral-400" />
      </div>

      <!-- 正文区域 -->
      <div class="flex-1 min-w-0">
        <!-- 来源标题 -->
        <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span class="size-3.5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">
            {{ article.sourceTitle?.charAt(0)?.toUpperCase() || 'R' }}
          </span>
          <span class="truncate">{{ article.sourceTitle }}</span>
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

        <!-- 底部：媒体类型徽章 + 时间 -->
        <div class="flex items-center gap-2 mt-1">
          <!-- 纯音频（无缩略图） → 显示音乐图标 -->
          <span
            v-if="hasAudio(article) && !hasVideo(article) && !thumbnailUrl(article)"
            class="inline-flex items-center gap-0.5 text-[10px] text-purple-500 dark:text-purple-400"
          >
            <Music class="size-3" />
            <span>{{ article.media.filter(m => m.type === 'audio').length > 1 ? `${article.media.filter(m => m.type === 'audio').length} ` : '' }}{{ t('reading.mediaAudio') }}</span>
          </span>
          <!-- 纯视频（无缩略图） -->
          <span
            v-else-if="hasVideo(article) && !thumbnailUrl(article)"
            class="inline-flex items-center gap-0.5 text-[10px] text-red-500 dark:text-red-400"
          >
            <Play class="size-3" />
            <span>{{ t('reading.mediaVideo') }}</span>
          </span>
          <!-- 纯图片（无缩略图） -->
          <span
            v-else-if="article.media.some(m => m.type === 'photo') && !thumbnailUrl(article)"
            class="inline-flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400"
          >
            <Image class="size-3" />
            <span>{{ article.media.filter(m => m.type === 'photo').length > 1 ? `${article.media.length} ` : '' }}{{ t('reading.mediaPhoto') }}</span>
          </span>
          <!-- 多个混合媒体 -->
          <span
            v-else-if="article.media.length > 1"
            class="text-[10px] text-neutral-500"
          >
            {{ t('reading.mediaCount', { n: article.media.length }) }}
          </span>

          <span class="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {{ formatTime(article.publishedAt) }}
          </span>
        </div>
      </div>
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
