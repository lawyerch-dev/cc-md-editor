<script setup lang="ts">
import { computed, ref } from 'vue'

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

const sections: Array<{ key: keyof IkigaiData, label: string, color: string, cx: number, cy: number }> = [
  { key: 'love', label: '热爱', color: '#f472b6', cx: 200, cy: 150 },
  { key: 'goodAt', label: '擅长', color: '#60a5fa', cx: 340, cy: 150 },
  { key: 'worldNeeds', label: '世界需要', color: '#34d399', cx: 200, cy: 290 },
  { key: 'paidFor', label: '能获得回报', color: '#fbbf24', cx: 340, cy: 290 },
]

const intersections = computed(() => {
  const d = props.modelValue
  return {
    passion: [...d.love, ...d.goodAt].length ? '喜悦' : '',
    mission: [...d.love, ...d.worldNeeds].length ? '使命' : '',
    profession: [...d.goodAt, ...d.paidFor].length ? '专业' : '',
    vocation: [...d.worldNeeds, ...d.paidFor].length ? '事业' : '',
    ikigai: d.love.length && d.goodAt.length && d.worldNeeds.length && d.paidFor.length ? '生き甲斐' : '',
  }
})

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

function addItem(key: keyof IkigaiData) {
  editing.value = key
  editInput.value = props.modelValue[key].join('、')
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <h2 class="text-xl font-bold">
      Ikigai · 生命意义探索
    </h2>
    <p class="text-sm text-muted-foreground max-w-md text-center">
      在四个圆中各写下 3-5 个关键词，找到你的核心定位
    </p>

    <div class="relative">
      <svg viewBox="0 0 540 440" class="w-[540px] h-[440px]">
        <!-- 四个圆 -->
        <circle
          v-for="s in sections"
          :key="s.key"
          :cx="s.cx"
          :cy="s.cy"
          r="130"
          :fill="s.color"
          fill-opacity="0.15"
          :stroke="s.color"
          stroke-width="2"
          stroke-opacity="0.4"
          class="cursor-pointer transition-all hover:fill-opacity-25"
          @click="startEdit(s.key)"
        />

        <!-- 交叉区域标签 -->
        <text x="270" y="140" text-anchor="middle" class="fill-pink-400 text-xs font-medium pointer-events-none">
          {{ intersections.passion }}
        </text>
        <text x="165" y="220" text-anchor="middle" class="fill-emerald-500 text-xs font-medium pointer-events-none">
          {{ intersections.mission }}
        </text>
        <text x="375" y="220" text-anchor="middle" class="fill-blue-400 text-xs font-medium pointer-events-none">
          {{ intersections.profession }}
        </text>
        <text x="270" y="300" text-anchor="middle" class="fill-amber-500 text-xs font-medium pointer-events-none">
          {{ intersections.vocation }}
        </text>
        <text x="270" y="220" text-anchor="middle" class="fill-foreground text-sm font-bold pointer-events-none">
          {{ intersections.ikigai || 'IKIGAI' }}
        </text>
      </svg>
    </div>

    <!-- 编辑区域 -->
    <div class="w-full max-w-lg space-y-3">
      <div
        v-for="s in sections"
        :key="s.key"
        class="rounded-lg border p-3 transition-colors"
        :class="editing === s.key ? 'ring-2' : ''"
        :style="editing === s.key ? { '--tw-ring-color': s.color } : {}"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: s.color }" />
            {{ s.label }}
          </span>
          <button
            class="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            @click="startEdit(s.key)"
          >
            编辑
          </button>
        </div>
        <div v-if="editing === s.key">
          <textarea
            v-model="editInput"
            rows="2"
            class="w-full rounded border bg-background px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1"
            placeholder="输入关键词，用顿号分隔"
            @keydown.enter.prevent="finishEdit"
            @blur="finishEdit"
          />
        </div>
        <div v-else class="flex flex-wrap gap-1.5">
          <span
            v-for="(item, i) in modelValue[s.key]"
            :key="i"
            class="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            :style="{ backgroundColor: `${s.color}20`, color: s.color }"
          >
            {{ item }}
          </span>
          <button
            v-if="!modelValue[s.key].length"
            class="text-[11px] text-muted-foreground hover:text-foreground"
            @click="addItem(s.key)"
          >
            + 添加关键词
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
