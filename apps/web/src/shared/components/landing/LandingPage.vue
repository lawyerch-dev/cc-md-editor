<!-- @workspace shared -->
<script setup lang="ts">
import { FileText, Globe, Lightbulb, Moon, Newspaper, ScrollText, Settings, Sun, User, X } from '@lucide/vue'
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
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-background">
    <DecorativeBackground />
    <!-- 右上角工具栏 -->
    <div class="absolute right-6 top-6 flex items-center gap-2">
      <!-- 语言切换 -->
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </button>

      <!-- 主题切换 -->
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="uiStore.toggleDark()"
      >
        <Sun v-if="uiStore.isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
        {{ uiStore.isDark ? t('common.lightMode') : t('common.darkMode') }}
      </button>

      <!-- AI 设置 -->
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="showAIConfig = true"
      >
        <Settings class="h-4 w-4" />
        {{ t('landing.aiSettings') }}
      </button>

      <!-- 更新日志 -->
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        @click="showChangelog = true"
      >
        <ScrollText class="h-4 w-4" />
        {{ t('changelog.button') }}
      </button>
    </div>

    <div class="flex flex-col items-center gap-10">
      <div class="text-center">
        <div class="animate-in mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {{ t('landing.badge') }}
        </div>
        <h1 class="animate-in animate-in-delay-1 text-5xl font-bold tracking-tight lg:text-6xl">
          {{ t('landing.title') }}
        </h1>
        <p class="animate-in animate-in-delay-2 mt-2 text-muted-foreground">
          {{ t('landing.subtitle') }}
        </p>
      </div>

      <div class="flex gap-6">
        <!-- 资讯阅读 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all duration-300 hover:border-blue-500 hover:shadow-md hover:shadow-lg hover:-translate-y-1 animate-in animate-in-delay-3"
          @click="uiStore.setCurrentView('reading')"
        >
          <Newspaper class="h-10 w-10 text-blue-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
          <div class="text-center">
            <h2 class="text-lg font-semibold group-hover:text-foreground transition-colors duration-300">
              {{ t('landing.workspaces.reading.name') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('landing.workspaces.reading.desc') }}
            </p>
          </div>
        </button>

        <!-- 想法库 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all duration-300 hover:border-amber-500 hover:shadow-md hover:shadow-lg hover:-translate-y-1 animate-in animate-in-delay-4"
          @click="uiStore.setCurrentView('ideaBoard')"
        >
          <Lightbulb class="h-10 w-10 text-amber-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
          <div class="text-center">
            <h2 class="text-lg font-semibold group-hover:text-foreground transition-colors duration-300">
              {{ t('landing.workspaces.ideaBoard.name') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('landing.workspaces.ideaBoard.desc') }}
            </p>
          </div>
        </button>

        <!-- MD 编辑器 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all duration-300 hover:border-primary hover:shadow-md hover:shadow-lg hover:-translate-y-1 animate-in animate-in-delay-4"
          @click="uiStore.setCurrentView('editor')"
        >
          <FileText class="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
          <div class="text-center">
            <h2 class="text-lg font-semibold group-hover:text-foreground transition-colors duration-300">
              {{ t('landing.workspaces.editor.name') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('landing.workspaces.editor.desc') }}
            </p>
          </div>
        </button>

        <!-- 我的画像 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:shadow-md hover:shadow-lg hover:-translate-y-1 animate-in animate-in-delay-5"
          @click="uiStore.setCurrentView('profile')"
        >
          <User class="h-10 w-10 text-emerald-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
          <div class="text-center">
            <h2 class="text-lg font-semibold group-hover:text-foreground transition-colors duration-300">
              {{ t('landing.workspaces.profile.name') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('landing.workspaces.profile.desc') }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <!-- 更新日志弹窗 -->
    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />

    <!-- AI 配置对话框 -->
    <div v-if="showAIConfig" class="ai-config-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAIConfig = false">
      <div class="flex h-[80vh] w-[620px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <span class="text-sm font-semibold">{{ t('landing.aiSettings') }}</span>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="showAIConfig = false">
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
