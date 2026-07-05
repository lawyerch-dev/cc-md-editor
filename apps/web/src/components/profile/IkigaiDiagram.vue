<script setup lang="ts">
import { ref } from 'vue'

interface IkigaiData {
  love: string[]
  goodAt: string[]
  worldNeeds: string[]
  paidFor: string[]
}

const props = defineProps<{
  modelValue: IkigaiData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: IkigaiData]
}>()

const activeSection = ref<keyof IkigaiData | null>(null)
const editInput = ref('')

const sectionInfo: Record<keyof IkigaiData, { label: string, icon: string, color: string }> = {
  love: { label: '你热爱什么', icon: '❤️', color: '#f472b6' },
  goodAt: { label: '你擅长什么', icon: '⚡', color: '#60a5fa' },
  worldNeeds: { label: '世界需要什么', icon: '🌍', color: '#34d399' },
  paidFor: { label: '能获得回报', icon: '💰', color: '#fbbf24' },
}

function selectSection(key: keyof IkigaiData) {
  if (activeSection.value === key) {
    activeSection.value = null
  }
  else {
    activeSection.value = key
    editInput.value = props.modelValue[key].join('、')
  }
}

function saveSection() {
  if (activeSection.value) {
    const items = editInput.value.split(/[、,，\n]+/).map(s => s.trim()).filter(Boolean)
    emit('update:modelValue', { ...props.modelValue, [activeSection.value]: items })
    activeSection.value = null
  }
}

// SVG 参数
const w = 520; const h = 420
const cx = w / 2; const cy = h / 2; const r = 145; const off = 55

const circles: Array<{ key: keyof IkigaiData, cx: number, cy: number, color: string }> = [
  { key: 'love', cx: cx - off, cy: cy - off, color: '#f472b6' },
  { key: 'goodAt', cx: cx + off, cy: cy - off, color: '#60a5fa' },
  { key: 'worldNeeds', cx: cx - off, cy: cy + off, color: '#34d399' },
  { key: 'paidFor', cx: cx + off, cy: cy + off, color: '#fbbf24' },
]

// 关键词在圆内的位置（每个圆的上/下/左/右区域）
const keywordPos: Record<keyof IkigaiData, { x: number, y: number, anchor: string }> = {
  love: { x: cx - off - 30, y: cy - off - 30, anchor: 'middle' },
  goodAt: { x: cx + off + 30, y: cy - off - 30, anchor: 'middle' },
  worldNeeds: { x: cx - off - 30, y: cy + off + 30, anchor: 'middle' },
  paidFor: { x: cx + off + 30, y: cy + off + 30, anchor: 'middle' },
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        Ikigai · 生命意义探索
      </h2>
      <p class="text-sm text-muted-foreground">
        点击圆圈，写下你的关键词
      </p>
    </div>

    <!-- 主图 -->
    <div class="relative">
      <svg :viewBox="`0 0 ${w} ${h}`" :width="w" :height="h">
        <!-- 四个圆 -->
        <g v-for="c in circles" :key="c.key">
          <circle
            :cx="c.cx" :cy="c.cy" :r="r"
            :fill="c.color"
            :fill-opacity="activeSection === c.key ? 0.25 : 0.12"
            :stroke="c.color"
            :stroke-width="activeSection === c.key ? 3 : 1.5"
            :stroke-opacity="activeSection === c.key ? 0.8 : 0.3"
            class="cursor-pointer transition-all"
            @click="selectSection(c.key)"
          />
        </g>

        <!-- 每个圆里的关键词 -->
        <g v-for="c in circles" :key="`${c.key}-kw`">
          <!-- 标签 -->
          <text
            :x="keywordPos[c.key].x"
            :y="keywordPos[c.key].y"
            :text-anchor="keywordPos[c.key].anchor"
            class="text-[10px] font-medium pointer-events-none"
            :fill="c.color"
            fill-opacity="0.8"
          >
            {{ sectionInfo[c.key].icon }} {{ sectionInfo[c.key].label }}
          </text>
          <!-- 关键词列表 -->
          <text
            v-for="(kw, i) in modelValue[c.key].slice(0, 4)"
            :key="kw"
            :x="keywordPos[c.key].x"
            :y="keywordPos[c.key].y + 16 + i * 15"
            :text-anchor="keywordPos[c.key].anchor"
            class="text-[11px] pointer-events-none"
            fill="currentColor"
            fill-opacity="0.7"
          >
            {{ kw }}
          </text>
          <text
            v-if="modelValue[c.key].length > 4"
            :x="keywordPos[c.key].x"
            :y="keywordPos[c.key].y + 16 + 4 * 15"
            :text-anchor="keywordPos[c.key].anchor"
            class="text-[9px] pointer-events-none"
            fill="currentColor"
            fill-opacity="0.4"
          >
            +{{ modelValue[c.key].length - 4 }} 更多
          </text>
        </g>

        <!-- 中心 -->
        <text :x="cx" :y="cy - 8" text-anchor="middle" class="text-base font-bold fill-foreground pointer-events-none">IKIGAI</text>
        <text :x="cx" :y="cy + 10" text-anchor="middle" class="text-[9px] fill-muted-foreground pointer-events-none">生き甲斐</text>
      </svg>
    </div>

    <!-- 编辑面板（点击圆圈后展开） -->
    <transition name="fade">
      <div
        v-if="activeSection"
        class="w-full max-w-md rounded-xl border bg-background shadow-lg p-4 space-y-3"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ sectionInfo[activeSection].icon }}</span>
          <span class="text-sm font-semibold" :style="{ color: circles.find(c => c.key === activeSection)?.color }">
            {{ sectionInfo[activeSection].label }}
          </span>
        </div>
        <textarea
          v-model="editInput"
          rows="3"
          class="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="输入关键词，用顿号分隔，例如：法律、科技、写作"
          @keydown.meta.enter="saveSection"
          @keydown.ctrl.enter="saveSection"
        />
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground">按 Enter 保存，Esc 取消</span>
          <div class="flex gap-2">
            <button class="text-xs text-muted-foreground hover:text-foreground px-3 py-1" @click="activeSection = null">
              取消
            </button>
            <button class="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90" @click="saveSection">
              保存
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
