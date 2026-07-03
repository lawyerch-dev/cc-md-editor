<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Square } from '@lucide/vue'

defineProps<{
  articles: Article[]
  activeId: string | null
  isSelecting: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

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
</script>

<template>
  <div>
    <div
      v-for="article in articles"
      :key="article.id"
      class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-neutral-50 dark:border-neutral-800/50"
      :class="activeId === article.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
      @click="emit('select', article.id)"
    >
      <div v-if="!isSelecting" class="size-2 shrink-0 rounded-full" :class="!article.read ? 'bg-orange-500' : 'bg-transparent'" />
      <div v-if="isSelecting" class="shrink-0">
        <CheckSquare v-if="selectedIds.has(article.id)" class="h-4 w-4 text-orange-500" />
        <Square v-else class="h-4 w-4 text-neutral-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span class="size-3.5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">R</span>
          <span class="truncate">{{ article.sourceTitle }}</span>
        </div>
        <span
          class="block mt-0.5 text-[13px] leading-snug truncate"
          :class="article.read ? 'text-neutral-500' : 'font-medium text-neutral-900 dark:text-neutral-100'"
        >{{ article.title }}</span>
      </div>
      <span class="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0 whitespace-nowrap tabular-nums">
        {{ formatTime(article.publishedAt) }}
      </span>
    </div>
  </div>
</template>
