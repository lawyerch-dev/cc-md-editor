<!-- @workspace shared -->
<script setup lang="ts">
import type { Component } from 'vue'
import { BarChart3, Globe, Lightbulb, Moon, PenLine, Satellite, ScrollText, Settings, Sun, Target, X } from '@lucide/vue'
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
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

interface FunctionCard {
  id: string
  nameKey: string
  descKey: string
  view: string
}

interface WorkspaceZone {
  id: string
  nameKey: string
  descKey: string
  icon: Component
  gradientFrom: string
  gradientTo: string
  accentVar: string
  cards: FunctionCard[]
}

const zones: WorkspaceZone[] = [
  {
    id: 'coach',
    nameKey: 'landing.zones.coach.name',
    descKey: 'landing.zones.coach.desc',
    icon: Target,
    gradientFrom: '#818cf8',
    gradientTo: '#6366f1',
    accentVar: '239 68 68',
    cards: [
      { id: 'coach-diag', nameKey: 'landing.zones.coach.cardDiag', descKey: 'landing.zones.coach.cardDiagDesc', view: 'coach' },
      { id: 'coach-goal', nameKey: 'landing.zones.coach.cardGoal', descKey: 'landing.zones.coach.cardGoalDesc', view: 'coach' },
    ],
  },
  {
    id: 'radar',
    nameKey: 'landing.zones.radar.name',
    descKey: 'landing.zones.radar.desc',
    icon: Satellite,
    gradientFrom: '#60a5fa',
    gradientTo: '#3b82f6',
    accentVar: '59 130 246',
    cards: [
      { id: 'radar-feed', nameKey: 'landing.zones.radar.cardFeed', descKey: 'landing.zones.radar.cardFeedDesc', view: 'reading' },
    ],
  },
  {
    id: 'insight',
    nameKey: 'landing.zones.insight.name',
    descKey: 'landing.zones.insight.desc',
    icon: Lightbulb,
    gradientFrom: '#fbbf24',
    gradientTo: '#f59e0b',
    accentVar: '245 158 11',
    cards: [
      { id: 'insight-board', nameKey: 'landing.zones.insight.cardBoard', descKey: 'landing.zones.insight.cardBoardDesc', view: 'ideaBoard' },
    ],
  },
  {
    id: 'output',
    nameKey: 'landing.zones.output.name',
    descKey: 'landing.zones.output.desc',
    icon: PenLine,
    gradientFrom: '#34d399',
    gradientTo: '#10b981',
    accentVar: '16 185 129',
    cards: [
      { id: 'output-editor', nameKey: 'landing.zones.output.cardEditor', descKey: 'landing.zones.output.cardEditorDesc', view: 'editor' },
    ],
  },
  {
    id: 'report',
    nameKey: 'landing.zones.report.name',
    descKey: 'landing.zones.report.desc',
    icon: BarChart3,
    gradientFrom: '#fb7185',
    gradientTo: '#f43f5e',
    accentVar: '244 63 94',
    cards: [
      { id: 'report-entry', nameKey: 'landing.zones.report.cardEntry', descKey: 'landing.zones.report.cardEntryDesc', view: 'report' },
    ],
  },
]

const FLYWHEEL_RADIUS = 120

function flywheelStyle(zone: WorkspaceZone, index: number) {
  const angle = (index * 72 - 90) * (Math.PI / 180)
  const x = Math.cos(angle) * FLYWHEEL_RADIUS
  const y = Math.sin(angle) * FLYWHEEL_RADIUS
  return {
    'left': `calc(50% + ${x}px - 24px)`,
    'top': `calc(50% + ${y}px - 24px)`,
    '--zone-color': zone.gradientFrom,
    'animationDelay': `${index * 0.6}s`,
  }
}

function connectorStyle(index: number) {
  const angle = index * 72 - 90
  return { transform: `rotate(${angle}deg)` }
}

const zoneRefs = ref<HTMLElement[]>([])
const activeZoneId = ref('coach')
const flywheelHover = ref(false)
const activeZone = computed(() => zones.find(z => z.id === activeZoneId.value) ?? zones[0])

