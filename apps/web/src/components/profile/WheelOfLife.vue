<!-- @workspace profile -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: Record<string, number>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, number>]
}>()

const dimensions = [
  { key: 'career', label: '职业发展', icon: '💼', color: '#3b82f6' },
  { key: 'finance', label: '财务状况', icon: '💰', color: '#eab308' },
  { key: 'health', label: '健康体能', icon: '🏃', color: '#22c55e' },
  { key: 'relationships', label: '人际关系', icon: '🤝', color: '#ec4899' },
  { key: 'learning', label: '学习成长', icon: '📚', color: '#8b5cf6' },
  { key: 'recreation', label: '休闲娱乐', icon: '🎮', color: '#f97316' },
  { key: 'spirituality', label: '精神内在', icon: '🧘', color: '#06b6d4' },
  { key: 'community', label: '社会贡献', icon: '🌍', color: '#84cc16' },
]

const scores = ref<Record<string, number>>({ ...props.modelValue })

// 初始化默认分数
dimensions.forEach((d) => {
  if (scores.value[d.key] === undefined)
    scores.value[d.key] = 5
})

watch(scores, v => emit('update:modelValue', { ...v }), { deep: true })

// SVG 雷达图计算
const cx = 200; const cy = 200; const maxR = 155

function getPoint(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2
  const r = (value / 10) * maxR
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function getAxisPoint(index: number) {
  const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2
  return {
    x: cx + maxR * Math.cos(angle),
    y: cy + maxR * Math.sin(angle),
    labelX: cx + (maxR + 20) * Math.cos(angle),
    labelY: cy + (maxR + 20) * Math.sin(angle),
  }
}

function polygonPoints() {
  return dimensions.map((d, i) => {
    const p = getPoint(i, scores.value[d.key] || 0)
    return `${p.x},${p.y}`
  }).join(' ')
}

const gridLevels = [2, 4, 6, 8, 10]

function average() {
  const vals = dimensions.map(d => scores.value[d.key] || 0)
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        生命之轮
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        评估你对生活各维度的满意度（1-10），发现需要关注的领域
      </p>
    </div>

    <div class="flex items-center gap-12">
      <!-- 雷达图 -->
      <svg viewBox="-20 -20 440 440" class="w-[420px] h-[420px] shrink-0">
        <!-- 网格线 -->
        <polygon
          v-for="level in gridLevels"
          :key="level"
          :points="dimensions.map((_, i) => { const p = getPoint(i, level); return `${p.x},${p.y}` }).join(' ')"
          fill="none"
          stroke="currentColor"
          stroke-width="0.5"
          class="text-border"
          :stroke-opacity="0.3"
        />

        <!-- 轴线 -->
        <line
          v-for="(d, i) in dimensions"
          :key="`${d.key}-axis`"
          :x1="cx" :y1="cy"
          :x2="getAxisPoint(i).x" :y2="getAxisPoint(i).y"
          stroke="currentColor"
          stroke-width="0.5"
          class="text-border"
          stroke-opacity="0.3"
        />

        <!-- 数据多边形 -->
        <polygon
          :points="polygonPoints()"
          fill="hsl(var(--primary))"
          fill-opacity="0.15"
          stroke="hsl(var(--primary))"
          stroke-width="2"
        />

        <!-- 数据点 -->
        <circle
          v-for="(d, i) in dimensions"
          :key="`${d.key}-dot`"
          :cx="getPoint(i, scores[d.key] || 0).x"
          :cy="getPoint(i, scores[d.key] || 0).y"
          r="4"
          :fill="d.color"
          stroke="white"
          stroke-width="2"
          class="cursor-pointer"
        />

        <!-- 标签 -->
        <text
          v-for="(d, i) in dimensions"
          :key="`${d.key}-label`"
          :x="getAxisPoint(i).labelX"
          :y="getAxisPoint(i).labelY"
          text-anchor="middle"
          dominant-baseline="middle"
          class="text-[10px] fill-muted-foreground"
        >
          {{ d.icon }} {{ d.label }}
        </text>

        <!-- 中心分数 -->
        <text :x="cx" :y="cy" text-anchor="middle" dominant-baseline="middle" class="text-lg font-bold fill-foreground">
          {{ average() }}
        </text>
      </svg>

      <!-- 滑块控制 -->
      <div class="space-y-3 flex-1 min-w-0">
        <div
          v-for="d in dimensions"
          :key="d.key"
          class="flex items-center gap-3"
        >
          <span class="text-sm w-20 shrink-0 flex items-center gap-1">
            <span class="text-base">{{ d.icon }}</span>
            <span class="text-xs">{{ d.label }}</span>
          </span>
          <input
            v-model.number="scores[d.key]"
            type="range"
            min="1" max="10" step="1"
            class="flex-1 h-1.5 accent-current cursor-pointer"
            :style="{ accentColor: d.color }"
          >
          <span class="w-6 text-center text-sm font-mono font-medium" :style="{ color: d.color }">
            {{ scores[d.key] }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
