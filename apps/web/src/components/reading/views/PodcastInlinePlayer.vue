<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { Download, Pause, Play, SkipBack, SkipForward } from '@lucide/vue'
import { computed } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = defineProps<{
  article: Article
}>()

const player = useAudioPlayer()

const audioMedia = computed(() => {
  // 优先从 media 找音频
  const m = props.article.media.find(m => m.type === 'audio')
  if (m)
    return m
  // 回退到 attachments
  const att = props.article.attachments?.find(a => a.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(a.url))
  if (att)
    return { url: att.url, type: 'audio' as const, mimeType: att.mimeType, durationInSeconds: att.durationInSeconds }
  return undefined
})
const coverImage = computed(() => audioMedia.value?.previewImageUrl || props.article.media.find(m => m.type === 'photo')?.url)
const audioSrc = computed(() => audioMedia.value?.url || '')
const duration = computed(() => audioMedia.value?.durationInSeconds || 0)
const isPlaying = computed(() => player.isPlaying(audioSrc.value))

const progress = computed(() =>
  player.duration.value > 0 && player.src.value === audioSrc.value
    ? (player.currentTime.value / player.duration.value) * 100
    : 0,
)

function formatTime(s: number) {
  if (!s || !isFinite(s))
    return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function togglePlay() {
  if (!audioSrc.value)
    return
  if (isPlaying.value) {
    player.togglePlay()
  }
  else if (player.src.value === audioSrc.value) {
    player.togglePlay()
  }
  else {
    player.play(audioSrc.value, {
      title: props.article.title,
      sourceTitle: props.article.sourceTitle,
      articleId: props.article.id,
    })
  }
}

function onSeek(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  const targetDuration = player.src.value === audioSrc.value ? player.duration.value : duration.value
  if (targetDuration)
    player.seek(pct * targetDuration)
}
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- 封面 -->
    <div class="size-14 shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700">
      <img v-if="coverImage" :src="coverImage" class="h-full w-full object-cover" alt="">
      <div v-else class="flex h-full items-center justify-center">
        <svg class="size-6 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <!-- 控制栏 -->
      <div class="flex items-center gap-3">
        <button
          class="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
          @click="player.seekRelative(-15)"
        >
          <SkipBack class="size-4" />
        </button>
        <button
          class="rounded-full bg-orange-500 p-2.5 text-white hover:bg-orange-600 transition-colors shadow-sm"
          @click="togglePlay"
        >
          <Pause v-if="isPlaying" class="size-5" />
          <Play v-else class="ml-0.5 size-5" />
        </button>
        <button
          class="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
          @click="player.seekRelative(15)"
        >
          <SkipForward class="size-4" />
        </button>

        <!-- 时间 -->
        <span class="text-xs tabular-nums text-neutral-500">
          {{ player.src.value === audioSrc ? formatTime(player.currentTime.value) : '0:00' }}
        </span>
        <span class="text-xs text-neutral-300">/</span>
        <span class="text-xs tabular-nums text-neutral-400">
          {{ formatTime(player.src.value === audioSrc ? player.duration.value : duration) }}
        </span>

        <div class="flex-1" />

        <!-- 下载 -->
        <a
          v-if="audioSrc"
          :href="audioSrc"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          title="下载"
          @click.stop
        >
          <Download class="size-4" />
        </a>
      </div>

      <!-- 进度条 -->
      <div
        class="mt-2 h-1.5 w-full cursor-pointer rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"
        @click="onSeek"
      >
        <div
          class="h-full rounded-full bg-orange-500 transition-all duration-150"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>
  </div>
</template>
