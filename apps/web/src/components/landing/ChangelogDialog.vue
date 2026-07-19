<!-- @workspace shared -->
<script setup lang="ts">
import { X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { changelog } from './changelog-data'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="emit('close')"
      >
        <div
          class="flex h-[75vh] w-[560px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b px-5 py-3.5 shrink-0">
            <h2 class="text-base font-semibold">
              {{ t('changelog.title') }}
            </h2>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <div
              v-for="(ver, idx) in changelog"
              :key="ver.version"
              class="relative pb-6"
            >
              <!-- Timeline line -->
              <div
                v-if="idx < changelog.length - 1"
                class="absolute left-[7px] top-6 bottom-0 w-px bg-border"
              />

              <div class="flex gap-3.5">
                <!-- Timeline dot -->
                <div
                  class="relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2"
                  :class="idx === 0 ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-background'"
                />

                <!-- Version content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span
                      class="text-sm font-bold"
                      :class="idx === 0 ? 'text-primary' : 'text-foreground'"
                    >
                      {{ ver.version }}
                    </span>
                    <span class="text-xs text-muted-foreground">{{ ver.date }}</span>
                  </div>
                  <h3 class="mt-1 text-sm font-medium text-foreground">
                    {{ t(ver.titleKey) }}
                  </h3>
                  <ul class="mt-2 space-y-1">
                    <li
                      v-for="item in ver.items"
                      :key="item"
                      class="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
                    >
                      <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                      {{ t(item) }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
