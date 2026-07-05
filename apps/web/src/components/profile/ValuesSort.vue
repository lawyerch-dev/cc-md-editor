<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const allValues = [
  { label: '创新', icon: '💡', desc: '创造新事物、探索未知' },
  { label: '稳定', icon: '🏠', desc: '安全感、可预测性' },
  { label: '自由', icon: '🕊️', desc: '自主决定、不受约束' },
  { label: '影响力', icon: '📢', desc: '改变世界、影响他人' },
  { label: '成长', icon: '🌱', desc: '不断学习、自我提升' },
  { label: '财富', icon: '💎', desc: '财务自由、物质丰裕' },
  { label: '健康', icon: '❤️', desc: '身心平衡、活力充沛' },
  { label: '家庭', icon: '👨‍👩‍👧', desc: '家人陪伴、亲情温暖' },
  { label: '友谊', icon: '🤝', desc: '真诚交往、互相支持' },
  { label: '成就', icon: '🏆', desc: '达成目标、获得认可' },
  { label: '公正', icon: '⚖️', desc: '公平正义、维护权益' },
  { label: '创造', icon: '🎨', desc: '艺术表达、美感追求' },
  { label: '知识', icon: '📖', desc: '求真探索、深度理解' },
  { label: '服务', icon: '🙏', desc: '帮助他人、回馈社会' },
  { label: '冒险', icon: '🧗', desc: '挑战极限、突破舒适区' },
  { label: '独立', icon: '🦅', desc: '自力更生、不依赖他人' },
  { label: '真实', icon: '🪞', desc: '诚实面对自己和他人' },
  { label: '智慧', icon: '🦉', desc: '洞察本质、明智决策' },
  { label: '乐趣', icon: '🎉', desc: '享受生活、保持好奇心' },
  { label: '传承', icon: '🔗', desc: '留下遗产、培养后人' },
]

const selected = ref<string[]>([...props.modelValue])

watch(selected, v => emit('update:modelValue', [...v]), { deep: true })

function toggleValue(label: string) {
  const idx = selected.value.indexOf(label)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  }
  else if (selected.value.length < 5) {
    selected.value.push(label)
  }
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
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        价值观排序
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        选出对你最重要的 <strong>5 个</strong>价值观（点击选择/取消）
      </p>
    </div>

    <!-- 已选 Top 5 -->
    <div v-if="selected.length" class="flex items-center gap-2 flex-wrap justify-center">
      <span class="text-xs text-muted-foreground">你的 Top 5：</span>
      <span
        v-for="(val, i) in selected"
        :key="val"
        class="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium"
      >
        <span class="font-bold text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">{{ i + 1 }}</span>
        {{ val }}
      </span>
    </div>

    <!-- 价值观卡片网格 -->
    <div class="grid grid-cols-4 gap-3 max-w-2xl">
      <button
        v-for="v in allValues"
        :key="v.label"
        class="group flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all cursor-pointer"
        :class="isSelected(v.label)
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30 hover:bg-muted/50'"
        :disabled="!isSelected(v.label) && selected.length >= 5"
        @click="toggleValue(v.label)"
      >
        <div class="relative">
          <span class="text-2xl">{{ v.icon }}</span>
          <span
            v-if="getRank(v.label)"
            class="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          >
            {{ getRank(v.label) }}
          </span>
        </div>
        <span class="text-xs font-medium" :class="isSelected(v.label) ? 'text-primary' : 'text-foreground'">
          {{ v.label }}
        </span>
        <span class="text-[10px] text-muted-foreground text-center leading-tight">
          {{ v.desc }}
        </span>
      </button>
    </div>
  </div>
</template>
