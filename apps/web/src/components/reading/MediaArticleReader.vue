<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Star } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReadingStore } from '@/stores/reading'
import PodcastInlinePlayer from './views/PodcastInlinePlayer.vue'

const props = defineProps<{
  article: Article
  /** 媒体类型：自动检测或强制指定 */
  mediaType?: 'picture' | 'video' | 'audio'
  canGoPrev?: boolean
  canGoNext?: boolean
}>()

const emit = defineEmits<{
  close: []
  prevArticle: []
  nextArticle: []
  preview: [images: Array<{ url: string, width?: number, height?: number }>, index: number]
}>()

const { t } = useI18n()

function formatDate(ts: number) {
  const diff = Date.now() - ts
  if (diff < 3600000)
    return t('reading.justNow')
  if (diff < 86400000)
    return t('reading.hoursAgo', { n: Math.floor(diff / 3600000) })
  if (diff < 604800000)
    return t('reading.daysAgo', { n: Math.floor(diff / 86400000) })
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 检测媒体类型
const detectedType = computed(() => {
  if (props.mediaType)
    return props.mediaType
  const media = props.article.media || []
  if (media.some(m => m.type === 'video'))
    return 'video'
  if (media.some(m => m.type === 'audio'))
    return 'audio'
  if (media.some(m => m.type === 'photo'))
    return 'picture'
  return 'picture'
})

// 图片列表
const mediaItems = computed(() => props.article.media || [])
const photos = computed(() => mediaItems.value.filter(m => m.type === 'photo'))
const currentImageIndex = ref(0)

// 视频
const video = computed(() => mediaItems.value.find(m => m.type === 'video'))

// 音频
const audio = computed(() => mediaItems.value.find(m => m.type === 'audio') || props.article.attachments?.find(a => a.mimeType?.startsWith('audio')))

// 文本内容
const textContent = computed(() => {
  const content = props.article.content || props.article.summary || ''
  return content.replace(/<[^>]*>/g, '').trim()
})

const readingStore = useReadingStore()
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button
          class="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          @click="emit('close')"
        >
          <ArrowLeft class="h-4 w-4" />
        </button>
        <span class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{{ article.sourceTitle }}</span>
        <span class="text-xs text-neutral-400">·</span>
        <span class="text-xs text-neutral-400 dark:text-neutral-500">{{ formatDate(article.publishedAt) }}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="detectedType === 'picture'"
          class="rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :class="props.canGoPrev ? 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300' : 'text-neutral-300 dark:text-neutral-700'"
          :disabled="!props.canGoPrev"
          @click="emit('prevArticle')"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button
          v-if="detectedType === 'picture'"
          class="rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :class="props.canGoNext ? 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300' : 'text-neutral-300 dark:text-neutral-700'"
          :disabled="!props.canGoNext"
          @click="emit('nextArticle')"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
        <slot name="toolbar-extra" />
        <button
          class="rounded-lg p-1.5 transition-colors"
          :class="article.starred ? 'text-amber-500' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
          @click="readingStore.toggleStar(article.id)"
        >
          <Star class="h-4 w-4" :class="article.starred && 'fill-amber-500'" />
        </button>
        <a
          v-if="article.link"
          :href="article.link"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 图片模式 -->
      <template v-if="detectedType === 'picture'">
        <div class="flex flex-col items-center p-4 gap-4">
          <!-- 大图展示 -->
          <div v-if="photos.length > 0" class="w-full max-w-4xl">
            <div class="relative overflow-hidden rounded-[22px] border border-neutral-200/70 bg-neutral-50 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex items-center justify-between border-b border-neutral-200/70 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <div class="min-w-0">
                  <p class="truncate font-medium text-neutral-700 dark:text-neutral-200">
                    {{ article.title || t('reading.untitled') }}
                  </p>
                  <p class="mt-0.5 truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                    {{ article.sourceTitle }}
                  </p>
                </div>
                <span v-if="photos.length > 1" class="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {{ currentImageIndex + 1 }} / {{ photos.length }}
                </span>
              </div>
              <div class="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-950 cursor-pointer" @click="emit('preview', photos.map(p => ({ url: p.url, width: p.width, height: p.height })), currentImageIndex)">
                <img
                  :src="photos[currentImageIndex]?.url"
                  class="h-full w-full object-contain"
                  alt=""
                >
                <button
                  v-if="photos.length > 1 && currentImageIndex > 0"
                  class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                  @click="currentImageIndex--"
                >
                  <ChevronLeft class="h-5 w-5" />
                </button>
                <button
                  v-if="photos.length > 1 && currentImageIndex < photos.length - 1"
                  class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                  @click="currentImageIndex++"
                >
                  <ChevronRight class="h-5 w-5" />
                </button>
              </div>
            </div>
            <div v-if="photos.length > 1" class="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="(photo, i) in photos"
                :key="photo.url"
                class="shrink-0 overflow-hidden rounded-xl border-2 transition-all"
                :class="i === currentImageIndex ? 'border-orange-500 shadow-sm' : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'"
                @click="currentImageIndex = i"
              >
                <img :src="photo.url" class="h-16 w-16 object-cover" alt="">
              </button>
            </div>
          </div>
          <div v-else class="flex h-64 flex-col items-center justify-center gap-2 text-neutral-400">
            <svg class="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            <span class="text-sm">{{ t('reading.noPictures') }}</span>
          </div>
        </div>
      </template>

      <!-- 视频模式 -->
      <template v-else-if="detectedType === 'video'">
        <div class="flex flex-col p-4 gap-4">
          <!-- 视频播放器 -->
          <div v-if="video" class="w-full max-w-4xl mx-auto">
            <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                :src="video.url"
                controls
                preload="metadata"
                class="w-full h-full"
                :poster="video.previewImageUrl"
              />
            </div>
          </div>
          <div v-else class="w-full max-w-4xl mx-auto aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
            <div class="text-neutral-400 text-center">
              <svg class="size-12 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              <span class="text-sm">暂无视频</span>
            </div>
          </div>

          <!-- 标题 + 内容 -->
          <div class="max-w-4xl mx-auto w-full">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
              {{ article.title || '无标题' }}
            </h2>
            <div class="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{{ article.sourceTitle }}</span>
              <span v-if="article.author">· {{ article.author }}</span>
            </div>
            <p v-if="textContent" class="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {{ textContent }}
            </p>
          </div>
        </div>
      </template>

      <!-- 音频模式 -->
      <template v-else-if="detectedType === 'audio'">
        <div class="flex flex-col p-4 gap-4">
          <!-- 音频播放器 -->
          <div v-if="audio" class="w-full max-w-2xl mx-auto">
            <div class="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
              <PodcastInlinePlayer :article="article" />
            </div>
          </div>

          <!-- 文章内容 -->
          <div class="max-w-2xl mx-auto w-full">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
              {{ article.title || '无标题' }}
            </h2>
            <p
              v-if="textContent"
              class="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed"
            >
              {{ textContent }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.article-content :deep(img) {
  display: block;
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1rem auto;
}
.article-content :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.8;
}
.article-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}
</style>
