<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { CheckSquare, Square } from '@lucide/vue'
import MediaRenderer from './MediaRenderer.vue'

defineProps<{
  articles: Article[]
  activeId: string | null
  isSelecting: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <div class="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
    <div
      v-for="article in articles"
      :key="article.id"
      class="group relative overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 transition-all cursor-pointer"
      :class="activeId === article.id
        ? 'ring-2 ring-orange-500 border-orange-300 dark:border-orange-700'
        : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md'"
      @click="emit('select', article.id)"
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
      <!-- 视频封面 -->
      <div class="aspect-video overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <MediaRenderer
          :media="article.media.find(m => m.type === 'video') || article.media[0] || { url: '', type: 'video' }"
          thumbnail
          class="h-full w-full"
        />
      </div>
      <!-- 信息 -->
      <div class="p-2.5">
        <p class="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {{ article.title }}
        </p>
        <div class="mt-1 flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span class="truncate">{{ article.sourceTitle }}</span>
          <span v-if="article.author" class="shrink-0">· {{ article.author }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
