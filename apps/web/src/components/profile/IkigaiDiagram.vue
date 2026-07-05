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

// SVG
const size = 320
const cx = size / 2; const cy = size / 2; const r = 110; const off = 45

const circles = [
  { key: 'love' as const, cx: cx - off, cy: cy - off, color: '#f472b6' },
  { key: 'goodAt' as const, cx: cx + off, cy: cy - off, color: '#60a5fa' },
  { key: 'worldNeeds' as const, cx: cx - off, cy: cy + off, color: '#34d399' },
  { key: 'paidFor' as const, cx: cx + off, cy: cy + off, color: '#fbbf24' },
]
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        Ikigai · 生命意义探索
      </h2>
      <p class="text-sm text-muted-foreground">
        在四个角填写关键词，找到你的核心定位
      </p>
    </div>

    <!-- 四角布局 -->
    <div class="relative" style="width: 720px; height: 440px;">
      <!-- 左上：热爱 -->
      <div class="absolute top-0 left-0 w-48 space-y-2">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-base">❤️</span>
          <span class="text-sm font-semibold" style="color: #f472b6;">热爱</span>
        </div>
        <div v-if="editing === 'love'">
          <textarea v-model="editInput" rows="3" class="w-full rounded-lg border bg-background px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2" style="--tw-ring-color: #f472b640;" placeholder="用顿号分隔" autofocus @blur="finishEdit" @keydown.enter.prevent="finishEdit" />
        </div>
        <div v-else class="min-h-[72px] rounded-lg border border-dashed p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" @click="startEdit('love')">
          <div v-if="modelValue.love.length" class="flex flex-wrap gap-1">
            <span v-for="kw in modelValue.love" :key="kw" class="rounded-full px-2 py-0.5 text-[10px] font-medium" style="background: #f472b618; color: #f472b6;">{{ kw }}</span>
          </div>
          <span v-else class="text-[11px] text-muted-foreground/50">点击添加关键词...</span>
        </div>
      </div>

      <!-- 右上：擅长 -->
      <div class="absolute top-0 right-0 w-48 space-y-2">
        <div class="flex items-center gap-1.5 mb-1 justify-end">
          <span class="text-sm font-semibold" style="color: #60a5fa;">擅长</span>
          <span class="text-base">⚡</span>
        </div>
        <div v-if="editing === 'goodAt'">
          <textarea v-model="editInput" rows="3" class="w-full rounded-lg border bg-background px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2" style="--tw-ring-color: #60a5fa40;" placeholder="用顿号分隔" autofocus @blur="finishEdit" @keydown.enter.prevent="finishEdit" />
        </div>
        <div v-else class="min-h-[72px] rounded-lg border border-dashed p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" @click="startEdit('goodAt')">
          <div v-if="modelValue.goodAt.length" class="flex flex-wrap gap-1 justify-end">
            <span v-for="kw in modelValue.goodAt" :key="kw" class="rounded-full px-2 py-0.5 text-[10px] font-medium" style="background: #60a5fa18; color: #60a5fa;">{{ kw }}</span>
          </div>
          <span v-else class="text-[11px] text-muted-foreground/50">点击添加关键词...</span>
        </div>
      </div>

      <!-- 中央：Ikigai 图 -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" class="pointer-events-none">
          <!-- 非激活的圆 -->
          <circle
            v-for="c in circles.filter(c => c.key !== editing)"
            :key="c.key"
            :cx="c.cx" :cy="c.cy" :r="r"
            :fill="c.color" fill-opacity="0.1"
            :stroke="c.color" stroke-width="1" stroke-opacity="0.25"
            class="cursor-pointer transition-all hover:fill-opacity-20 pointer-events-auto"
            @click="startEdit(c.key)"
          />
          <!-- 激活的圆（最上层，高亮） -->
          <circle
            v-if="editing"
            :key="`${editing}-active`"
            :cx="circles.find(c => c.key === editing)!.cx"
            :cy="circles.find(c => c.key === editing)!.cy"
            :r="r"
            :fill="circles.find(c => c.key === editing)!.color"
            fill-opacity="0.25"
            :stroke="circles.find(c => c.key === editing)!.color"
            stroke-width="3"
            stroke-opacity="0.7"
            class="cursor-pointer pointer-events-auto"
            @click="startEdit(editing!)"
          />
          <text :x="cx" :y="cy - 6" text-anchor="middle" class="text-sm font-bold fill-foreground pointer-events-none">IKIGAI</text>
          <text :x="cx" :y="cy + 10" text-anchor="middle" class="text-[8px] fill-muted-foreground pointer-events-none">生き甲斐</text>
        </svg>
      </div>

      <!-- 左下：世界需要 -->
      <div class="absolute bottom-0 left-0 w-48 space-y-2">
        <div v-if="editing === 'worldNeeds'">
          <textarea v-model="editInput" rows="3" class="w-full rounded-lg border bg-background px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2" style="--tw-ring-color: #34d39940;" placeholder="用顿号分隔" autofocus @blur="finishEdit" @keydown.enter.prevent="finishEdit" />
        </div>
        <div v-else class="min-h-[72px] rounded-lg border border-dashed p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" @click="startEdit('worldNeeds')">
          <div v-if="modelValue.worldNeeds.length" class="flex flex-wrap gap-1">
            <span v-for="kw in modelValue.worldNeeds" :key="kw" class="rounded-full px-2 py-0.5 text-[10px] font-medium" style="background: #34d39918; color: #34d399;">{{ kw }}</span>
          </div>
          <span v-else class="text-[11px] text-muted-foreground/50">点击添加关键词...</span>
        </div>
        <div class="flex items-center gap-1.5 mt-1">
          <span class="text-base">🌍</span>
          <span class="text-sm font-semibold" style="color: #34d399;">世界需要</span>
        </div>
      </div>

      <!-- 右下：能获得回报 -->
      <div class="absolute bottom-0 right-0 w-48 space-y-2">
        <div v-if="editing === 'paidFor'">
          <textarea v-model="editInput" rows="3" class="w-full rounded-lg border bg-background px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2" style="--tw-ring-color: #fbbf2440;" placeholder="用顿号分隔" autofocus @blur="finishEdit" @keydown.enter.prevent="finishEdit" />
        </div>
        <div v-else class="min-h-[72px] rounded-lg border border-dashed p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" @click="startEdit('paidFor')">
          <div v-if="modelValue.paidFor.length" class="flex flex-wrap gap-1 justify-end">
            <span v-for="kw in modelValue.paidFor" :key="kw" class="rounded-full px-2 py-0.5 text-[10px] font-medium" style="background: #fbbf2418; color: #fbbf24;">{{ kw }}</span>
          </div>
          <span v-else class="text-[11px] text-muted-foreground/50">点击添加关键词...</span>
        </div>
        <div class="flex items-center gap-1.5 mt-1 justify-end">
          <span class="text-sm font-semibold" style="color: #fbbf24;">能获得回报</span>
          <span class="text-base">💰</span>
        </div>
      </div>
    </div>
  </div>
</template>
