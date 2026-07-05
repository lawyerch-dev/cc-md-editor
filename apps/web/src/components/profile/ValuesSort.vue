<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const allValues = [
  { label: '创新', icon: '💡', desc: '创造新事物' },
  { label: '稳定', icon: '🏠', desc: '安全感' },
  { label: '自由', icon: '🕊️', desc: '自主决定' },
  { label: '影响力', icon: '📢', desc: '改变世界' },
  { label: '成长', icon: '🌱', desc: '自我提升' },
  { label: '财富', icon: '💎', desc: '财务自由' },
  { label: '健康', icon: '❤️', desc: '身心平衡' },
  { label: '家庭', icon: '👨‍👩‍👧', desc: '家人陪伴' },
  { label: '友谊', icon: '🤝', desc: '真诚交往' },
  { label: '成就', icon: '🏆', desc: '达成目标' },
  { label: '公正', icon: '⚖️', desc: '公平正义' },
  { label: '创造', icon: '🎨', desc: '艺术表达' },
  { label: '知识', icon: '📖', desc: '深度理解' },
  { label: '服务', icon: '🙏', desc: '帮助他人' },
  { label: '冒险', icon: '🧗', desc: '突破舒适区' },
  { label: '独立', icon: '🦅', desc: '自力更生' },
  { label: '真实', icon: '🪞', desc: '诚实面对' },
  { label: '智慧', icon: '🦉', desc: '洞察本质' },
  { label: '乐趣', icon: '🎉', desc: '享受生活' },
  { label: '传承', icon: '🔗', desc: '留下遗产' },
]

const selected = ref<string[]>([...props.modelValue])

watch(selected, v => emit('update:modelValue', [...v]), { deep: true })

function toggleValue(label: string) {
  const idx = selected.value.indexOf(label)
  if (idx >= 0)
    selected.value.splice(idx, 1)
  else if (selected.value.length < 5)
    selected.value.push(label)
}

function isSelected(label: string) {
  return selected.value.includes(label)
}

function getRank(label: string) {
  const idx = selected.value.indexOf(label)
  return idx >= 0 ? idx + 1 : null
}
</script>

<template>
  <div class="flex items-start gap-8">
    <!-- 左侧：已选 Top 5 -->
    <div class="w-48 shrink-0 space-y-4">
      <div>
        <h3 class="text-base font-semibold">
          价值观排序
        </h3>
        <p class="text-xs text-muted-foreground mt-1">
          选出最重要的 5 个
        </p>
      </div>
      <div class="space-y-2">
        <div
          v-for="(val, i) in selected"
          :key="val"
          class="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2"
        >
          <span class="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {{ i + 1 }}
          </span>
          <span class="text-sm font-medium text-primary">{{ val }}</span>
        </div>
        <div
          v-for="n in (5 - selected.length)"
          :key="`empty-${n}`"
          class="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-muted-foreground/40"
        >
          <span class="bg-muted text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {{ selected.length + n }}
          </span>
          <span class="text-sm">待选择...</span>
        </div>
      </div>
    </div>

    <!-- 右侧：卡片网格 -->
    <div class="flex-1 grid grid-cols-5 gap-2">
      <button
        v-for="v in allValues"
        :key="v.label"
        class="group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-all cursor-pointer text-center"
        :class="isSelected(v.label)
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30 hover:bg-muted/50'"
        :disabled="!isSelected(v.label) && selected.length >= 5"
        @click="toggleValue(v.label)"
      >
        <div class="relative">
          <span class="text-lg">{{ v.icon }}</span>
          <span
            v-if="getRank(v.label)"
            class="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"
          >
            {{ getRank(v.label) }}
          </span>
        </div>
        <span class="text-[11px] font-medium leading-tight" :class="isSelected(v.label) ? 'text-primary' : ''">
          {{ v.label }}
        </span>
        <span class="text-[9px] text-muted-foreground leading-tight">{{ v.desc }}</span>
      </button>
    </div>
  </div>
</template>
