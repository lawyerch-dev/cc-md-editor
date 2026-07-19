<!-- @workspace reading -->
<script setup lang="ts">
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  images: Array<{ url: string, width?: number, height?: number, type?: 'photo' | 'video' }>
  initialIndex?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const currentIndex = ref(props.initialIndex || 0)
const scale = ref(1)
const isDragging = ref(false)

const currentImage = computed(() => props.images[currentIndex.value])
const hasMultiple = computed(() => props.images.length > 1)

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    scale.value = 1
  }
}

function next() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    scale.value = 1
  }
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.5, 5)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.5, 0.5)
}

function resetZoom() {
  scale.value = 1
}

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowLeft': prev(); break
    case 'ArrowRight': next(); break
    case 'Escape': emit('close'); break
    case '+': case '=': zoomIn(); break
    case '-': zoomOut(); break
    case '0': resetZoom(); break
  }
}

// 拖拽关闭
let dragStartY = 0
let dragOffsetY = 0
const dragOpacity = ref(1)

function handleDragStart(e: MouseEvent | TouchEvent) {
  if (scale.value > 1)
    return
  isDragging.value = true
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  dragStartY = clientY
}

function handleDragMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value)
    return
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  dragOffsetY = clientY - dragStartY
  dragOpacity.value = Math.max(0.3, 1 - Math.abs(dragOffsetY) / 400)
}

function handleDragEnd() {
  if (!isDragging.value)
    return
  isDragging.value = false
  if (Math.abs(dragOffsetY) > 120) {
    emit('close')
  }
  dragOffsetY = 0
  dragOpacity.value = 1
}

// 鼠标滚轮缩放
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.deltaY < 0)
    zoomIn()
  else zoomOut()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    :style="{ opacity: dragOpacity }"
    @click.self.stop="emit('close')"
    @mousedown.stop="handleDragStart"
    @mousemove.stop="handleDragMove"
    @mouseup.stop="handleDragEnd"
    @mouseleave.stop="handleDragEnd"
    @touchstart.stop="handleDragStart"
    @touchmove.stop="handleDragMove"
    @touchend.stop="handleDragEnd"
    @wheel.stop.prevent="handleWheel"
  >
    <!-- 背景遮罩 -->
    <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" @click.stop="emit('close')" />

    <!-- 顶部工具栏 -->
    <div class="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
      <span class="text-sm text-white/70 tabular-nums">
        {{ currentIndex + 1 }} / {{ images.length }}
      </span>
      <div class="flex items-center gap-2">
        <button
          class="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="缩小 (-)"
          @click.stop="zoomOut"
        >
          <ZoomOut class="h-5 w-5" />
        </button>
        <button
          class="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="放大 (+)"
          @click.stop="zoomIn"
        >
          <ZoomIn class="h-5 w-5" />
        </button>
        <a
          v-if="currentImage"
          :href="currentImage.url"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="在新标签页打开"
          @click.stop
        >
          <ExternalLink class="h-5 w-5" />
        </a>
        <button
          class="rounded-full p-2 text-white/70 hover:text-red-400 hover:bg-white/10 transition-colors"
          title="关闭 (Esc)"
          @click.stop="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- 图片/视频 -->
    <div class="relative z-10 flex items-center justify-center w-full h-full px-16 py-12">
      <video
        v-if="currentImage?.type === 'video'"
        :key="currentImage.url"
        :src="currentImage.url"
        controls
        autoplay
        class="max-w-full max-h-full object-contain"
      />
      <img
        v-else-if="currentImage"
        :key="currentImage.url"
        :src="currentImage.url"
        :style="{ transform: `scale(${scale})`, transformOrigin: 'center center' }"
        class="max-w-full max-h-full object-contain select-none transition-transform duration-200"
        :class="isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'"
        draggable="false"
        alt=""
        @dblclick="scale > 1 ? resetZoom() : zoomIn()"
      >
    </div>

    <!-- 左右箭头 -->
    <button
      v-if="hasMultiple && currentIndex > 0"
      class="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
      @click.stop="prev"
    >
      <ChevronLeft class="h-6 w-6" />
    </button>
    <button
      v-if="hasMultiple && currentIndex < images.length - 1"
      class="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
      @click.stop="next"
    >
      <ChevronRight class="h-6 w-6" />
    </button>

    <!-- 底部缩略图条 -->
    <div
      v-if="hasMultiple && images.length <= 30"
      class="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 max-w-[80vw] overflow-x-auto px-2 py-1 rounded-lg bg-black/40 backdrop-blur"
    >
      <button
        v-for="(img, i) in images"
        :key="img.url + i"
        class="shrink-0 size-10 rounded overflow-hidden border-2 transition-colors"
        :class="i === currentIndex ? 'border-orange-500' : 'border-transparent hover:border-white/40'"
        @click.stop="currentIndex = i; scale = 1"
      >
        <img :src="img.url" class="w-full h-full object-cover" alt="">
      </button>
    </div>
  </div>
</template>
