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
const flywheelHover = ref(false)

// Keyboard 1-5
function onKey(e: KeyboardEvent) {
  const idx = Number.parseInt(e.key) - 1
  if (idx >= 0 && idx < zones.length) activeZoneId.value = zones[idx].id
}
</script>

<template>
  <div class="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background" @keydown="onKey">
    <!-- ─── Floating toolbar ─── -->
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

    <!-- ─── Title (centered) ─── -->
    <header class="flex flex-col items-center px-4 pt-16 pb-8">
      <div class="mb-4 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground ring-1 ring-border/30">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-foreground/30" />
        {{ t('landing.eyebrow') }}
      </div>
      <h1
        class="text-center text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-foreground"
        style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
      >
        {{ t('landing.title') }}
      </h1>
      <p class="mt-4 max-w-lg text-center text-sm leading-relaxed text-muted-foreground/70 md:text-base">
        {{ t('landing.subtitle') }}
      </p>
    </header>

    <!-- ─── Content: Flywheel (2) + Cards (4) ─── -->
    <div class="flex flex-1 items-start justify-center gap-8 px-8 pb-16">
      <!-- LEFT: Flywheel (2/6) -->
      <div class="w-[360px] shrink-0 pt-4">
        <div
          class="relative mx-auto h-[420px] w-[420px]"
          @mouseenter="flywheelHover = true"
          @mouseleave="flywheelHover = false"
        >
          <!-- Rotating background layer -->
          <div class="flywheel-bg absolute inset-0" :class="{ paused: flywheelHover }">
            <div class="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/6 via-blue-500/6 to-rose-500/6 blur-2xl" />
            <div class="absolute inset-3 rounded-full bg-card/40 shadow-[0_4px_40px_rgba(0,0,0,0.03)] ring-1 ring-border/15 backdrop-blur-sm" />
            <div class="absolute inset-6 rounded-full bg-card shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] ring-1 ring-border/8" />
            <div class="absolute inset-0 rounded-full border border-dashed border-border/15" />
            <!-- Orbit dots -->
            <div
              v-for="i in 20" :key="i"
              class="absolute h-1 w-1 rounded-full bg-border/30"
              :style="{ left: `${50 + 45 * Math.cos((i * 18) * Math.PI / 180)}%`, top: `${50 + 45 * Math.sin((i * 18) * Math.PI / 180)}%` }"
            />
          </div>

          <!-- Static zone items (inside the circle) -->
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-10">
            <button
              v-for="(zone, i) in zones"
              :key="zone.id"
              class="zone-btn group flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-400"
              :class="activeZoneId === zone.id
                ? 'bg-white/10 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1'
                : 'hover:bg-white/[0.04]'"
              :style="{
                ringColor: activeZoneId === zone.id ? zone.color + '30' : 'transparent',
                marginLeft: `${Math.sin(i * 1.2) * 10}px`,
              }"
              @click="activeZoneId = zone.id"
            >
              <!-- Icon -->
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-400"
                :style="{
                  background: activeZoneId === zone.id ? zone.color + '18' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${activeZoneId === zone.id ? zone.color + '25' : 'rgba(0,0,0,0.04)'}`,
                }"
              >
                <component
                  :is="zone.icon"
                  class="h-4 w-4 transition-all duration-400"
                  :style="{ color: activeZoneId === zone.id ? zone.color : 'var(--muted-foreground)' }"
                />
              </div>
              <!-- Text -->
              <div class="flex-1 min-w-0 text-left">
                <div
                  class="text-[13px] font-semibold transition-all duration-400"
                  :style="{ color: activeZoneId === zone.id ? zone.color : 'var(--foreground)' }"
                >
                  {{ t(zone.nameKey) }}
                </div>
                <div class="text-[10px] text-muted-foreground/50 truncate">
                  {{ t(zone.descKey) }}
                </div>
              </div>
              <!-- Arrow -->
              <svg
                class="h-3.5 w-3.5 shrink-0 transition-all duration-400"
                :style="{ color: activeZoneId === zone.id ? zone.color : 'var(--muted-foreground)', opacity: activeZoneId === zone.id ? 0.6 : 0 }"
                viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>

          <!-- Center hub -->
          <div class="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card ring-1 ring-border/10 shadow-sm">
            <div class="h-3 w-3 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      <!-- RIGHT: Active zone cards (4/6) -->
      <div class="flex max-w-xl flex-1 items-center pt-12">
        <div class="w-full">
          <Transition name="zone-fade" mode="out-in">
            <div :key="activeZoneId">
              <!-- Zone header -->
              <div class="mb-6 flex items-center gap-3">
                <div
                  class="flex h-11 w-11 items-center justify-center rounded-xl"
                  :style="{ background: `linear-gradient(135deg, ${activeZone.color}15, ${activeZone.color}08)` }"
                >
                  <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                </div>
                <div>
                  <h2 class="text-lg font-bold text-foreground">{{ t(activeZone.nameKey) }}</h2>
                  <p class="text-xs text-muted-foreground/60">{{ t(activeZone.descKey) }}</p>
                </div>
              </div>

              <!-- Cards -->
              <div class="space-y-3">
                <button
                  v-for="card in activeZone.cards"
                  :key="card.id"
                  class="card-item group flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left ring-1 ring-border/20 transition-all duration-500 hover:-translate-y-0.5 hover:ring-border/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                  style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                  @click="uiStore.setCurrentView(card.view as any)"
                >
                  <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    :style="{ background: activeZone.color + '0c', border: `1px solid ${activeZone.color}12` }"
                  >
                    <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-foreground">{{ t(card.nameKey) }}</div>
                    <div class="mt-0.5 text-xs text-muted-foreground/50">{{ t(card.descKey) }}</div>
                  </div>
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/15 transition-all duration-500 group-hover:border-border/30 group-hover:shadow-sm"
                  >
                    <svg class="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-500 group-hover:text-foreground/50 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

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

/* ─── Flywheel rotation ─── */
.flywheel-bg { animation: spin 40s linear infinite; }
.flywheel-bg.paused { animation-play-state: paused; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Zone fade ─── */
.zone-fade-enter-active { transition: opacity 0.35s cubic-bezier(0.32,0.72,0,1), transform 0.35s cubic-bezier(0.32,0.72,0,1); }
.zone-fade-leave-active { transition: opacity 0.2s cubic-bezier(0.32,0.72,0,1), transform 0.2s cubic-bezier(0.32,0.72,0,1); }
.zone-fade-enter-from { opacity: 0; transform: translateY(12px); }
.zone-fade-leave-to { opacity: 0; transform: translateY(-8px); }

/* ─── Card stagger ─── */
.card-item:nth-child(1) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.05s both; }
.card-item:nth-child(2) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.12s both; }
.card-item:nth-child(3) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.19s both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
