<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: Array<{ name: string, current: number, target: number }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Array<{ name: string, current: number, target: number }>]
}>()

const abilities = ref([...props.modelValue])

const defaults = [
  { name: '专业技能', current: 5, target: 8 },
  { name: '沟通表达', current: 5, target: 8 },
  { name: '领导管理', current: 3, target: 7 },
  { name: '商业思维', current: 4, target: 8 },
  { name: '人脉资源', current: 3, target: 7 },
  { name: '写作输出', current: 4, target: 8 },
]

if (!abilities.value.length)
  abilities.value = defaults.map(d => ({ ...d }))

watch(abilities, v => emit('update:modelValue', v.map(a => ({ ...a }))), { deep: true })

function addAbility() { abilities.value.push({ name: '', current: 3, target: 8 }) }
function removeAbility(i: number) { abilities.value.splice(i, 1) }
</script>

<template>
  <div class="flex items-start gap-8">
    <!-- 左侧：差距条形图 -->
    <div class="w-56 shrink-0 space-y-4">
      <div>
        <h3 class="text-base font-semibold">
          能力图谱
        </h3>
        <p class="text-xs text-muted-foreground mt-1">
          发现成长方向
        </p>
      </div>
      <div class="space-y-2.5">
        <div v-for="a in abilities" :key="a.name" class="space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="font-medium truncate">{{ a.name || '未命名' }}</span>
            <span class="text-muted-foreground shrink-0 ml-2">差距 {{ a.target - a.current }}</span>
          </div>
          <div class="relative h-3 bg-muted rounded-full overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-primary/30 rounded-full transition-all" :style="{ width: `${a.current * 10}%` }" />
            <div class="absolute top-0 left-0 h-full border border-dashed border-primary/50 rounded-full transition-all" :style="{ width: `${a.target * 10}%` }" />
            <div class="absolute top-0 h-full bg-destructive/8 transition-all" :style="{ left: `${a.current * 10}%`, width: `${(a.target - a.current) * 10}%` }" />
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：滑块编辑 -->
    <div class="flex-1 space-y-2">
      <div
        v-for="(a, i) in abilities"
        :key="i"
        class="flex items-center gap-3 rounded-lg border px-3 py-2"
      >
        <input
          v-model="a.name"
          class="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/50 min-w-0"
          placeholder="能力名称"
        >
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-muted-foreground w-6">当前</span>
          <input v-model.number="a.current" type="range" min="1" max="10" class="w-16 h-1 cursor-pointer">
          <span class="text-[10px] font-mono w-4 text-center">{{ a.current }}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-primary w-6">目标</span>
          <input v-model.number="a.target" type="range" min="1" max="10" class="w-16 h-1 cursor-pointer accent-primary">
          <span class="text-[10px] font-mono w-4 text-center text-primary">{{ a.target }}</span>
        </div>
        <button v-if="abilities.length > 1" class="text-muted-foreground hover:text-destructive text-xs shrink-0" @click="removeAbility(i)">
          ×
        </button>
      </div>
      <button class="w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors" @click="addAbility">
        + 添加能力维度
      </button>
    </div>
  </div>
</template>
