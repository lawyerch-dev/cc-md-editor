<!-- @workspace coach -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAIConversation } from '@/shared/composables/ai/useAIConversation'
import { useCoachStore } from '../stores'

const emit = defineEmits<{
  diagnosed: [profile: {
    identity: string
    currentLevel: string
    targetLevel: string
    strengths: string[]
    weaknesses: string[]
    timeWindow: string
  }]
}>()

const { t } = useI18n()
const coachStore = useCoachStore()

const currentStep = ref(0)
const answers = ref<string[]>(['', '', '', '', ''])
const diagnosisReport = ref('')
const isGenerating = ref(false)
const isComplete = ref(false)

const conversation = useAIConversation({
  systemPrompt: `你是一位专业的生涯规划教练和战略顾问。用户正在完成一份自我诊断问卷。请根据用户的回答，给出一段简洁有力的诊断报告（200字以内），指出：
1. 用户的核心竞争力
2. 最大的瓶颈
3. 最关键的一步行动建议
用鼓励但直接的语气。`,
  includeContext: false,
})

const steps = computed(() => [
  { key: 'identity', question: t('coach.diagnosis.step1.question'), placeholder: t('coach.diagnosis.step1.placeholder') },
  { key: 'currentLevel', question: t('coach.diagnosis.step2.question'), placeholder: t('coach.diagnosis.step2.placeholder') },
  { key: 'targetLevel', question: t('coach.diagnosis.step3.question'), placeholder: t('coach.diagnosis.step3.placeholder') },
  { key: 'strengths', question: t('coach.diagnosis.step4.question'), placeholder: t('coach.diagnosis.step4.placeholder') },
  { key: 'weaknesses', question: t('coach.diagnosis.step5.question'), placeholder: t('coach.diagnosis.step5.placeholder') },
])

const currentStepData = computed(() => steps.value[currentStep.value])
const canProceed = computed(() => answers.value[currentStep.value]?.trim().length > 0)
const isLastStep = computed(() => currentStep.value === steps.value.length - 1)

function nextStep() {
  if (!canProceed.value)
    return
  if (isLastStep.value) {
    submitDiagnosis()
  }
  else {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function submitDiagnosis() {
  isGenerating.value = true
  try {
    const summary = steps.value
      .map((s, i) => `${s.question}\n${answers.value[i]}`)
      .join('\n\n')

    const report = await conversation.send(
      `请根据以下诊断问卷回答，给出诊断报告：\n\n${summary}`,
    )
    diagnosisReport.value = report
    isComplete.value = true

    // 解析并保存画像
    const profile = {
      identity: answers.value[0],
      currentLevel: answers.value[1],
      targetLevel: answers.value[2],
      strengths: answers.value[3].split(/[,，、\n]/).map(s => s.trim()).filter(Boolean),
      weaknesses: answers.value[4].split(/[,，、\n]/).map(s => s.trim()).filter(Boolean),
      timeWindow: answers.value[2], // 从目标描述中提取
    }
    coachStore.saveProfile(profile)
    emit('diagnosed', profile)
  }
  catch {
    // Error handled by conversation
  }
  finally {
    isGenerating.value = false
  }
}

function restart() {
  currentStep.value = 0
  answers.value = ['', '', '', '', '']
  diagnosisReport.value = ''
  isComplete.value = false
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 标题 -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-foreground">
        {{ t('coach.diagnosis.title') }}
      </h3>
      <span class="text-xs text-muted-foreground">
        {{ t('coach.diagnosis.stepIndicator', { current: currentStep + 1, total: steps.length }) }}
      </span>
    </div>

    <!-- 步骤进度条 -->
    <div class="flex gap-1.5">
      <div
        v-for="(step, i) in steps"
        :key="step.key"
        class="h-1 flex-1 rounded-full transition-colors"
        :class="i <= currentStep ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'"
      />
    </div>

    <!-- 问卷区域 -->
    <div v-if="!isComplete" class="flex flex-col gap-3">
      <div>
        <p class="text-sm font-medium text-foreground leading-relaxed">
          {{ currentStepData.question }}
        </p>
      </div>
      <Textarea
        v-model="answers[currentStep]"
        :placeholder="currentStepData.placeholder"
        class="min-h-[100px] resize-none text-sm"
        @keydown.meta.enter="nextStep"
        @keydown.ctrl.enter="nextStep"
      />
      <p class="text-[11px] text-muted-foreground">
        {{ t('coach.diagnosis.hint') }}
      </p>
    </div>

    <!-- 诊断报告 -->
    <div v-else class="flex flex-col gap-3">
      <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <p class="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
          {{ diagnosisReport }}
        </p>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <Button
          v-if="currentStep > 0 && !isComplete"
          variant="ghost"
          size="sm"
          @click="prevStep"
        >
          {{ t('coach.diagnosis.prev') }}
        </Button>
        <Button
          v-if="isComplete"
          variant="ghost"
          size="sm"
          @click="restart"
        >
          {{ t('coach.diagnosis.restart') }}
        </Button>
      </div>
      <Button
        v-if="!isComplete"
        size="sm"
        :disabled="!canProceed || isGenerating"
        class="bg-emerald-600 hover:bg-emerald-700 text-white"
        @click="nextStep"
      >
        <span v-if="isGenerating" class="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        {{ isLastStep ? t('coach.diagnosis.submit') : t('coach.diagnosis.next') }}
      </Button>
    </div>
  </div>
</template>
