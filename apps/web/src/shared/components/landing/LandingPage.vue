<!-- @workspace shared -->
<script setup lang="ts">
import { BarChart3, FileText, Globe, Lightbulb, Moon, Newspaper, Rocket, ScrollText, Settings, ShieldCheck, Sparkles, Sun, Trophy, User, Users, Wallet, X } from '@lucide/vue'
import { defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import ChangelogDialog from '@/shared/components/landing/ChangelogDialog.vue'
import DecorativeBackground from '@/shared/components/landing/DecorativeBackground.vue'
import { useLocaleStore } from '@/shared/stores/locale'
import { useUIStore } from '@/shared/stores/ui'

const AIConfig = defineAsyncComponent(() => import('@/shared/components/ai/chat-box/AIConfig.vue'))

const uiStore = useUIStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const showAIConfig = ref(false)
const showChangelog = ref(false)

// 浅色模式使用暖白风格，仅作用于首页
const warmWhiteStyle = computed(() => {
  if (uiStore.isDark)
    return {}
  return {
    '--background': '40 20% 97%',
    '--card': '42 18% 98%',
    '--foreground': '30 12% 14%',
    '--muted': '38 14% 92%',
    '--muted-foreground': '35 9% 42%',
    '--border': '38 16% 87%',
    '--accent': '40 16% 93%',
    '--accent-foreground': '30 12% 14%',
  }
})

interface WorkspaceCard {
  key: string
  icon: unknown
  iconClass: string
  borderClass: string
  view?: 'reading' | 'ideaBoard' | 'editor' | 'profile' | 'coach' | 'report'
  status: 'available' | 'dev'
}

interface Layer {
  key: 'input' | 'output' | 'mobility'
  cards: WorkspaceCard[]
}

const layers: Layer[] = [
  {
    key: 'input',
    cards: [
      { key: 'reading', icon: Newspaper, iconClass: 'text-blue-500', borderClass: 'hover:border-blue-500', view: 'reading', status: 'available' },
      { key: 'ideaBoard', icon: Lightbulb, iconClass: 'text-amber-500', borderClass: 'hover:border-amber-500', view: 'ideaBoard', status: 'available' },
      { key: 'profile', icon: User, iconClass: 'text-emerald-500', borderClass: 'hover:border-emerald-500', view: 'profile', status: 'available' },
    ],
  },
  {
    key: 'output',
    cards: [
      { key: 'editor', icon: FileText, iconClass: 'text-primary', borderClass: 'hover:border-primary', view: 'editor', status: 'available' },
      { key: 'outputHub', icon: Rocket, iconClass: 'text-rose-500', borderClass: 'hover:border-rose-500', status: 'dev' },
      { key: 'reputation', icon: Trophy, iconClass: 'text-violet-500', borderClass: 'hover:border-violet-500', status: 'dev' },
      { key: 'coach', icon: Sparkles, iconClass: 'text-cyan-500', borderClass: 'hover:border-cyan-500', view: 'coach', status: 'available' },
    ],
  },
  {
    key: 'mobility',
    cards: [
      { key: 'report', icon: BarChart3, iconClass: 'text-indigo-500', borderClass: 'hover:border-indigo-500', view: 'report', status: 'available' },
      { key: 'trustAccount', icon: ShieldCheck, iconClass: 'text-teal-500', borderClass: 'hover:border-teal-500', status: 'dev' },
      { key: 'network', icon: Users, iconClass: 'text-orange-500', borderClass: 'hover:border-orange-500', status: 'dev' },
      { key: 'monetize', icon: Wallet, iconClass: 'text-lime-600', borderClass: 'hover:border-lime-500', status: 'dev' },
    ],
  },
]

function handleCardClick(card: WorkspaceCard) {
  if (card.status === 'dev')
    return
  if (card.view)
    uiStore.setCurrentView(card.view)
}

function layerIndexClass(layerKey: string) {
  return layerKey === 'input' ? 'animate-in-delay-3' : layerKey === 'output' ? 'animate-in-delay-4' : 'animate-in-delay-5'
}
</script>

<template>
  <div
    class="relative flex h-screen flex-col overflow-hidden bg-background"
    :style="warmWhiteStyle"
  >
    <DecorativeBackground />

    <!-- 右上角工具栏 -->
    <div class="absolute right-6 top-6 z-50 flex items-center gap-2">
      <!-- 语言切换 -->
      <button
        class="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </button>

      <!-- 主题切换 -->
      <button
        class="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="uiStore.toggleDark()"
      >
        <Sun v-if="uiStore.isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
        {{ uiStore.isDark ? t('common.lightMode') : t('common.darkMode') }}
      </button>

      <!-- AI 设置 -->
      <button
        class="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="showAIConfig = true"
      >
        <Settings class="h-4 w-4" />
        {{ t('landing.aiSettings') }}
      </button>

      <!-- 更新日志 -->
      <button
        class="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="showChangelog = true"
      >
        <ScrollText class="h-4 w-4" />
        {{ t('changelog.button') }}
      </button>
    </div>

    <!-- 主内容 -->
    <main class="z-10 flex-1 overflow-y-auto px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto flex min-h-0 max-w-7xl flex-col items-center">
        <!-- Hero -->
        <div class="max-w-3xl text-center">
          <div class="animate-in mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
            {{ t('landing.badge') }}
          </div>
          <h1 class="animate-in animate-in-delay-1 text-4xl font-bold tracking-tight sm:text-5xl">
            {{ t('landing.title') }}
          </h1>
          <p class="animate-in animate-in-delay-2 mt-2 text-lg text-muted-foreground">
            {{ t('landing.subtitle') }}
          </p>
          <p class="animate-in animate-in-delay-3 mx-auto mt-4 max-w-2xl rounded-2xl border border-primary/10 bg-primary/5 px-5 py-3 text-sm leading-relaxed text-foreground italic">
            {{ t('landing.philosophy') }}
          </p>
        </div>

        <!-- 三层横向布局 -->
        <div class="mt-10 grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
          <section
            v-for="layer in layers"
            :key="layer.key"
            class="animate-in flex flex-col gap-4"
            :class="layerIndexClass(layer.key)"
          >
            <!-- 层标题 -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
              <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ t(`landing.section.${layer.key}`) }}
              </h2>
              <div class="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
            </div>

            <!-- 卡片列 -->
            <div class="flex flex-col gap-4">
              <component
                :is="card.status === 'dev' ? 'div' : 'button'"
                v-for="card in layer.cards"
                :key="card.key"
                class="group flex flex-col items-start gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300" :class="[
                  card.status === 'available' ? `cursor-pointer hover:-translate-y-1 hover:shadow-md ${card.borderClass}` : 'opacity-75',
                ]"
                @click="handleCardClick(card)"
              >
                <div class="flex w-full items-start justify-between">
                  <component :is="card.icon" class="h-8 w-8 transition-transform duration-300 group-hover:scale-110" :class="card.iconClass" />
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :class="card.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
                  >
                    {{ card.status === 'available' ? t('landing.status.available') : t('landing.status.dev') }}
                  </span>
                </div>
                <div class="text-left">
                  <h3 class="text-lg font-semibold">
                    {{ t(`landing.workspaces.${card.key}.name`) }}
                  </h3>
                  <p class="mt-1 text-sm text-muted-foreground">
                    {{ t(`landing.workspaces.${card.key}.desc`) }}
                  </p>
                </div>
                <div
                  v-if="card.status === 'dev'"
                  class="mt-auto w-full rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground"
                >
                  {{ t('landing.comingSoon') }}
                </div>
              </component>
            </div>
          </section>
        </div>

        <!-- Footer hint -->
        <p class="animate-in animate-in-delay-5 mt-12 text-xs text-muted-foreground">
          {{ t('landing.status.dev') }} · {{ t('landing.comingSoon') }}
        </p>
      </div>
    </main>

    <!-- 更新日志弹窗 -->
    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />

    <!-- AI 配置对话框 -->
    <div v-if="showAIConfig" class="ai-config-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAIConfig = false">
      <div class="flex h-[80vh] w-[620px] max-w-[95vw] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span class="text-sm font-semibold">{{ t('landing.aiSettings') }}</span>
          <Button variant="ghost" size="icon" class="h-7 w-7 cursor-pointer" @click="showAIConfig = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto p-5">
          <AIConfig />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

