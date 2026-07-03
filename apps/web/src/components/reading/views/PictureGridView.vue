<script setup lang="ts">
import type { Article } from '@/stores/reading'
import MediaRenderer from './MediaRenderer.vue'

defineProps<{
  articles: Article[]
}>()
</script>

<template>
  <div class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
    <div
      v-for="article in articles"
      :key="article.id"
      class="group relative overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
    >
      <!-- 封面图 -->
      <div class="aspect-[4/3] overflow-hidden bg-muted">
        <MediaRenderer
          v-if="article.media.length > 0"
          :media="article.media[0]"
          thumbnail
          class="h-full w-full"
        />
        <div v-else class="flex h-full items-center justify-center text-muted-foreground/40">
          <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        </div>
      </div>
      <!-- 信息 -->
      <div class="p-2">
        <p class="line-clamp-2 text-xs font-medium leading-snug">
          {{ article.title }}
        </p>
        <p class="mt-0.5 text-[10px] text-muted-foreground">
          {{ article.sourceTitle }}
        </p>
      </div>
    </div>
  </div>
</template>
