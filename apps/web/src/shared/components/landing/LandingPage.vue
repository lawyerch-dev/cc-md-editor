<!-- @workspace shared -->
<script setup lang="ts">
import type { Component } from 'vue'
import { BarChart3, Globe, Lightbulb, Moon, PenLine, Satellite, ScrollText, Settings, Sun, Target, X } from '@lucide/vue'
import { computed, defineAsyncComponent, ref } from 'vue'
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

interface FunctionCard { id: string, nameKey: string, descKey: string, view: string }
interface WorkspaceZone { id: string, nameKey: string, descKey: string, icon: Component, color: string, cards: FunctionCard[] }

const zones: WorkspaceZone[] = [
  {
    id: 'coach', nameKey: 'landing.zones.coach.name', descKey: 'landing.zones.coach.desc',
    icon: Target, color: '#818cf8',
    cards: [
      { id: 'coach-diag', nameKey: 'landing.zones.coach.cardDiag', descKey: 'landing.zones.coach.cardDiagDesc', view: 'coach' },
      { id: 'coach-goal', nameKey: 'landing.zones.coach.cardGoal', descKey: 'landing.zones.coach.cardGoalDesc', view: 'coach' },
    ],
  },
  {
    id: 'radar', nameKey: 'landing.zones.radar.name', descKey: 'landing.zones.radar.desc',
    icon: Satellite, color: '#60a5fa',
    cards: [{ id: 'radar-feed', nameKey: 'landing.zones.radar.cardFeed', descKey: 'landing.zones.radar.cardFeedDesc', view: 'reading' }],
  },
  {
    id: 'insight', nameKey: 'landing.zones.insight.name', descKey: 'landing.zones.insight.desc',
    icon: Lightbulb, color: '#fbbf24',
    cards: [{ id: 'insight-board', nameKey: 'landing.zones.insight.cardBoard', descKey: 'landing.zones.insight.cardBoardDesc', view: 'ideaBoard' }],
  },
  {
    id: 'output', nameKey: 'landing.zones.output.name', descKey: 'landing.zones.output.desc',
    icon: PenLine, color: '#34d399',
    cards: [{ id: 'output-editor', nameKey: 'landing.zones.output.cardEditor', descKey: 'landing.zones.output.cardEditorDesc', view: 'editor' }],
  },
  {
    id: 'report', nameKey: 'landing.zones.report.name', descKey: 'landing.zones.report.desc',
    icon: BarChart3, color: '#fb7185',
    cards: [{ id: 'report-entry', nameKey: 'landing.zones.report.cardEntry', descKey: 'landing.zones.report.cardEntryDesc', view: 'report' }],
  },
]

const activeZoneId = ref('coach')
const activeZone = computed(() => zones.find(z => z.id === activeZoneId.value) ?? zones[0])

// Keyboard 1-5
function onKey(e: KeyboardEvent) {
  const idx = Number.parseInt(e.key) - 1
  if (idx >= 0 && idx < zones.length) activeZoneId.value = zones[idx].id
}
</script>

