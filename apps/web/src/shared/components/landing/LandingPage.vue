<!-- @workspace shared -->
<script setup lang="ts">
import { FileText, Globe, Lightbulb, Moon, Newspaper, ScrollText, Settings, Sun, User, X } from '@lucide/vue'
import { defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import ChangelogDialog from '@/shared/components/landing/ChangelogDialog.vue'
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
        AI 设置
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

    <div class="flex flex-col items-center gap-8">
      <div class="text-center">
        <h1 class="text-3xl font-bold tracking-tight">
          new-ai智能工作台
        </h1>
        <p class="mt-2 text-muted-foreground">
          选择你要进入的工作区
        </p>
      </div>

      <div class="flex gap-6">
        <!-- 资讯阅读 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
          @click="uiStore.setCurrentView('reading')"
        >
          <Newspaper class="h-10 w-10 text-blue-500 transition-transform group-hover:scale-110" />
          <div class="text-center">
            <h2 class="text-lg font-semibold">
              资讯阅读
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              RSS 订阅、记录想法
            </p>
          </div>
        </button>

        <!-- 想法库 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all hover:border-amber-500 hover:shadow-md"
          @click="uiStore.setCurrentView('ideaBoard')"
        >
          <Lightbulb class="h-10 w-10 text-amber-500 transition-transform group-hover:scale-110" />
          <div class="text-center">
            <h2 class="text-lg font-semibold">
              想法库
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              白板画布、自由创作
            </p>
          </div>
        </button>

        <!-- MD 编辑器 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all hover:border-primary hover:shadow-md"
          @click="uiStore.setCurrentView('editor')"
        >
          <FileText class="h-10 w-10 text-primary transition-transform group-hover:scale-110" />
          <div class="text-center">
            <h2 class="text-lg font-semibold">
              Markdown 编辑器
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              写作、排版、预览
            </p>
          </div>
        </button>

        <!-- 我的画像 -->
        <button
          class="group flex w-56 flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md"
          @click="uiStore.setCurrentView('profile')"
        >
          <User class="h-10 w-10 text-emerald-500 transition-transform group-hover:scale-110" />
          <div class="text-center">
            <h2 class="text-lg font-semibold">
              我的画像
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              自我剖析与职业规划
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
          <span class="text-sm font-semibold">AI 设置</span>
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
