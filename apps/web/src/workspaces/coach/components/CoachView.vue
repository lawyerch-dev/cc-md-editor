<!-- @workspace coach -->
<script setup lang="ts">
import { ArrowLeft, Moon, Sun, Target, User } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import SyncButton from '@/shared/components/navigation/SyncButton.vue'
import ViewNav from '@/shared/components/navigation/ViewNav.vue'
import { useAIConversation } from '@/shared/composables/ai/useAIConversation'
import { useLocaleStore } from '@/shared/stores/locale'
import { useUIStore } from '@/shared/stores/ui'
import { useCoachStore } from '../stores'
import DiagnosisCard from './DiagnosisCard.vue'
import GoalSettingCard from './GoalSettingCard.vue'

const { t } = useI18n()
const uiStore = useUIStore()
const localeStore = useLocaleStore()
const coachStore = useCoachStore()

// AI 对话
const chatInput = ref('')
const chatContainerRef = ref<HTMLElement | null>(null)

const conversation = useAIConversation({
  systemPrompt: computed(() => {
    const profile = coachStore.profile
    const profileContext = profile
      ? `\n\n用户画像：\n- 身份：${profile.identity}\n- 当前层级：${profile.currentLevel}\n- 目标层级：${profile.targetLevel}\n- 优势：${profile.strengths.join('、')}\n- 短板：${profile.weaknesses.join('、')}\n- 时间窗口：${profile.timeWindow}`
      : ''
    return `你是一位专业的生涯教练（Coach），专注于帮助用户实现阶层跃迁。你的风格是：
1. 直接、务实，不说废话
2. 善于提问，引导用户思考
3. 给出具体可执行的建议
4. 用"输入型任务"（学习/积累）和"输出型任务"（创作/交付）框架来规划行动
5. 关注 ROI（投入产出比）${profileContext}

回复简洁有力，用要点式列出。`
  }),
  includeContext: false,
  persistenceKey: 'coach-conversation',
})

const { messages, isStreaming } = conversation

// 滚动到底部
function scrollToBottom() {
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}

// 发送消息
async function handleSend() {
  const text = chatInput.value.trim()
  if (!text || isStreaming.value)
    return
  chatInput.value = ''
  try {
    await conversation.send(text)
    scrollToBottom()
  }
  catch {
    // Error shown in message
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 今日任务
const todayTasks = computed(() => coachStore.todayTasks)
const pendingCount = computed(() => coachStore.pendingTasks.length)

function handleToggleTodayTask(goalId: string, taskId: string) {
  coachStore.toggleTask(goalId, taskId)
}

// 诊断完成回调
function onDiagnosed() {
  // 画像已保存到 store
}
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <!-- 顶部导航栏 -->
    <header class="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0">
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="uiStore.setCurrentView('landing')">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <ViewNav />
      <h1 class="text-sm font-semibold text-foreground ml-1">
        {{ t('coach.title') }}
      </h1>
      <div class="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1 text-xs"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </Button>
      <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="uiStore.toggleDark()">
        <Sun v-if="uiStore.isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </Button>
      <SyncButton />
    </header>

    <!-- 主体区域：左右两栏 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左栏：AI 教练对话 -->
      <div class="flex flex-1 flex-col border-r border-border">
        <!-- 对话消息区 -->
        <div ref="chatContainerRef" class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <!-- 欢迎消息 -->
          <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center gap-4 px-8">
            <div class="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <User class="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">
                {{ t('coach.chat.welcome') }}
              </h2>
              <p class="mt-1 text-sm text-muted-foreground max-w-md">
                {{ t('coach.chat.welcomeDesc') }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 justify-center mt-2">
              <button
                class="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                @click="chatInput = t('coach.chat.quickStart1'); handleSend()"
              >
                {{ t('coach.chat.quickStart1') }}
              </button>
              <button
                class="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                @click="chatInput = t('coach.chat.quickStart2'); handleSend()"
              >
                {{ t('coach.chat.quickStart2') }}
              </button>
              <button
                class="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                @click="chatInput = t('coach.chat.quickStart3'); handleSend()"
              >
                {{ t('coach.chat.quickStart3') }}
              </button>
            </div>
          </div>

          <!-- 消息列表 -->
          <template v-for="msg in messages" :key="msg.id">
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div class="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {{ msg.content }}
              </div>
            </div>
            <div v-else-if="msg.role === 'assistant'" class="flex justify-start">
              <div class="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
                {{ msg.content }}
                <span v-if="!msg.done" class="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </template>
        </div>

        <!-- 输入区域 -->
        <div class="border-t border-border px-4 py-3 shrink-0">
          <div class="flex gap-2 items-end">
            <Textarea
              v-model="chatInput"
              :placeholder="t('coach.chat.placeholder')"
              class="min-h-[40px] max-h-[120px] resize-none text-sm flex-1"
              rows="1"
              @keydown="handleKeydown"
            />
            <Button
              size="sm"
              class="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4"
              :disabled="!chatInput.trim() || isStreaming"
              @click="handleSend"
            >
              {{ t('coach.chat.send') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- 右栏：目标和任务面板 -->
      <div class="w-[380px] shrink-0 overflow-y-auto bg-muted/30 dark:bg-muted/10 p-4 space-y-5">
        <!-- AI 诊断卡片 -->
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <DiagnosisCard @diagnosed="onDiagnosed" />
        </div>

        <!-- 目标设定卡片 -->
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <GoalSettingCard />
        </div>
      </div>
    </div>

    <!-- 底部：今日任务清单 -->
    <div class="border-t border-border px-6 py-3 shrink-0 bg-card">
      <div class="flex items-center gap-3 mb-2">
        <Target class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-xs font-semibold text-foreground">
          {{ t('coach.todayTasks.title') }}
        </h3>
        <span v-if="pendingCount > 0" class="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          {{ t('coach.todayTasks.pending', { count: pendingCount }) }}
        </span>
      </div>
      <div v-if="todayTasks.length === 0" class="text-xs text-muted-foreground py-2">
        {{ t('coach.todayTasks.empty') }}
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="task in todayTasks"
          :key="task.id"
          class="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-emerald-300 dark:hover:border-emerald-700"
        >
          <Checkbox
            :checked="task.completed"
            class="h-3.5 w-3.5"
            @update:checked="handleToggleTodayTask(task.goalId, task.id)"
          />
          <span
            :class="task.completed ? 'text-muted-foreground line-through' : 'text-foreground'"
          >
            {{ task.title }}
          </span>
          <span
            class="inline-block h-1.5 w-1.5 rounded-full"
            :class="task.type === 'input' ? 'bg-violet-500' : 'bg-amber-500'"
          />
        </div>
      </div>
    </div>
  </div>
</template>
