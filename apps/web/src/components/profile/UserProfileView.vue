<script setup lang="ts">
import { ArrowLeft, Save } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui'
import IkigaiDiagram from './IkigaiDiagram.vue'

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
  whoAmI: string
  goals: string
  interests: string
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (!data.ikigai) {
        return {
          ikigai: { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
          whoAmI: data.whoAmI || '',
          goals: data.goals || '',
          interests: data.interests || '',
        }
      }
      return data
    }
  }
  catch { /* ignore */ }
  return {
    ikigai: { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
    whoAmI: '',
    goals: '',
    interests: '',
  }
}

const profile = ref<UserProfile>(loadProfile())
const saved = ref(false)

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.value))
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
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
    </div>

    <!-- 内容 -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl px-8 py-10 space-y-12">
        <!-- Ikigai 探索 -->
        <section>
          <IkigaiDiagram v-model="profile.ikigai" />
        </section>

        <!-- 分隔线 -->
        <div class="border-t" />

        <!-- 补充描述 -->
        <section class="space-y-6">
          <h2 class="text-lg font-semibold">
            补充描述
          </h2>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.userProfileDesc') }}
          </p>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('reading.profileWhoAmI') }}</label>
            <textarea
              v-model="profile.whoAmI"
              rows="3"
              class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              :placeholder="t('reading.profileWhoAmIPlaceholder')"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('reading.profileGoals') }}</label>
            <textarea
              v-model="profile.goals"
              rows="3"
              class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              :placeholder="t('reading.profileGoalsPlaceholder')"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('reading.profileInterests') }}</label>
            <textarea
              v-model="profile.interests"
              rows="3"
              class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              :placeholder="t('reading.profileInterestsPlaceholder')"
            />
          </div>
        </section>

        <!-- 保存按钮 -->
        <div class="flex items-center gap-3 pt-4 pb-16">
          <Button class="gap-2" @click="save">
            <Save class="h-4 w-4" />
            {{ t('common.save') }}
          </Button>
          <span v-if="saved" class="text-sm text-green-600">
            {{ t('reading.profileSaved') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
