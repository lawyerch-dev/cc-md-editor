<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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

const items = computed(() => {
  return props.articles
    .filter(article => article.media.some(m => m.type === 'photo'))
    .map((article) => {
      const photos = article.media.filter(m => m.type === 'photo')
      const cover = photos[0]!
      return {
        article,
        photos,
        imageUrl: cover.url,
        width: cover.width || 400,
        height: cover.height || 300,
      }
    })
})

const containerRef = ref<HTMLElement | null>(null)
const columns = ref(3)
const gutter = 14
const maxContentWidth = 1160

function updateColumns() {
  if (!containerRef.value)
    return
  const width = Math.min(containerRef.value.clientWidth, maxContentWidth)
  if (width >= 1120)
    columns.value = 5
  else if (width >= 900)
    columns.value = 4
  else if (width >= 680)
    columns.value = 3
  else if (width >= 460)
    columns.value = 2
  else columns.value = 1
}

let ro: ResizeObserver | null = null
onMounted(() => {
  updateColumns()
  ro = new ResizeObserver(updateColumns)
  if (containerRef.value)
    ro.observe(containerRef.value)
})
onUnmounted(() => ro?.disconnect())

const columnArrays = computed(() => {
  const cols: typeof items.value[] = Array.from({ length: columns.value }, () => [])
  const heights = new Array(columns.value).fill(0)
  const containerWidth = Math.min(containerRef.value?.clientWidth ?? maxContentWidth, maxContentWidth)
  const colWidth = containerWidth > 0
    ? (containerWidth - gutter * Math.max(columns.value - 1, 0)) / columns.value
    : 220

  for (const item of items.value) {
    const minIdx = heights.indexOf(Math.min(...heights))
    cols[minIdx].push(item)
    heights[minIdx] += colWidth / (item.width / item.height) + (props.imageOnly ? 0 : 60) + gutter
  }
  return cols
})

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

function handleImageClick(item: typeof items.value[number], e: Event) {
  e.stopPropagation()
  emit('preview', item.photos.map(photo => ({ url: photo.url, width: photo.width, height: photo.height })), 0)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div ref="containerRef" class="flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <div class="mx-auto max-w-[1160px]">
        <div class="flex items-start" :style="{ gap: `${gutter}px` }">
          <div
            v-for="(col, colIdx) in columnArrays"
            :key="colIdx"
            class="flex min-w-0 flex-1 flex-col"
            :style="{ gap: `${gutter}px` }"
          >
            <article
              v-for="item in col"
              :key="item.article.id"
              class="group"
              @click="emit('select', item.article.id)"
            >
              <div
                class="relative overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
                :class="activeId === item.article.id ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950' : ''"
              >
                <img
                  :src="item.imageUrl"
                  :width="item.width"
                  :height="item.height"
                  class="block w-full rounded-2xl transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  alt=""
                  @click="handleImageClick(item, $event)"
                >
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/68 via-black/10 to-transparent opacity-95" />
                <div class="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white">
                  <p class="line-clamp-2 text-[13px] font-semibold leading-5 drop-shadow-sm">
                    {{ item.article.title || t('reading.untitled') }}
                  </p>
                  <p v-if="!imageOnly" class="mt-1 truncate text-[11px] text-white/72">
                    {{ item.article.sourceTitle }}
                  </p>
                </div>
                <span
                  v-if="!item.article.read"
                  class="absolute right-3 top-3 size-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(255,255,255,0.2)]"
                />
                <span
                  v-if="item.photos.length > 1"
                  class="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
                >
                  {{ t('reading.imageCount', { count: item.photos.length }) }}
                </span>
              </div>

              <div v-if="!imageOnly" class="px-1 pt-2.5">
                <div class="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="size-5 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                      {{ item.article.sourceTitle.charAt(0) || 'R' }}
                    </span>
                    <span class="truncate">{{ item.article.sourceTitle }}</span>
                  </div>
                  <span class="shrink-0 text-neutral-300 dark:text-neutral-600">·</span>
                  <span class="shrink-0 tabular-nums">{{ formatTime(item.article.publishedAt) }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
