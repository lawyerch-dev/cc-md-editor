<script setup lang="ts">
import type { Article } from '@/stores/reading'

defineProps<{
  articles: Article[]
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
  <div class="space-y-3 p-4">
    <div
      v-for="article in articles"
      :key="article.id"
      class="rounded-lg border bg-background p-3"
    >
      <!-- 头部：头像 + 作者 + 来源 -->
      <div class="flex items-center gap-2 mb-2">
        <div class="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground overflow-hidden">
          {{ (article.author || article.sourceTitle).charAt(0) }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">
            {{ article.author || article.sourceTitle }}
          </p>
          <p class="text-[10px] text-muted-foreground">
            {{ article.sourceTitle }} · {{ formatTime(article.publishedAt) }}
          </p>
        </div>
      </div>
      <!-- 内容 -->
      <p class="text-sm leading-relaxed">
        {{ article.summary || article.title }}
      </p>
      <!-- 媒体 -->
      <div v-if="article.media.length" class="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        <img
          v-for="(m, i) in article.media.slice(0, 4)"
          :key="m.url"
          :src="m.url"
          class="w-full object-cover aspect-square"
          :class="{ 'col-span-2': i === 0 && article.media.length === 1 }"
          loading="lazy"
          alt=""
        >
      </div>
    </div>
  </div>
</template>
