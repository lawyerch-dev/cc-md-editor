<!-- @workspace reading -->
<script setup lang="ts">
import { Pause, Play, SkipBack, SkipForward, X } from '@lucide/vue'
import { computed } from 'vue'
import { useAudioPlayer } from '@/workspaces/reading/composables/useAudioPlayer'

const player = useAudioPlayer()

const progress = computed(() =>
  player.duration.value > 0 ? (player.currentTime.value / player.duration.value) * 100 : 0,
)

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function onSeek(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  player.seek(pct * player.duration.value)
}

const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
function cycleRate() {
  const idx = rates.indexOf(player.playbackRate.value)
  player.setPlaybackRate(rates[(idx + 1) % rates.length])
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    leave-active-class="transition-all duration-200 ease-in"
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="player.visible.value"
      class="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95"
      style="max-width: 380px"
    >
      <!-- 信息 -->
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {{ player.title.value || player.sourceTitle.value || '正在播放' }}
        </p>
        <p class="truncate text-[10px] text-neutral-500 dark:text-neutral-400">
          {{ player.sourceTitle.value }}
        </p>
      </div>

      <!-- 控制按钮 -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          class="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          @click="player.seekRelative(-15)"
        >
          <SkipBack class="size-3.5" />
        </button>
        <button
          class="rounded-full bg-orange-500 p-2 text-white hover:bg-orange-600"
          @click="player.togglePlay()"
        >
          <Pause v-if="player.playing.value" class="size-4" />
          <Play v-else class="size-4" />
        </button>
        <button
          class="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          @click="player.seekRelative(15)"
        >
          <SkipForward class="size-3.5" />
        </button>
      </div>

      <!-- 进度条 -->
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] tabular-nums text-neutral-400">
          {{ formatTime(player.currentTime.value) }}
        </span>
        <div
          class="h-1 w-16 cursor-pointer rounded-full bg-neutral-200 dark:bg-neutral-700"
          @click="onSeek"
        >
          <div
            class="h-full rounded-full bg-orange-500 transition-all"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <!-- 倍速 -->
      <button
        class="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        @click="cycleRate"
      >
        {{ player.playbackRate.value }}x
      </button>

      <!-- 关闭 -->
      <button
        class="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
        @click="player.close()"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </Transition>
</template>
