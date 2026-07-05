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

const editingIndex = ref<number | null>(null)

function toggleEdit(i: number) {
  editingIndex.value = editingIndex.value === i ? null : i
}

function addAbility() {
  abilities.value.push({ name: '', current: 3, target: 8 })
  editingIndex.value = abilities.value.length - 1
}

function removeAbility(i: number) {
  abilities.value.splice(i, 1)
  if (editingIndex.value === i)
    editingIndex.value = null
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        能力图谱
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        点击条目编辑，发现成长方向
      </p>
    </div>

    <!-- 差距图 -->
    <div class="w-full max-w-lg space-y-3">
      <div
        v-for="(a, i) in abilities"
        :key="i"
        class="rounded-xl border p-4 transition-all cursor-pointer"
        :class="editingIndex === i ? 'ring-1 ring-primary/30 shadow-sm' : 'hover:bg-muted/30'"
        @click="toggleEdit(i)"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ a.name || '未命名能力' }}</span>
            <button
              v-if="abilities.length > 1"
              class="text-muted-foreground hover:text-destructive text-xs opacity-0 group-hover:opacity-100"
              @click.stop="removeAbility(i)"
            >
              ×
            </button>
          </div>
          <span class="text-xs text-muted-foreground">
            当前 <span class="font-mono font-medium text-foreground">{{ a.current }}</span>
            → 目标 <span class="font-mono font-medium text-primary">{{ a.target }}</span>
            <span class="ml-1 text-destructive">差距 {{ a.target - a.current }}</span>
          </span>
        </div>

        <!-- 进度条 -->
        <div class="relative h-5 bg-muted rounded-full overflow-hidden">
          <div class="absolute top-0 left-0 h-full bg-primary/25 rounded-full transition-all" :style="{ width: `${a.current * 10}%` }" />
          <div class="absolute top-0 left-0 h-full border-2 border-dashed border-primary/40 rounded-full transition-all" :style="{ width: `${a.target * 10}%` }" />
          <div class="absolute top-0 h-full bg-destructive/6 transition-all" :style="{ left: `${a.current * 10}%`, width: `${(a.target - a.current) * 10}%` }" />
        </div>

        <!-- 展开编辑 -->
        <div v-if="editingIndex === i" class="mt-3 space-y-3" @click.stop>
          <div class="flex items-center gap-3">
            <label class="text-[10px] text-muted-foreground w-10 shrink-0">名称</label>
            <input v-model="a.name" class="flex-1 text-xs bg-transparent border-none outline-none" placeholder="能力名称">
          </div>
          <div class="flex items-center gap-3">
            <label class="text-[10px] text-muted-foreground w-10 shrink-0">当前</label>
            <input v-model.number="a.current" type="range" min="1" max="10" class="flex-1 h-1 cursor-pointer">
            <span class="text-xs font-mono w-4 text-center">{{ a.current }}</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-[10px] text-primary w-10 shrink-0">目标</label>
            <input v-model.number="a.target" type="range" min="1" max="10" class="flex-1 h-1 cursor-pointer accent-primary">
            <span class="text-xs font-mono w-4 text-center text-primary">{{ a.target }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加按钮 -->
    <button
      class="rounded-lg border border-dashed px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      @click="addAbility"
    >
      + 添加能力维度
    </button>
  </div>
</template>
