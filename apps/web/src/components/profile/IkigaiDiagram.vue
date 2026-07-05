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

const editing = ref<keyof IkigaiData | null>(null)
const editInput = ref('')

const sections: Array<{ key: keyof IkigaiData, label: string, icon: string, color: string }> = [
  { key: 'love', label: '热爱', icon: '❤️', color: '#f472b6' },
  { key: 'goodAt', label: '擅长', icon: '⚡', color: '#60a5fa' },
  { key: 'worldNeeds', label: '世界需要', icon: '🌍', color: '#34d399' },
  { key: 'paidFor', label: '能获得回报', icon: '💰', color: '#fbbf24' },
]

function startEdit(key: keyof IkigaiData) {
  editing.value = key
  editInput.value = props.modelValue[key].join('、')
}

function finishEdit() {
  if (editing.value) {
    const items = editInput.value.split(/[、,，\n]+/).map(s => s.trim()).filter(Boolean)
    emit('update:modelValue', { ...props.modelValue, [editing.value]: items })
    editing.value = null
  }
}

// SVG 计算
const size = 260
const cx = size / 2; const cy = size / 2; const r = 85; const offset = 42

const circles = [
  { key: 'love' as const, cx: cx - offset, cy: cy - offset, color: '#f472b6' },
  { key: 'goodAt' as const, cx: cx + offset, cy: cy - offset, color: '#60a5fa' },
  { key: 'worldNeeds' as const, cx: cx - offset, cy: cy + offset, color: '#34d399' },
  { key: 'paidFor' as const, cx: cx + offset, cy: cy + offset, color: '#fbbf24' },
]
</script>

<template>
  <div class="flex items-start gap-8">
    <!-- 左侧：SVG 图 -->
    <div class="shrink-0">
      <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" class="rounded-xl bg-muted/20">
        <circle
          v-for="c in circles"
          :key="c.key"
          :cx="c.cx" :cy="c.cy" :r="r"
          :fill="c.color" fill-opacity="0.15"
          :stroke="c.color" stroke-width="1.5" stroke-opacity="0.4"
          class="cursor-pointer transition-all hover:fill-opacity-25"
          @click="startEdit(c.key)"
        />
        <text :x="cx" :y="cy - 6" text-anchor="middle" class="text-[11px] font-bold fill-foreground pointer-events-none">IKIGAI</text>
        <text :x="cx" :y="cy + 10" text-anchor="middle" class="text-[8px] fill-muted-foreground pointer-events-none">生命意义</text>
      </svg>
    </div>

    <!-- 右侧：编辑面板 -->
    <div class="flex-1 space-y-3 min-w-0">
      <h3 class="text-base font-semibold">
        在四个圆中各写下关键词
      </h3>
      <p class="text-xs text-muted-foreground mb-4">
        用顿号分隔，找到你的核心定位
      </p>

      <div
        v-for="s in sections"
        :key="s.key"
        class="rounded-lg border p-3 transition-all"
        :class="editing === s.key ? 'ring-1 shadow-sm' : ''"
        :style="editing === s.key ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}40` } : {}"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="text-base">{{ s.icon }}</span>
          <span class="text-sm font-medium" :style="{ color: s.color }">{{ s.label }}</span>
        </div>

        <div v-if="editing === s.key">
          <textarea
            v-model="editInput"
            rows="2"
            class="w-full rounded border bg-background px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1"
            :style="{ '--tw-ring-color': s.color }"
            placeholder="输入关键词，用顿号分隔"
            @keydown.enter.prevent="finishEdit"
            @blur="finishEdit"
          />
        </div>
        <div v-else class="flex flex-wrap gap-1.5 min-h-[24px]">
          <span
            v-for="(item, i) in modelValue[s.key]"
            :key="i"
            class="rounded-full px-2 py-0.5 text-[11px] font-medium cursor-pointer hover:opacity-80"
            :style="{ backgroundColor: `${s.color}18`, color: s.color }"
            @click="startEdit(s.key)"
          >
            {{ item }}
          </span>
          <button
            v-if="!modelValue[s.key].length"
            class="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            @click="startEdit(s.key)"
          >
            + 添加关键词
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