function onFlywheelClick(zoneId: string) {
  activeZoneId.value = zoneId
}

onBeforeUnmount(() => {
  // cleanup if needed
})
</script>

<template>
  <div class="relative min-h-[100dvh] overflow-x-hidden bg-background">
    <!-- ─── Floating toolbar ─── -->
    <div class="fixed right-6 top-6 z-40 flex items-center gap-2">
      <button
        class="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3 text-xs text-muted-foreground shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-md ring-1 ring-border/40 transition-all duration-500 hover:bg-accent hover:text-foreground"
        style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </button>
      <button
        class="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3 text-xs text-muted-foreground shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-md ring-1 ring-border/40 transition-all duration-500 hover:bg-accent hover:text-foreground"
        style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
        @click="uiStore.toggleDark()"
      >
        <Sun v-if="uiStore.isDark" class="h-3.5 w-3.5" />
        <Moon v-else class="h-3.5 w-3.5" />
        {{ uiStore.isDark ? t('common.lightMode') : t('common.darkMode') }}
      </button>
      <button
        class="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3 text-xs text-muted-foreground shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-md ring-1 ring-border/40 transition-all duration-500 hover:bg-accent hover:text-foreground"
        style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
        @click="showAIConfig = true"
      >
        <Settings class="h-3.5 w-3.5" />
        AI
      </button>
      <button
        class="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3 text-xs text-muted-foreground shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-md ring-1 ring-border/40 transition-all duration-500 hover:bg-accent hover:text-foreground"
        style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
        @click="showChangelog = true"
      >
        <ScrollText class="h-3.5 w-3.5" />
        {{ t('changelog.button') }}
      </button>
    </div>

    <!-- ─── Main: Left flywheel + Right cards ─── -->
    <div class="flex min-h-[100dvh] items-stretch">
      <!-- LEFT: Title + Flywheel -->
      <aside class="flex w-[480px] shrink-0 flex-col items-center justify-center px-8">
        <!-- Title (moved up) -->
        <div class="mb-6 text-center">
          <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground ring-1 ring-border/30">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-foreground/30" />
            {{ t('landing.eyebrow') }}
          </div>
          <h1 class="text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-foreground" style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif">
            {{ t('landing.title') }}
          </h1>
          <p class="mt-3 max-w-xs text-center text-sm leading-relaxed text-muted-foreground/70">
            {{ t('landing.subtitle') }}
          </p>
        </div>

        <!-- Flywheel -->
        <div
          class="flywheel-container relative h-[320px] w-[320px]"
          :class="{ 'paused': flywheelHover }"
          @mouseenter="flywheelHover = true"
          @mouseleave="flywheelHover = false"
        >
          <!-- Ambient glow -->
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/8 via-blue-500/8 to-rose-500/8 blur-3xl" />
          <!-- Outer ring -->
          <div class="absolute inset-4 rounded-full bg-card/50 shadow-[0_8px_60px_rgba(0,0,0,0.04)] ring-1 ring-border/20 backdrop-blur-sm" />
          <!-- Inner core -->
          <div class="absolute inset-8 rounded-full bg-card shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] ring-1 ring-border/10" />
          <!-- Orbit track -->
          <div class="absolute inset-0 rounded-full border border-dashed border-border/20" />

          <!-- Rotating zone icons -->
          <button
            v-for="(zone, index) in zones"
            :key="zone.id"
            class="flywheel-node absolute flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] ring-1 ring-border/20 transition-all duration-300 hover:scale-110 hover:shadow-[0_6px_30px_rgba(0,0,0,0.1)]"
            :class="{ 'ring-2 scale-110': activeZoneId === zone.id }"
            :style="flywheelStyle(zone, index)"
            @click.stop="onFlywheelClick(zone.id)"
          >
            <component :is="zone.icon" class="h-5 w-5" :style="{ color: zone.gradientFrom }" />
          </button>

          <!-- Connectors -->
          <div
            v-for="(zone, index) in zones"
            :key="`connector-${zone.id}`"
            class="flywheel-connector absolute left-1/2 top-1/2 h-px origin-left"
            :style="connectorStyle(index)"
          >
            <div class="h-px w-20" :style="{ background: `linear-gradient(to right, ${zone.gradientFrom}30, transparent)` }" />
          </div>

          <!-- Center label -->
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <div class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">Flywheel</div>
            <div class="mt-1 text-xs font-bold text-foreground/70">5 Zones</div>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Active zone cards -->
      <main class="flex flex-1 items-center overflow-y-auto">
        <div class="w-full max-w-2xl px-12 py-20 lg:px-20">
          <Transition name="zone-fade" mode="out-in">
            <div :key="activeZoneId">
              <!-- Zone header -->
              <div class="mb-8 flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl" :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }">
                  <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.gradientFrom }" />
                </div>
                <div>
                  <h2 class="text-lg font-bold text-foreground">{{ t(activeZone.nameKey) }}</h2>
                  <p class="text-xs text-muted-foreground/70">{{ t(activeZone.descKey) }}</p>
                </div>
              </div>

              <!-- Cards -->
              <div class="space-y-3">
                <button
                  v-for="card in activeZone.cards"
                  :key="card.id"
                  class="group relative flex w-full items-center rounded-2xl bg-muted/30 p-5 text-left ring-1 ring-border/20 transition-all duration-500 hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:bg-muted/20 dark:hover:bg-muted/30"
                  style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                  @click="uiStore.setCurrentView(card.view as any)"
                >
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }">
                    <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.gradientFrom }" />
                  </div>
                  <div class="ml-4 flex-1">
                    <h3 class="text-sm font-semibold text-foreground">{{ t(card.nameKey) }}</h3>
                    <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground/70">{{ t(card.descKey) }}</p>
                  </div>
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:translate-x-0.5 group-hover:scale-110" :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }">
                    <svg class="h-3.5 w-3.5" :style="{ color: activeZone.gradientFrom }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4.5 11.5L11.5 4.5M11.5 4.5H6M11.5 4.5V10" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </main>
    </div>

    <!-- ─── AI Config Dialog ─── -->
    <div
      v-if="showAIConfig"
      class="ai-config-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="showAIConfig = false"
    >
      <div class="flex h-[80vh] w-[620px] max-w-[95vw] flex-col overflow-hidden rounded-[2rem] border bg-background shadow-2xl">
        <div class="flex shrink-0 items-center justify-between border-b px-6 py-4">
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

    <!-- ─── Changelog Dialog ─── -->
    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

