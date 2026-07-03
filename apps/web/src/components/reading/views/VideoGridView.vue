<script setup lang="ts">
import type { Article } from '@/stores/reading'
import MediaRenderer from './MediaRenderer.vue'

defineProps<{
  articles: Article[]
}>()
</script>

<template>
  <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
    <div
      v-for="article in articles"
      :key="article.id"
      class="group overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
    >
      <!-- 视频封面 -->
      <div class="aspect-video overflow-hidden bg-muted">
        <MediaRenderer
          :media="article.media.find(m => m.type === 'video') || article.media[0] || { url: '', type: 'video' }"
          thumbnail
          class="h-full w-full"
        />
      </div>
      <!-- 信息 -->
      <div class="p-2.5">
        <p class="line-clamp-2 text-sm font-medium leading-snug">
          {{ article.title }}
        </p>
        <div class="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{{ article.sourceTitle }}</span>
          <span v-if="article.author">· {{ article.author }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
