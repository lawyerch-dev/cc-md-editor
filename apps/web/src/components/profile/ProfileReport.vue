<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  ikigai: { love: string[], goodAt: string[], worldNeeds: string[], paidFor: string[] }
  wheelOfLife: Record<string, number>
  values: string[]
  abilities: Array<{ name: string, current: number, target: number }>
  whoAmI: string
  goals: string
  interests: string
}>()

const dimensions: Record<string, string> = {
  career: '职业发展',
  finance: '财务状况',
  health: '健康体能',
  relationships: '人际关系',
  learning: '学习成长',
  recreation: '休闲娱乐',
  spirituality: '精神内在',
  community: '社会贡献',
}

const strengths = computed(() => {
  return Object.entries(props.wheelOfLife)
    .filter(([, v]) => v >= 7)
    .map(([k]) => dimensions[k] || k)
})

const weaknesses = computed(() => {
  return Object.entries(props.wheelOfLife)
    .filter(([, v]) => v <= 4)
    .map(([k]) => dimensions[k] || k)
})

const topGaps = computed(() => {
  return [...props.abilities]
    .sort((a, b) => (b.target - b.current) - (a.target - a.current))
    .slice(0, 3)
})

const aiPrompt = computed(() => {
  const parts: string[] = ['## 用户画像\n']

  if (props.whoAmI)
    parts.push(`**我是谁**：${props.whoAmI}`)
  if (props.goals)
    parts.push(`**目标**：${props.goals}`)
  if (props.interests)
    parts.push(`**关注领域**：${props.interests}`)

  if (props.ikigai.love.length || props.ikigai.goodAt.length) {
    parts.push('\n**Ikigai 定位**：')
    if (props.ikigai.love.length)
      parts.push(`- 热爱：${props.ikigai.love.join('、')}`)
    if (props.ikigai.goodAt.length)
      parts.push(`- 擅长：${props.ikigai.goodAt.join('、')}`)
    if (props.ikigai.worldNeeds.length)
      parts.push(`- 世界需要：${props.ikigai.worldNeeds.join('、')}`)
    if (props.ikigai.paidFor.length)
      parts.push(`- 能获得回报：${props.ikigai.paidFor.join('、')}`)
  }

  if (props.values.length)
    parts.push(`\n**核心价值观**：${props.values.join('、')}`)

  if (strengths.value.length)
    parts.push(`\n**优势领域**：${strengths.value.join('、')}`)
  if (weaknesses.value.length)
    parts.push(`**待提升领域**：${weaknesses.value.join('、')}`)

  if (topGaps.value.length) {
    parts.push('\n**能力差距 Top 3**：')
    topGaps.value.forEach(a => parts.push(`- ${a.name}：当前 ${a.current} → 目标 ${a.target}（差距 ${a.target - a.current}）`))
  }

  parts.push('\n---\n请基于以上用户画像，分析和筛选对该用户最有价值的内容。')
  return parts.join('\n')
})

function copyPrompt() {
  navigator.clipboard.writeText(aiPrompt.value)
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <h2 class="text-xl font-bold">
        你的画像报告
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        基于你的自我剖析生成的个人定位报告
      </p>
    </div>

    <div class="w-full max-w-2xl space-y-6">
      <!-- Ikigai 定位 -->
      <div v-if="ikigai.love.length || ikigai.goodAt.length" class="rounded-xl border p-5 space-y-3">
        <h3 class="text-sm font-semibold flex items-center gap-2">
          🎯 Ikigai 定位
        </h3>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div v-if="ikigai.love.length">
            <span class="text-pink-500 font-medium">热爱</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="v in ikigai.love" :key="v" class="rounded-full bg-pink-50 dark:bg-pink-950 px-2 py-0.5 text-pink-600 dark:text-pink-400">{{ v }}</span>
            </div>
          </div>
          <div v-if="ikigai.goodAt.length">
            <span class="text-blue-500 font-medium">擅长</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="v in ikigai.goodAt" :key="v" class="rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-blue-600 dark:text-blue-400">{{ v }}</span>
            </div>
          </div>
          <div v-if="ikigai.worldNeeds.length">
            <span class="text-emerald-500 font-medium">世界需要</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="v in ikigai.worldNeeds" :key="v" class="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">{{ v }}</span>
            </div>
          </div>
          <div v-if="ikigai.paidFor.length">
            <span class="text-amber-500 font-medium">能获得回报</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="v in ikigai.paidFor" :key="v" class="rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-amber-600 dark:text-amber-400">{{ v }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 优势与短板 -->
      <div v-if="strengths.length || weaknesses.length" class="rounded-xl border p-5 space-y-3">
        <h3 class="text-sm font-semibold flex items-center gap-2">
          📊 生命之轮
        </h3>
        <div class="flex gap-6 text-xs">
          <div v-if="strengths.length">
            <span class="text-green-600 font-medium">✅ 优势</span>
            <div class="mt-1 space-y-0.5">
              {{ strengths.join('、') }}
            </div>
          </div>
          <div v-if="weaknesses.length">
            <span class="text-orange-500 font-medium">⚠️ 待提升</span>
            <div class="mt-1 space-y-0.5">
              {{ weaknesses.join('、') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 价值观 -->
      <div v-if="values.length" class="rounded-xl border p-5 space-y-3">
        <h3 class="text-sm font-semibold flex items-center gap-2">
          💎 核心价值观
        </h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="(v, i) in values" :key="v" class="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <span class="font-bold text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">{{ i + 1 }}</span>
            {{ v }}
          </span>
        </div>
      </div>

      <!-- 能力差距 -->
      <div v-if="topGaps.length" class="rounded-xl border p-5 space-y-3">
        <h3 class="text-sm font-semibold flex items-center gap-2">
          📈 能力差距
        </h3>
        <div class="space-y-2">
          <div v-for="a in topGaps" :key="a.name" class="flex items-center gap-3 text-xs">
            <span class="w-16 shrink-0">{{ a.name }}</span>
            <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary/30 rounded-full" :style="{ width: `${a.current * 10}%` }" />
            </div>
            <span class="text-muted-foreground w-20 text-right">差距 {{ a.target - a.current }}</span>
          </div>
        </div>
      </div>

      <!-- AI Prompt -->
      <div class="rounded-xl border bg-muted/30 p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">
            🤖 AI 画像 Prompt
          </h3>
          <Button variant="outline" size="sm" class="h-7 text-xs gap-1" @click="copyPrompt">
            复制
          </Button>
        </div>
        <pre class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{{ aiPrompt }}</pre>
      </div>
    </div>
  </div>
</template>
