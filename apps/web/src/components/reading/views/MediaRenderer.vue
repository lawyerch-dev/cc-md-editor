<!-- @workspace reading -->
<script setup lang="ts">
import type { MediaItem } from '@/stores/reading'

defineProps<{
  media: MediaItem
  /** 缩略图模式（小图显示） */
  thumbnail?: boolean
  /** 懒加载 */
  loading?: 'lazy' | 'eager'
}>()

const emit = defineEmits<{
  click: [item: MediaItem]
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
  <div
    class="relative overflow-hidden"
    :class="[
      thumbnail ? 'cursor-pointer' : 'w-full',
    ]"
    @click="emit('click', media)"
  >
    <!-- 图片 -->
    <img
      v-if="media.type === 'photo'"
      :src="media.url"
      :width="media.width"
      :height="media.height"
      :loading="loading || 'lazy'"
      class="h-full w-full object-cover"
      :class="{ rounded: thumbnail }"
      alt=""
    >
    <!-- 视频 -->
    <div
      v-else-if="media.type === 'video'"
      class="group relative"
    >
      <img
        v-if="media.previewImageUrl"
        :src="media.previewImageUrl"
        :width="media.width"
        :height="media.height"
        class="h-full w-full object-cover"
        alt=""
      >
      <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <svg class="h-10 w-10 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <span v-if="media.durationInSeconds" class="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
        {{ formatDuration(media.durationInSeconds) }}
      </span>
    </div>
    <!-- 音频 -->
    <div
      v-else-if="media.type === 'audio'"
      class="flex items-center gap-2 rounded-lg bg-muted p-2"
    >
      <svg class="h-5 w-5 shrink-0 text-primary" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <div class="flex-1 truncate text-xs text-muted-foreground">
        {{ media.mimeType || 'audio' }}
      </div>
      <span v-if="media.durationInSeconds" class="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {{ formatDuration(media.durationInSeconds) }}
      </span>
    </div>
  </div>
</template>
