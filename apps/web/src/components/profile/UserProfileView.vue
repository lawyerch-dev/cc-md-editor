<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui'
import AbilityGap from './AbilityGap.vue'
import IkigaiDiagram from './IkigaiDiagram.vue'
import ProfileReport from './ProfileReport.vue'
import ValuesSort from './ValuesSort.vue'
import WheelOfLife from './WheelOfLife.vue'

const uiStore = useUIStore()
const { t } = useI18n()

const STORAGE_KEY = 'reading_user_profile'

interface IkigaiData {
  love: string[]
  goodAt: string[]
  worldNeeds: string[]
  paidFor: string[]
}

interface UserProfile {
  ikigai: IkigaiData
  wheelOfLife: Record<string, number>
  values: string[]
  abilities: Array<{ name: string, current: number, target: number }>
  whoAmI: string
  goals: string
  interests: string
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return {
        ikigai: data.ikigai || { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
        wheelOfLife: data.wheelOfLife || {},
        values: data.values || [],
        abilities: data.abilities || [],
        whoAmI: data.whoAmI || '',
        goals: data.goals || '',
        interests: data.interests || '',
      }
    }
  }
  catch { /* ignore */ }
  return {
    ikigai: { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
    wheelOfLife: {},
    values: [],
    abilities: [],
    whoAmI: '',
    goals: '',
    interests: '',
  }
}

const profile = ref<UserProfile>(loadProfile())

const steps = [
  { key: 'ikigai', title: 'Ikigai 探索', desc: '找到你的核心定位' },
  { key: 'wheel', title: '生命之轮', desc: '评估生活各维度' },
  { key: 'values', title: '价值观排序', desc: '明确你的决策准则' },
  { key: 'abilities', title: '能力图谱', desc: '发现成长方向' },
  { key: 'report', title: '画像报告', desc: '查看你的完整画像' },
]

const currentStep = ref(0)

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    save()
  }
}

function prevStep() {
  if (currentStep.value > 0)
    currentStep.value--
}

function goToStep(index: number) {
  currentStep.value = index
}

const saved = ref(false)
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.value))
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}

// 完成度检查
function isStepComplete(index: number): boolean {
  switch (index) {
    case 0: return profile.value.ikigai.love.length > 0
    case 1: return Object.keys(profile.value.wheelOfLife).length > 0
    case 2: return profile.value.values.length > 0
    case 3: return profile.value.abilities.length > 0
    case 4: return true
    default: return false
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <!-- 顶部导航 -->
    <div class="flex items-center gap-3 border-b px-6 py-3">
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="uiStore.setCurrentView('landing')">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-lg font-semibold">
        {{ t('reading.userProfileTitle') }}
      </h1>
      <span v-if="saved" class="text-xs text-green-600 ml-2">✓ 已保存</span>
    </div>

    <!-- 步骤进度条 -->
    <div class="border-b px-6 py-3">
      <div class="flex items-center gap-2 max-w-3xl mx-auto">
        <button
          v-for="(s, i) in steps"
          :key="s.key"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
          :class="[
            i === currentStep
              ? 'bg-primary text-primary-foreground font-medium'
              : isStepComplete(i)
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                : 'text-muted-foreground hover:bg-muted',
          ]"
          @click="goToStep(i)"
        >
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border"
            :class="[
              i === currentStep
                ? 'border-primary-foreground/30'
                : isStepComplete(i)
                  ? 'border-green-300 bg-green-100 dark:border-green-800 dark:bg-green-900'
                  : 'border-muted-foreground/30',
            ]"
          >
            <Check v-if="isStepComplete(i) && i !== currentStep" class="h-3 w-3" />
            <span v-else>{{ i + 1 }}</span>
          </span>
          <span class="hidden sm:inline">{{ s.title }}</span>
        </button>
      </div>
    </div>

    <!-- 步骤内容 -->
    <div class="flex-1 overflow-y-auto">
      <div class="py-10 px-8">
        <transition name="fade" mode="out-in">
          <!-- Step 1: Ikigai -->
          <div v-if="currentStep === 0" key="ikigai">
            <IkigaiDiagram v-model="profile.ikigai" />
          </div>

          <!-- Step 2: Wheel of Life -->
          <div v-else-if="currentStep === 1" key="wheel">
            <WheelOfLife v-model="profile.wheelOfLife" />
          </div>

          <!-- Step 3: Values -->
          <div v-else-if="currentStep === 2" key="values">
            <ValuesSort v-model="profile.values" />
          </div>

          <!-- Step 4: Abilities -->
          <div v-else-if="currentStep === 3" key="abilities">
            <AbilityGap v-model="profile.abilities" />
          </div>

          <!-- Step 5: Report -->
          <div v-else-if="currentStep === 4" key="report">
            <ProfileReport
              :ikigai="profile.ikigai"
              :wheel-of-life="profile.wheelOfLife"
              :values="profile.values"
              :abilities="profile.abilities"
              :who-am-i="profile.whoAmI"
              :goals="profile.goals"
              :interests="profile.interests"
            />
          </div>
        </transition>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="border-t px-6 py-3">
      <div class="flex items-center justify-between max-w-3xl mx-auto">
        <Button
          v-if="currentStep > 0"
          variant="ghost"
          class="gap-1"
          @click="prevStep"
        >
          <ArrowLeft class="h-4 w-4" />
          {{ steps[currentStep - 1]?.title }}
        </Button>
        <div v-else />

        <div class="flex items-center gap-2">
          <span v-if="currentStep < steps.length - 1" class="text-xs text-muted-foreground">
            {{ currentStep + 1 }} / {{ steps.length }}
          </span>
          <Button
            v-if="currentStep < steps.length - 1"
            class="gap-1"
            @click="nextStep"
          >
            {{ steps[currentStep + 1]?.title }}
            <ArrowRight class="h-4 w-4" />
          </Button>
          <Button
            v-else
            class="gap-1"
            @click="save"
          >
            保存画像
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
