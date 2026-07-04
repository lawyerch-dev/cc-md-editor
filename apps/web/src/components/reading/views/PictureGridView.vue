<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  articles: Article[]
  activeId: string | null
  imageOnly?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  preview: [images: Array<{ url: string, width?: number, height?: number }>, index: number]
}>()

const { t } = useI18n()

const pictureArticles = computed(() => props.articles.filter(article => article.media.some(m => m.type === 'photo')))

function getPhotos(article: Article) {
  return article.media.filter(m => m.type === 'photo')
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1)
    return t('reading.justNow')
  if (days < 1)
    return t('reading.hoursAgo', { n: hours })
  return t('reading.daysAgo', { n: days })
}

function handleImageClick(article: Article, e: Event) {
  e.stopPropagation()
  const photos = getPhotos(article)
  if (!photos.length)
    return
  emit('preview', photos.map(p => ({ url: p.url, width: p.width, height: p.height })), 0)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <div class="grid gap-x-4 gap-y-5" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))">
        <article
          v-for="article in pictureArticles"
          :key="article.id"
          class="group"
          @click="emit('select', article.id)"
        >
          <div
            class="relative overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
            :class="activeId === article.id ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950' : ''"
          >
            <div class="aspect-square overflow-hidden">
              <img
                v-if="getPhotos(article)[0]"
                :src="getPhotos(article)[0].url"
                :width="getPhotos(article)[0].width"
                :height="getPhotos(article)[0].height"
                class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
                alt=""
                @click="handleImageClick(article, $event)"
              >
              <div v-else class="flex h-full w-full items-center justify-center text-neutral-300 dark:text-neutral-600">
                <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </div>
            </div>
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent opacity-90" />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white">
              <p class="line-clamp-2 text-[13px] font-semibold leading-5 drop-shadow-sm">
                {{ article.title || t('reading.untitled') }}
              </p>
              <p v-if="!imageOnly" class="mt-1 truncate text-[11px] text-white/72">
                {{ article.sourceTitle }}
              </p>
            </div>
            <span
              v-if="!article.read"
              class="absolute right-3 top-3 size-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(255,255,255,0.2)]"
            />
            <span
              v-if="getPhotos(article).length > 1"
              class="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
            >
              {{ t('reading.imageCount', { count: getPhotos(article).length }) }}
            </span>
          </div>

          <div v-if="!imageOnly" class="px-1 pt-2.5">
            <div class="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <div class="flex min-w-0 items-center gap-2">
                <span class="size-5 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  {{ article.sourceTitle.charAt(0) || 'R' }}
                </span>
                <span class="truncate">{{ article.sourceTitle }}</span>
              </div>
              <span class="shrink-0 text-neutral-300 dark:text-neutral-600">·</span>
              <span class="shrink-0 tabular-nums">{{ formatTime(article.publishedAt) }}</span>
            </div>
          </div>
        </article>
      </div>
      <div v-if="!articles.length" class="py-12 text-center text-sm text-neutral-400">
        {{ t('reading.noPictures') }}
      </div>
    </div>
  </div>
</template>
