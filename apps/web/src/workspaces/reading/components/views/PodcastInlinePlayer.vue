<!-- @workspace reading -->
<script setup lang="ts">
import type { Article } from '@/workspaces/reading/stores'
import { Download, Pause, Play, SkipBack, SkipForward } from '@lucide/vue'
import { computed } from 'vue'
import { useAudioPlayer } from '@/workspaces/reading/composables/useAudioPlayer'

const props = defineProps<{
  article: Article
}>()

const player = useAudioPlayer()

const audioMedia = computed(() => {
  const m = props.article.media.find(m => m.type === 'audio')
  if (m)
    return m
  const att = props.article.attachments?.find(a => a.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(a.url))
  if (att)
    return { url: att.url, type: 'audio' as const, mimeType: att.mimeType, durationInSeconds: att.durationInSeconds }
  return undefined
})
const coverImage = computed(() => audioMedia.value?.previewImageUrl || props.article.media.find(m => m.type === 'photo')?.url)
const audioSrc = computed(() => audioMedia.value?.url || '')
const duration = computed(() => audioMedia.value?.durationInSeconds || 0)
const isPlaying = computed(() => player.isPlaying(audioSrc.value))

const currentTime = computed(() =>
  player.src.value === audioSrc.value ? player.currentTime.value : 0,
)
const totalDuration = computed(() =>
  player.src.value === audioSrc.value ? player.duration.value : duration.value,
)
const progress = computed(() =>
  totalDuration.value > 0 ? (currentTime.value / totalDuration.value) * 100 : 0,
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
  if (isPlaying.value)
    player.togglePlay()
  else if (player.src.value === audioSrc.value)
    player.togglePlay()
  else
    player.play(audioSrc.value, { title: props.article.title, sourceTitle: props.article.sourceTitle, articleId: props.article.id })
}

function onSeek(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  if (totalDuration.value)
    player.seek(pct * totalDuration.value)
}
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- 顶部：封面 + 信息 + 下载 -->
    <div class="flex w-full items-center gap-3">
      <div class="size-10 shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700">
        <img v-if="coverImage" :src="coverImage" class="h-full w-full object-cover" alt="">
        <div v-else class="flex h-full items-center justify-center">
          <svg class="size-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {{ article.title || '音频' }}
        </p>
        <p class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
          {{ article.sourceTitle }}
        </p>
      </div>
      <a
        v-if="audioSrc"
        :href="audioSrc"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        title="下载"
        @click.stop
      >
        <Download class="size-4" />
      </a>
    </div>

    <!-- 进度条 -->
    <div class="w-full flex items-center gap-2">
      <span class="w-10 text-right text-[10px] tabular-nums text-neutral-400">{{ formatTime(currentTime) }}</span>
      <div
        class="flex-1 h-1.5 cursor-pointer rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden group"
        @click="onSeek"
      >
        <div
          class="h-full rounded-full bg-orange-500 transition-all duration-150 group-hover:bg-orange-400"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <span class="w-10 text-[10px] tabular-nums text-neutral-400">{{ formatTime(totalDuration) }}</span>
    </div>

    <!-- 控制按钮（居中） -->
    <div class="flex items-center gap-4">
      <button
        class="rounded-full p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        @click="player.seekRelative(-15)"
      >
        <SkipBack class="size-4" />
      </button>
      <button
        class="rounded-full bg-orange-500 p-3 text-white hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
        @click="togglePlay"
      >
        <Pause v-if="isPlaying" class="size-5" />
        <Play v-else class="ml-0.5 size-5" />
      </button>
      <button
        class="rounded-full p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        @click="player.seekRelative(15)"
      >
        <SkipForward class="size-4" />
      </button>
    </div>
  </div>
</template>
