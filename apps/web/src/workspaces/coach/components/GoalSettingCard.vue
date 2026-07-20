<!-- @workspace coach -->
<script setup lang="ts">
import type { Task } from '../types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAIConversation } from '@/shared/composables/ai/useAIConversation'
import { useCoachStore } from '../stores'

const { t } = useI18n()
const coachStore = useCoachStore()

const goalTitle = ref('')
const goalDescription = ref('')
const goalDeadline = ref('')
const isBreakingDown = ref(false)
const showGoalForm = ref(true)

const conversation = useAIConversation({
  systemPrompt: `你是一位专业的目标拆解教练。用户会给你一个3个月的目标，请帮他们拆解成具体的周任务。

要求：
1. 每周一个具体可执行的任务
2. 区分"输入型"（学习/研究/积累）和"输出型"（创作/发布/交付）
3. 任务要具体、可衡量
4. 按照12周来拆解

请严格按照以下 JSON 格式返回（不要有其他文字）：
[
  { "week": 1, "title": "具体任务描述", "type": "input", "dueDate": "2025-01-06" },
  { "week": 2, "title": "具体任务描述", "type": "output", "dueDate": "2025-01-13" }
]

type 只能是 "input" 或 "output"。
dueDate 是该周的周一日期。`,
  includeContext: false,
})

const activeGoal = computed(() => coachStore.activeGoal)
const tasksByType = computed(() => {
  if (!activeGoal.value)
    return { input: [] as Task[], output: [] as Task[] }
  return {
    input: activeGoal.value.tasks.filter(t => t.type === 'input'),
    output: activeGoal.value.tasks.filter(t => t.type === 'output'),
  }
})

const progress = computed(() => {
  if (!activeGoal.value || activeGoal.value.tasks.length === 0)
    return 0
  const completed = activeGoal.value.tasks.filter(t => t.completed).length
  return Math.round((completed / activeGoal.value.tasks.length) * 100)
})

function getMinDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

async function createGoalAndBreakdown() {
  if (!goalTitle.value.trim() || !goalDeadline.value)
    return

  isBreakingDown.value = true
  try {
    const goal = coachStore.addGoal(
      goalTitle.value.trim(),
      goalDescription.value.trim(),
      goalDeadline.value,
    )

    const response = await conversation.send(
      `请帮我拆解以下3个月目标：\n目标：${goalTitle.value}\n描述：${goalDescription.value || '无'}\n截止日期：${goalDeadline.value}\n\n请从本周开始拆解到截止日期。`,
    )

    // 尝试解析 JSON 任务列表
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const tasks = JSON.parse(jsonMatch[0]) as Array<{
          title: string
          type: 'input' | 'output'
          dueDate: string
        }>
        coachStore.addTasksToGoal(goal.id, tasks)
      }
    }
    catch {
      // JSON 解析失败，任务列表为空，用户可手动添加
    }

    showGoalForm.value = false
    goalTitle.value = ''
    goalDescription.value = ''
    goalDeadline.value = ''
  }
  catch {
    // Error handled by conversation
  }
  finally {
    isBreakingDown.value = false
  }
}

function handleToggleTask(taskId: string) {
  if (activeGoal.value) {
    coachStore.toggleTask(activeGoal.value.id, taskId)
  }
}

