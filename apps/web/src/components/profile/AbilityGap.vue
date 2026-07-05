<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: Array<{ name: string, current: number, target: number }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Array<{ name: string, current: number, target: number }>]
}>()

const abilities = ref([...props.modelValue])

// 默认能力维度
const defaults = [
  { name: '专业技能', current: 5, target: 8 },
  { name: '沟通表达', current: 5, target: 8 },
  { name: '领导管理', current: 3, target: 7 },
  { name: '商业思维', current: 4, target: 8 },
  { name: '人脉资源', current: 3, target: 7 },
  { name: '写作输出', current: 4, target: 8 },
]

if (!abilities.value.length) {
  abilities.value = defaults.map(d => ({ ...d }))
}

watch(abilities, v => emit('update:modelValue', v.map(a => ({ ...a }))), { deep: true })

function addAbility() {
  abilities.value.push({ name: '', current: 3, target: 8 })
}

function removeAbility(index: number) {
  abilities.value.splice(index, 1)
}

function updateName(index: number, name: string) {
  abilities.value[index].name = name
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        能力图谱
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        评估你在关键能力上的<strong>当前水平</strong>和<strong>目标水平</strong>，发现成长方向
      </p>
    </div>

    <div class="w-full max-w-xl space-y-4">
      <div
        v-for="(ability, i) in abilities"
        :key="i"
        class="rounded-lg border p-4 space-y-3"
      >
        <div class="flex items-center gap-2">
          <input
            :value="ability.name"
            class="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            placeholder="能力名称"
            @input="updateName(i, ($event.target as HTMLInputElement).value)"
          >
          <button
            v-if="abilities.length > 1"
            class="text-muted-foreground hover:text-destructive text-xs"
            @click="removeAbility(i)"
          >
            ×
          </button>
        </div>

        <!-- 差距条 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>当前 {{ ability.current }}</span>
            <span>目标 {{ ability.target }}</span>
          </div>
          <div class="relative h-6 bg-muted rounded-full overflow-hidden">
            <!-- 当前水平 -->
            <div
              class="absolute top-0 left-0 h-full bg-primary/30 rounded-full transition-all"
              :style="{ width: `${ability.current * 10}%` }"
            />
            <!-- 目标水平 -->
            <div
              class="absolute top-0 left-0 h-full border-2 border-dashed border-primary/50 rounded-full transition-all"
              :style="{ width: `${ability.target * 10}%` }"
            />
            <!-- 差距标记 -->
            <div
              class="absolute top-0 h-full bg-destructive/10 transition-all"
              :style="{ left: `${ability.current * 10}%`, width: `${(ability.target - ability.current) * 10}%` }"
            />
          </div>
        </div>

        <!-- 滑块 -->
        <div class="flex items-center gap-4">
          <label class="text-[10px] text-muted-foreground w-10">当前</label>
          <input
            v-model.number="ability.current"
            type="range" min="1" max="10" step="1"
            class="flex-1 h-1 cursor-pointer"
          >
        </div>
        <div class="flex items-center gap-4">
          <label class="text-[10px] text-primary w-10">目标</label>
          <input
            v-model.number="ability.target"
            type="range" min="1" max="10" step="1"
            class="flex-1 h-1 cursor-pointer accent-primary"
          >
        </div>
      </div>

      <button
        class="w-full rounded-lg border border-dashed py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        @click="addAbility"
      >
        + 添加能力维度
      </button>
    </div>
  </div>
</template>
