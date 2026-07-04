<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Square } from '@lucide/vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

defineProps<{
  articles: Article[]
  activeId: string | null
  isSelecting: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const player = useAudioPlayer()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function getDuration(article: Article): string | null {
  for (const att of article.attachments) {
    if (att.durationInSeconds)
      return formatDuration(att.durationInSeconds)
  }
  for (const m of article.media) {
    if (m.durationInSeconds)
      return formatDuration(m.durationInSeconds)
  }
  return null
}

function getAudioSrc(article: Article): string {
  for (const att of article.attachments) {
    if (att.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)/i.test(att.url))
      return att.url
  }
  for (const m of article.media) {
    if (m.type === 'audio' || /\.(?:mp3|wav|ogg|m4a|aac|flac)/i.test(m.url))
      return m.url
  }
  return ''
}

function toggleAudio(article: Article) {
  const src = getAudioSrc(article)
  if (!src)
    return
  if (player.isPlaying(src)) {
    player.togglePlay()
  }
  else {
    player.play(src, { title: article.title, sourceTitle: article.sourceTitle, articleId: article.id })
  }
}
</script>

<template>
  <div class="space-y-1 p-3">
    <div
      v-for="article in articles"
      :key="article.id"
      class="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all cursor-pointer"
      :class="activeId === article.id
        ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'"
      @click="emit('select', article.id)"
    >
      <!-- 多选 / 播放按钮 -->
      <div v-if="isSelecting" class="shrink-0" @click.stop="emit('select', article.id)">
        <CheckSquare v-if="selectedIds.has(article.id)" class="h-5 w-5 text-orange-500" />
        <Square v-else class="h-5 w-5 text-neutral-400" />
      </div>
      <button
        v-else
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
        @click.stop="toggleAudio(article)"
      >
        <svg v-if="player.isPlaying(getAudioSrc(article))" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
        <svg v-else class="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>

      <!-- 未读标记 + 信息 -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span v-if="!article.read && !isSelecting" class="size-1.5 shrink-0 rounded-full bg-orange-500" />
          <p class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ article.title }}
          </p>
        </div>
        <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span class="truncate">{{ article.sourceTitle }}</span>
          <template v-if="getDuration(article)">
            <span class="shrink-0">·</span>
            <span class="shrink-0 tabular-nums">{{ getDuration(article) }}</span>
          </template>
        </div>
      </div>

      <!-- 下载链接 -->
      <a
        v-for="att in article.attachments"
        :key="att.url"
        :href="att.url"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        :title="att.title || 'Download'"
        @click.stop
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
    </div>
  </div>
</template>