<template>
  <div class="relative flex h-[100dvh] overflow-hidden bg-background" @keydown="onKey">
    <!-- ─── Top-right toolbar ─── -->
    <div class="fixed right-6 top-6 z-40 flex items-center gap-2">
      <button class="tb" @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
        <Globe class="h-3.5 w-3.5" /> {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </button>
      <button class="tb" @click="uiStore.toggleDark()">
        <Sun v-if="uiStore.isDark" class="h-3.5 w-3.5" /><Moon v-else class="h-3.5 w-3.5" />
        {{ uiStore.isDark ? t('common.lightMode') : t('common.darkMode') }}
      </button>
      <button class="tb" @click="showAIConfig = true"><Settings class="h-3.5 w-3.5" /> AI</button>
      <button class="tb" @click="showChangelog = true"><ScrollText class="h-3.5 w-3.5" /> {{ t('changelog.button') }}</button>
    </div>

    <!-- ════════ LEFT: Arc Sidebar ════════ -->
    <aside class="arc-sidebar relative flex w-[260px] shrink-0 flex-col overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0 bg-[#08080f]" />
      <div class="absolute inset-0 opacity-20 transition-all duration-1000" :style="{ background: `radial-gradient(ellipse at 30% 50%, ${activeZone.color}18, transparent 60%)` }" />

      <!-- Brand -->
      <div class="relative z-10 px-6 pt-10 pb-8">
        <div class="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white/20">
          <span class="inline-block h-1 w-1 rounded-full bg-white/25" />
          {{ t('landing.eyebrow') }}
        </div>
        <h1 class="text-lg font-extrabold leading-tight tracking-[-0.02em] text-white/85">
          {{ t('landing.title') }}
        </h1>
        <p class="mt-1.5 text-[11px] leading-relaxed text-white/20">
          {{ t('landing.subtitle') }}
        </p>
      </div>

      <!-- Arc navigation -->
      <nav class="relative z-10 flex-1 px-3">
        <!-- SVG arc track behind items -->
        <svg class="pointer-events-none absolute left-0 top-0 h-full w-full" viewBox="0 0 260 500" preserveAspectRatio="none" fill="none">
          <path
            d="M 20 40 Q 80 120, 30 250 Q -10 380, 60 460"
            stroke="rgba(255,255,255,0.03)"
            stroke-width="1.5"
            stroke-dasharray="4 6"
            fill="none"
          />
        </svg>

        <!-- Zone items -->
        <div class="relative flex flex-col gap-1">
          <button
            v-for="(zone, i) in zones" :key="zone.id"
            class="zone-item group relative flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-500"
            :class="activeZoneId === zone.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'"
            :style="{
              marginLeft: activeZoneId === zone.id ? '0' : `${Math.sin(i * 0.8) * 8 + 8}px`,
              transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
            }"
            @click="activeZoneId = zone.id"
          >
            <!-- Active indicator bar -->
            <div
              class="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full transition-all duration-500"
              :style="{ background: activeZoneId === zone.id ? zone.color : 'transparent', boxShadow: activeZoneId === zone.id ? `0 0 12px ${zone.color}40` : 'none' }"
            />

            <!-- Icon -->
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-500"
              :style="{
                background: activeZoneId === zone.id ? zone.color + '15' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeZoneId === zone.id ? zone.color + '25' : 'rgba(255,255,255,0.04)'}`,
              }"
            >
              <component
                :is="zone.icon"
                class="h-4 w-4 transition-all duration-500"
                :style="{ color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.25)' }"
              />
            </div>

            <!-- Text -->
            <div class="flex-1 min-w-0">
              <div
                class="text-[13px] font-medium transition-all duration-500"
                :style="{ color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.4)' }"
              >
                {{ t(zone.nameKey) }}
              </div>
              <div
                class="text-[10px] transition-all duration-500"
                :style="{ color: activeZoneId === zone.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }"
              >
                {{ t(zone.descKey) }}
              </div>
            </div>

            <!-- Keyboard hint -->
            <span
              class="text-[10px] font-mono transition-all duration-300"
              :style="{ color: activeZoneId === zone.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)' }"
            >
              {{ i + 1 }}
            </span>
          </button>
        </div>
      </nav>

      <!-- Bottom accent -->
      <div class="relative z-10 px-6 pb-8">
        <div class="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <p class="mt-4 text-[10px] text-white/10">New-AI Workspace</p>
      </div>
    </aside>

    <!-- ════════ RIGHT: Content ════════ -->
    <main class="flex flex-1 items-center overflow-y-auto">
      <div class="w-full max-w-2xl px-16 py-20 lg:px-24">
        <Transition name="zone-slide" mode="out-in">
          <div :key="activeZoneId" class="zone-content">
            <!-- Eyebrow -->
            <div
              class="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]"
              :style="{ color: activeZone.color, background: activeZone.color + '08', border: `1px solid ${activeZone.color}12` }"
            >
              <component :is="activeZone.icon" class="h-3 w-3" />
              {{ t(activeZone.nameKey) }}
            </div>

            <!-- Title -->
            <h2
              class="text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-foreground"
              style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
            >
              {{ t(activeZone.nameKey) }}
            </h2>
            <p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground/50">
              {{ t(activeZone.descKey) }}
            </p>

            <!-- Cards -->
            <div class="mt-10 space-y-3">
              <button
                v-for="card in activeZone.cards" :key="card.id"
                class="group flex w-full items-center gap-4 rounded-2xl border border-border/30 bg-card p-5 text-left transition-all duration-500 hover:-translate-y-0.5 hover:border-border/50 hover:shadow-lg"
                style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                @click="uiStore.setCurrentView(card.view as any)"
              >
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-105"
                  :style="{ background: activeZone.color + '0c', border: `1px solid ${activeZone.color}12` }"
                >
                  <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-foreground">{{ t(card.nameKey) }}</div>
                  <div class="mt-0.5 text-xs text-muted-foreground/50">{{ t(card.descKey) }}</div>
                </div>
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/20 transition-all duration-500 group-hover:border-border/40">
                  <svg class="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-500 group-hover:text-foreground/50 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </main>

    <!-- Dialogs -->
    <div v-if="showAIConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="showAIConfig = false">
      <div class="flex h-[80vh] w-[620px] max-w-[95vw] flex-col overflow-hidden rounded-[2rem] border bg-background shadow-2xl">
        <div class="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <span class="text-sm font-semibold">AI 设置</span>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="showAIConfig = false"><X class="h-4 w-4" /></Button>
        </div>
        <div class="flex-1 overflow-y-auto p-5"><AIConfig /></div>
      </div>
    </div>
    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />
  </div>
</template>

<style scoped>
.tb {
  display: flex; height: 2.25rem; align-items: center; gap: 0.375rem;
  border-radius: 9999px; padding: 0 0.75rem; font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card) / 0.8);
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  backdrop-filter: blur(12px);
  outline: 1px solid hsl(var(--border) / 0.4);
  transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.tb:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }

.zone-slide-enter-active { transition: opacity 0.4s cubic-bezier(0.32,0.72,0,1), transform 0.4s cubic-bezier(0.32,0.72,0,1); }
.zone-slide-leave-active { transition: opacity 0.2s cubic-bezier(0.32,0.72,0,1), transform 0.2s cubic-bezier(0.32,0.72,0,1); }
.zone-slide-enter-from { opacity: 0; transform: translateY(16px); }
.zone-slide-leave-to { opacity: 0; transform: translateY(-8px); }

.zone-content button:nth-child(1) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.05s both; }
.zone-content button:nth-child(2) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.12s both; }
.zone-content button:nth-child(3) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.19s both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
