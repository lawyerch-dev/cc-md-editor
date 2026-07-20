<!-- @workspace shared -->
<script setup lang="ts">
import type { WorkspaceView } from '@/shared/config/workspaces'
import { ChevronDown } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { viewNavItems } from '@/shared/config/workspaces'
import { useUIStore } from '@/shared/stores/ui'

const uiStore = useUIStore()
const { t } = useI18n()
const open = ref(false)

const currentView = computed(() => viewNavItems.find(v => v.id === uiStore.currentView) || viewNavItems[0])

function switchView(id: WorkspaceView) {
  uiStore.setCurrentView(id)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="gap-1.5">
        <component :is="currentView.icon" class="h-4 w-4" :class="currentView.color" />
        {{ t(currentView.labelKey) }}
        <ChevronDown class="h-3 w-3 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-[140px] p-1">
      <button
        v-for="v in viewNavItems"
        :key="v.id"
        class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted"
        :class="{ 'bg-muted font-medium': uiStore.currentView === v.id }"
        @click="switchView(v.id)"
      >
        <component :is="v.icon" class="h-4 w-4" :class="v.color" />
        {{ t(v.labelKey) }}
      </button>
    </PopoverContent>
  </Popover>
</template>
