<script setup lang="ts">
import { ArrowLeft, Save } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const { t } = useI18n()

const STORAGE_KEY = 'reading_user_profile'

interface UserProfile {
  whoAmI: string
  goals: string
  interests: string
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw)
      return JSON.parse(raw)
  }
  catch { /* ignore */ }
  return { whoAmI: '', goals: '', interests: '' }
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
      <div class="mx-auto max-w-2xl px-8 py-10 space-y-8">
        <p class="text-sm text-muted-foreground">
          {{ t('reading.userProfileDesc') }}
        </p>

        <!-- 我是谁 -->
        <div class="space-y-2">
          <label class="text-base font-medium">{{ t('reading.profileWhoAmI') }}</label>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.profileWhoAmIHint') }}
          </p>
          <textarea
            v-model="profile.whoAmI"
            rows="5"
            class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            :placeholder="t('reading.profileWhoAmIPlaceholder')"
          />
        </div>

        <!-- 我想做什么 -->
        <div class="space-y-2">
          <label class="text-base font-medium">{{ t('reading.profileGoals') }}</label>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.profileGoalsHint') }}
          </p>
          <textarea
            v-model="profile.goals"
            rows="5"
            class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            :placeholder="t('reading.profileGoalsPlaceholder')"
          />
        </div>

        <!-- 我关注什么 -->
        <div class="space-y-2">
          <label class="text-base font-medium">{{ t('reading.profileInterests') }}</label>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.profileInterestsHint') }}
          </p>
          <textarea
            v-model="profile.interests"
            rows="5"
            class="w-full rounded-lg border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            :placeholder="t('reading.profileInterestsPlaceholder')"
          />
        </div>

        <!-- 保存按钮 -->
        <div class="flex items-center gap-3 pt-4">
          <Button class="gap-2" @click="save">
            <Save class="h-4 w-4" />
            {{ t('common.save') }}
          </Button>
          <span v-if="saved" class="text-sm text-green-600 animate-fade-in">
            {{ t('reading.profileSaved') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
