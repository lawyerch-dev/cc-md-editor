<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Square } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  articles: Article[]
  activeId: string | null
  isSelecting: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
  preview: [images: Array<{ url: string, width?: number, height?: number }>, index: number]
}>()

const { t } = useI18n()

// ── Hover 预览 ──
const hoveredId = ref<string | null>(null)
const hoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function onMouseEnter(id: string) {
  hoverTimer.value = setTimeout(() => { hoveredId.value = id }, 500)
}

function onMouseLeave() {
  if (hoverTimer.value)
    clearTimeout(hoverTimer.value)
  hoveredId.value = null
}

// ── 时长格式化 ──
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function getDuration(article: Article): number | null {
  for (const m of article.media) {
    if (m.type === 'video' && m.durationInSeconds)
      return m.durationInSeconds
  }
  for (const att of article.attachments) {
    if (att.durationInSeconds)
      return att.durationInSeconds
  }
  return null
}

function getVideoSrc(article: Article): string {
  // 优先找视频 media 的直接 URL
  const video = article.media.find(m => m.type === 'video')
  if (video?.url)
    return video.url
  // 尝试 attachments
  const att = article.attachments.find(a => a.mimeType?.startsWith('video/') || a.url.match(/\.(mp4|webm|ogg)/i))
  if (att?.url)
    return att.url
  return ''
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
    <div
      v-for="article in articles"
      :key="article.id"
      class="group relative overflow-hidden rounded-lg border transition-all cursor-pointer"
      :class="activeId === article.id
        ? 'ring-2 ring-orange-500 border-orange-300 dark:border-orange-700'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:shadow-md'"
      @click="emit('select', article.id)"
      @mouseenter="onMouseEnter(article.id)"
      @mouseleave="onMouseLeave"
    >
      <!-- 多选复选框 -->
      <div
        v-if="isSelecting"
        class="absolute top-2 left-2 z-10 rounded bg-white/80 dark:bg-black/60 p-0.5"
        @click.stop="emit('select', article.id)"
      >
        <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-orange-500" />
        <Square v-else class="h-4 w-4 text-neutral-400" />
      </div>
      <!-- 未读标记 -->
      <span
        v-if="!article.read && !isSelecting"
        class="absolute top-2 right-2 z-10 size-2 rounded-full bg-orange-500"
      />

      <!-- 视频封面 / Hover 预览 -->
      <div class="relative aspect-video overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <!-- 缩略图 -->
        <template v-if="hoveredId !== article.id">
          <img
            v-if="article.media.find(m => m.type === 'video')?.previewImageUrl"
            :src="article.media.find(m => m.type === 'video')!.previewImageUrl"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            alt=""
          >
          <img
            v-else-if="article.media[0]?.url"
            :src="article.media[0].url"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            alt=""
          >
          <!-- 无图占位 -->
          <div v-else class="flex h-full items-center justify-center">
            <svg class="size-10 text-neutral-300 dark:text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
          <!-- 播放按钮覆盖层 -->
          <div class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="rounded-full bg-black/60 p-3 backdrop-blur-sm">
              <svg class="size-6 text-white" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </div>
        </template>

        <!-- Hover 预览：内联视频 -->
        <template v-else>
          <video
            :src="getVideoSrc(article)"
            class="h-full w-full object-cover"
            autoplay
            muted
            loop
            playsinline
          />
        </template>

        <!-- 时长徽标 -->
        <span
          v-if="getDuration(article)"
          class="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm"
        >
          {{ formatDuration(getDuration(article)!) }}
        </span>
      </div>

      <!-- 信息 -->
      <div class="p-2.5">
        <p class="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {{ article.title || '无标题' }}
        </p>
        <div class="mt-1 flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span class="truncate">{{ article.sourceTitle }}</span>
          <span v-if="article.author" class="shrink-0">· {{ article.author }}</span>
        </div>
      </div>
    </div>

    <div v-if="!articles.length" class="col-span-full py-12 text-center text-sm text-neutral-400">
      {{ t('reading.noArticles') }}
    </div>
  </div>
</template>