function handleRemoveTask(taskId: string) {
  if (activeGoal.value) {
    coachStore.removeTask(activeGoal.value.id, taskId)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 标题区域 -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-foreground">
        {{ t('coach.goal.title') }}
      </h3>
      <Button
        v-if="!showGoalForm && activeGoal"
        variant="ghost"
        size="sm"
        class="text-xs"
        @click="showGoalForm = true"
      >
        {{ t('coach.goal.newGoal') }}
      </Button>
    </div>

    <!-- 新建目标表单 -->
    <div v-if="showGoalForm" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted-foreground">
          {{ t('coach.goal.goalName') }}
        </label>
        <Input
          v-model="goalTitle"
          :placeholder="t('coach.goal.goalNamePlaceholder')"
          class="h-8 text-sm"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted-foreground">
          {{ t('coach.goal.goalDesc') }}
        </label>
        <Textarea
          v-model="goalDescription"
          :placeholder="t('coach.goal.goalDescPlaceholder')"
          class="min-h-[60px] resize-none text-sm"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted-foreground">
          {{ t('coach.goal.deadline') }}
        </label>
        <Input
          v-model="goalDeadline"
          type="date"
          :min="getMinDate()"
          class="h-8 text-sm"
        />
      </div>
      <Button
        class="w-full bg-blue-600 hover:bg-blue-700 text-white"
        size="sm"
        :disabled="!goalTitle.trim() || !goalDeadline || isBreakingDown"
        @click="createGoalAndBreakdown"
      >
        <span v-if="isBreakingDown" class="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        {{ isBreakingDown ? t('coach.goal.breaking') : t('coach.goal.createAndBreak') }}
      </Button>
    </div>

    <!-- 目标概览 -->
    <div v-if="activeGoal && !showGoalForm" class="flex flex-col gap-3">
      <div class="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div class="flex items-center justify-between mb-1">
          <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">
            {{ activeGoal.title }}
          </h4>
          <span class="text-xs text-blue-600 dark:text-blue-400">
            {{ progress }}%
          </span>
        </div>
        <p v-if="activeGoal.description" class="text-xs text-blue-700 dark:text-blue-300 line-clamp-2">
          {{ activeGoal.description }}
        </p>
        <div class="mt-2 h-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <!-- 输入型任务 -->
      <div v-if="tasksByType.input.length > 0">
        <h4 class="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
          {{ t('coach.goal.inputTasks') }}
          <span class="text-[11px] opacity-60">({{ tasksByType.input.filter(t => t.completed).length }}/{{ tasksByType.input.length }})</span>
        </h4>
        <div class="flex flex-col gap-1">
          <div
            v-for="task in tasksByType.input"
            :key="task.id"
            class="group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
          >
            <Checkbox
              :checked="task.completed"
              class="mt-0.5"
              @update:checked="handleToggleTask(task.id)"
            />
            <span
              class="flex-1 text-sm leading-snug"
              :class="task.completed ? 'text-muted-foreground line-through' : 'text-foreground'"
            >
              {{ task.title }}
            </span>
            <span class="text-[10px] text-muted-foreground whitespace-nowrap">
              {{ task.dueDate.slice(5) }}
            </span>
            <button
              class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              @click="handleRemoveTask(task.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- 输出型任务 -->
      <div v-if="tasksByType.output.length > 0">
        <h4 class="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
          {{ t('coach.goal.outputTasks') }}
          <span class="text-[11px] opacity-60">({{ tasksByType.output.filter(t => t.completed).length }}/{{ tasksByType.output.length }})</span>
        </h4>
        <div class="flex flex-col gap-1">
          <div
            v-for="task in tasksByType.output"
            :key="task.id"
            class="group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
          >
            <Checkbox
              :checked="task.completed"
              class="mt-0.5"
              @update:checked="handleToggleTask(task.id)"
            />
            <span
              class="flex-1 text-sm leading-snug"
              :class="task.completed ? 'text-muted-foreground line-through' : 'text-foreground'"
            >
              {{ task.title }}
            </span>
            <span class="text-[10px] text-muted-foreground whitespace-nowrap">
              {{ task.dueDate.slice(5) }}
            </span>
            <button
              class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              @click="handleRemoveTask(task.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <p v-if="activeGoal.tasks.length === 0" class="text-xs text-muted-foreground text-center py-4">
        {{ t('coach.goal.noTasks') }}
      </p>
    </div>

    <!-- 无目标空状态 -->
    <div v-if="!activeGoal && !showGoalForm" class="text-center py-6">
      <p class="text-sm text-muted-foreground mb-3">
        {{ t('coach.goal.noGoal') }}
      </p>
      <Button size="sm" variant="outline" @click="showGoalForm = true">
        {{ t('coach.goal.newGoal') }}
      </Button>
    </div>
  </div>
</template>
