<!-- @workspace shared -->
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import LandingPage from '@/shared/components/landing/LandingPage.vue'
import { Toaster } from '@/components/ui/sonner'
import { useCommandPaletteHotkey } from '@/shared/composables/useCommandPaletteHotkey'
import { usePreferencesHotkey } from '@/shared/composables/usePreferencesHotkey'
import { useUIStore } from '@/shared/stores/ui'

const CodemirrorEditor = defineAsyncComponent(() => import('@/workspaces/editor/components/CodemirrorEditor.vue'))
const IdeaBoard = defineAsyncComponent(() => import('@/workspaces/idea-board/components/IdeaBoard.vue'))
const ReadingView = defineAsyncComponent(() => import('@/workspaces/reading/components/ReadingView.vue'))
const UserProfileView = defineAsyncComponent(() => import('@/workspaces/profile/components/UserProfileView.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/workspaces/editor/components/dialogs/CommandPalette.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/navigation/confirm-dialog/ConfirmDialog.vue'))
const PreferencesDialog = defineAsyncComponent(() => import('@/workspaces/editor/components/dialogs/PreferencesDialog.vue'))
const UnifiedSyncDialog = defineAsyncComponent(() => import('@/workspaces/editor/components/editor-header/UnifiedSyncDialog.vue'))

const uiStore = useUIStore()
const { isDark, currentView, isShowPreferencesDialog, isShowSyncDialog } = storeToRefs(uiStore)

usePlatformEnv()
useAccountSyncBootstrap()
useDeepLinkImport()
useCommandPaletteHotkey()
usePreferencesHotkey()
</script>

<template>
  <LandingPage v-if="currentView === 'landing'" />
  <CodemirrorEditor v-else-if="currentView === 'editor'" />
  <IdeaBoard
    v-else-if="currentView === 'ideaBoard'"
  />
  <ReadingView
    v-else-if="currentView === 'reading'"
  />
  <UserProfileView v-else-if="currentView === 'profile'" />

  <CommandPalette />

  <ConfirmDialog />

  <PreferencesDialog v-model:open="isShowPreferencesDialog" />
  <UnifiedSyncDialog v-if="isShowSyncDialog" v-model:open="isShowSyncDialog" />

  <Toaster
    rich-colors
    position="top-center"
    :duration="1200"
    :visible-toasts="1"
    :theme="isDark ? 'dark' : 'light'"
  />
</template>