/* Entrance animations */
@keyframes fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  opacity: 0;
  animation: fade-slide-up 0.6s ease-out forwards;
}

.animate-in-delay-1 {
  animation-delay: 0.1s;
}
.animate-in-delay-2 {
  animation-delay: 0.2s;
}
.animate-in-delay-3 {
  animation-delay: 0.3s;
}
.animate-in-delay-4 {
  animation-delay: 0.4s;
}
.animate-in-delay-5 {
  animation-delay: 0.5s;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-in {
    opacity: 1;
    animation: none;
  }
}

.ai-config-dialog :deep(.custom-scroll) {
  font-size: 10px;
}
@media (min-width: 640px) {
  .ai-config-dialog :deep(.custom-scroll) {
    font-size: 12px;
  }
}

.ai-config-dialog :deep([data-radix-collection-item]) {
  padding-left: 1rem;
  padding-right: 1rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  font-size: 12px;
}

.ai-config-dialog :deep([data-state='open']),
.ai-config-dialog :deep([data-state='closed']) {
  font-size: 12px;
}

.ai-config-dialog :deep(label) {
  font-size: 10px;
}

.ai-config-dialog :deep(.space-y-3) {
  row-gap: 0.375rem;
}

.ai-config-dialog :deep(.space-y-3 > div) {
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: 0.75rem;
  padding-top: 0.375rem;
}
</style>
