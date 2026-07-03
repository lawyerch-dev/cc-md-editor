<script setup lang="ts">
import type { Article } from '@/stores/reading'

defineProps<{
  articles: Article[]
}>()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="space-y-1 p-4">
    <div
      v-for="article in articles"
      :key="article.id"
      class="flex items-center gap-3 rounded-lg border bg-background p-3 transition-shadow hover:shadow-sm"
    >
      <!-- 播放按钮 -->
      <button class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
        <svg class="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>
      <!-- 信息 -->
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {{ article.title }}
        </p>
        <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{{ article.sourceTitle }}</span>
          <template v-for="att in article.attachments" :key="att.url">
            <span v-if="att.durationInSeconds">· {{ formatDuration(att.durationInSeconds) }}</span>
          </template>
          <template v-for="m in article.media" :key="m.url">
            <span v-if="m.durationInSeconds">· {{ formatDuration(m.durationInSeconds) }}</span>
          </template>
        </div>
      </div>
      <!-- 下载 -->
      <a
        v-for="att in article.attachments"
        :key="att.url"
        :href="att.url"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        :title="att.title || 'Download'"
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