/* ─── Flywheel rotation ─── */
.flywheel-container {
  animation: flywheel-spin 40s linear infinite;
}
.flywheel-container.paused {
  animation-play-state: paused;
}
.flywheel-container.paused .flywheel-node,
.flywheel-container.paused .flywheel-connector {
  animation-play-state: paused;
}

.flywheel-node {
  animation: flywheel-counter-spin 40s linear infinite;
}

.flywheel-connector {
  animation: flywheel-spin 40s linear infinite;
}

@keyframes flywheel-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes flywheel-counter-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}

/* ─── Zone fade transition ─── */
.zone-fade-enter-active {
  transition: opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1), transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.zone-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ─── Zone scroll entry ─── */
.zone-enter {
  opacity: 0;
  transform: translateY(32px) scale(0.97);
  filter: blur(6px);
  animation: zone-reveal 0.9s cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

@keyframes zone-reveal {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

/* ─── Card staggered entry ─── */
.card-enter {
  opacity: 0;
  transform: translateY(16px);
  animation: card-reveal 0.6s cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

@keyframes card-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-enter:nth-child(1) {
  animation-delay: 0.15s;
}
.card-enter:nth-child(2) {
  animation-delay: 0.25s;
}
.card-enter:nth-child(3) {
  animation-delay: 0.35s;
}

/* ─── AI config dialog overrides ─── */
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
