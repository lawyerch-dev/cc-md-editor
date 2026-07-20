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

const activeZoneId = ref('coach')
const activeZone = computed(() => zones.find(z => z.id === activeZoneId.value) ?? zones[0])

/** Arc geometry for desktop: 5 nodes along a vertical arc */
const ARC_CENTER_X = 50 // percent
const ARC_CENTER_Y = 50 // percent
const ARC_RADIUS = 38 // percent of container
const ARC_SPAN_DEG = 120 // total arc span in degrees
const ARC_START_DEG = -90 - ARC_SPAN_DEG / 2 // start from top

interface ArcPos { x: number, y: number }

function arcPos(index: number): ArcPos {
  const angleDeg = ARC_START_DEG + (index / (zones.length - 1)) * ARC_SPAN_DEG
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: ARC_CENTER_X + ARC_RADIUS * Math.cos(angleRad),
    y: ARC_CENTER_Y + ARC_RADIUS * Math.sin(angleRad),
  }
}

function arcNodeStyle(index: number) {
  const { x, y } = arcPos(index)
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function arcLabelStyle(index: number) {
  const { x, y } = arcPos(index)
  // Labels on the left side of the arc go to the left, right side go to the right
  const offsetX = index <= 1 ? 42 : -42
  return {
    left: `calc(${x}% + ${offsetX}px)`,
    top: `${y}%`,
    transform: 'translateY(-50%)',
  }
}

/** SVG arc path through all 5 nodes */
const arcPathD = computed(() => {
  const pts = zones.map((_, i) => {
    const angleDeg = ARC_START_DEG + (i / (zones.length - 1)) * ARC_SPAN_DEG
    const angleRad = (angleDeg * Math.PI) / 180
    return {
      x: ARC_CENTER_X + ARC_RADIUS * Math.cos(angleRad),
      y: ARC_CENTER_Y + ARC_RADIUS * Math.sin(angleRad),
    }
  })
  // Quadratic bezier through 3 control points for a smooth arc
  return `M ${pts[0].x} ${pts[0].y} Q ${pts[2].x} ${pts[2].y - 8} ${pts[4].x} ${pts[4].y}`
})
</script>

<template>
  <div class="relative min-h-[100dvh] overflow-x-hidden bg-background">
    <!-- ─── Floating toolbar (unchanged) ─── -->
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

    <!-- ─── Desktop: split layout ─── -->
    <div class="hidden min-h-[100dvh] md:flex">
      <!-- LEFT: Flywheel arc -->
      <aside class="relative flex w-[38%] shrink-0 flex-col items-center justify-center overflow-hidden">
        <!-- Subtle gradient background -->
        <div class="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/10 to-transparent" />
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(129,140,248,0.06),transparent_70%)]" />

        <!-- Eyebrow + title -->
        <div class="relative z-10 mb-10 text-center">
          <div class="mb-4 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground ring-1 ring-border/30">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-foreground/30" />
            {{ t('landing.eyebrow') }}
          </div>
          <h1
            class="text-[clamp(1.8rem,3.5vw,3rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-foreground"
            style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
          >
            {{ t('landing.title') }}
          </h1>
          <p class="mt-3 max-w-xs text-center text-sm leading-relaxed text-muted-foreground/70">
            {{ t('landing.subtitle') }}
          </p>
        </div>

        <!-- Arc flywheel -->
        <div class="arc-flywheel relative h-[340px] w-[340px]">
          <!-- SVG arc track -->
          <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" fill="none">
            <path
              :d="arcPathD"
              class="arc-path stroke-border/20"
              stroke-width="0.4"
              stroke-dasharray="2 2"
              fill="none"
            />
          </svg>

          <!-- Ambient glow behind active node -->
          <div
            class="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-all duration-700"
            :style="{
              ...arcNodeStyle(zones.indexOf(activeZone)),
              background: `radial-gradient(circle, ${activeZone.gradientFrom}18, transparent)`,
            }"
          />

          <!-- Zone nodes -->
          <button
            v-for="(zone, index) in zones"
            :key="zone.id"
            class="arc-node absolute z-10 flex items-center justify-center rounded-full transition-all duration-500"
            :class="activeZoneId === zone.id ? 'h-14 w-14' : 'h-11 w-11 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]'"
            :style="{
              ...arcNodeStyle(index),
              background: activeZoneId === zone.id
                ? `linear-gradient(135deg, ${zone.gradientFrom}20, ${zone.gradientTo}10)`
                : 'var(--card)',
              boxShadow: activeZoneId === zone.id
                ? `0 4px 24px rgba(0,0,0,0.08), inset 0 0 0 2px ${zone.gradientFrom}`
                : '0 2px 12px rgba(0,0,0,0.04), inset 0 0 0 1px var(--border)',
            }"
            @click="activeZoneId = zone.id"
          >
            <component
              :is="zone.icon"
              class="transition-all duration-500"
              :class="activeZoneId === zone.id ? 'h-6 w-6' : 'h-5 w-5'"
              :style="{ color: activeZoneId === zone.id ? zone.gradientFrom : 'var(--muted-foreground)' }"
            />
            <!-- Active indicator dot -->
            <span
              v-if="activeZoneId === zone.id"
              class="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              :style="{ background: zone.gradientFrom }"
            />
          </button>

          <!-- Zone labels (visible for active) -->
          <div
            v-for="(zone, index) in zones"
            :key="`label-${zone.id}`"
            class="arc-label pointer-events-none absolute z-20 transition-all duration-500"
            :style="arcLabelStyle(index)"
          >
            <div
              class="whitespace-nowrap text-[11px] font-medium transition-all duration-500"
              :class="activeZoneId === zone.id ? 'opacity-100 text-foreground' : 'opacity-0'"
            >
              {{ t(zone.nameKey) }}
            </div>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Active zone content -->
      <main class="flex flex-1 flex-col justify-center overflow-y-auto px-12 py-20 lg:px-20">
        <Transition name="zone-fade" mode="out-in">
          <div :key="activeZoneId" class="zone-content">
            <!-- Zone header -->
            <div class="mb-8 flex items-center gap-4">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-2xl"
                :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }"
              >
                <component :is="activeZone.icon" class="h-6 w-6" :style="{ color: activeZone.gradientFrom }" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-foreground">
                  {{ t(activeZone.nameKey) }}
                </h2>
                <p class="text-sm text-muted-foreground/70">
                  {{ t(activeZone.descKey) }}
                </p>
              </div>
            </div>

            <!-- Function cards -->
            <div class="grid gap-4" :class="activeZone.cards.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1 max-w-md'">
              <button
                v-for="card in activeZone.cards"
                :key="card.id"
                class="card-enter group relative flex flex-col rounded-2xl p-5 text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
                style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                @click="uiStore.setCurrentView(card.view as any)"
              >
                <!-- Double-Bezel outer -->
                <div
                  class="absolute inset-0 rounded-2xl p-[2px]"
                  :style="{
                    background: `linear-gradient(135deg, ${activeZone.gradientFrom}15, ${activeZone.gradientTo}08)`,
                  }"
                />
                <!-- Double-Bezel inner -->
                <div class="relative rounded-[calc(1rem-2px)] bg-card p-5 ring-1 ring-border/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 pr-3">
                      <h3 class="text-base font-semibold text-foreground">
                        {{ t(card.nameKey) }}
                      </h3>
                      <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground/70">
                        {{ t(card.descKey) }}
                      </p>
                    </div>
                    <!-- CTA arrow -->
                    <div
                      class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-110"
                      :style="{
                        background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)`,
                        transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
                      }"
                    >
                      <svg
                        class="h-4 w-4 transition-transform duration-500"
                        :style="{ color: activeZone.gradientFrom, transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M4.5 11.5L11.5 4.5M11.5 4.5H6M11.5 4.5V10" />
                      </svg>
                    </div>
                  </div>

                  <!-- Bottom accent line -->
                  <div
                    class="mt-4 h-px w-0 transition-all duration-700 group-hover:w-full"
                    :style="{
                      background: `linear-gradient(to right, ${activeZone.gradientFrom}40, transparent)`,
                      transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
                    }"
                  />
                </div>
              </button>
            </div>

            <!-- Zone indicator pills -->
            <div class="mt-10 flex items-center gap-2">
              <button
                v-for="zone in zones"
                :key="`pill-${zone.id}`"
                class="h-1.5 rounded-full transition-all duration-500"
                :class="activeZoneId === zone.id ? 'w-6' : 'w-1.5 hover:w-3'"
                :style="{
                  background: activeZoneId === zone.id ? zone.gradientFrom : 'var(--border)',
                  transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
                }"
                @click="activeZoneId = zone.id"
              />
            </div>
          </div>
        </Transition>
      </main>
    </div>

    <!-- ─── Mobile: stacked layout ─── -->
    <div class="flex min-h-[100dvh] flex-col md:hidden">
      <!-- Mobile header -->
      <div class="px-4 pb-4 pt-20 text-center">
        <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground ring-1 ring-border/30">
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-foreground/30" />
          {{ t('landing.eyebrow') }}
        </div>
        <h1
          class="text-[clamp(2rem,8vw,3.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-foreground"
          style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
        >
          {{ t('landing.title') }}
        </h1>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground/70">
          {{ t('landing.subtitle') }}
        </p>
      </div>

      <!-- Mobile horizontal zone nav -->
      <div class="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
        <div class="flex items-center gap-1 overflow-x-auto px-4 py-3 scrollbar-none">
          <button
            v-for="zone in zones"
            :key="`mobile-${zone.id}`"
            class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300"
            :class="activeZoneId === zone.id
              ? 'shadow-sm ring-1'
              : 'text-muted-foreground hover:text-foreground'"
            :style="{
              background: activeZoneId === zone.id ? `${zone.gradientFrom}15` : 'transparent',
              ringColor: activeZoneId === zone.id ? `${zone.gradientFrom}40` : 'transparent',
            }"
            @click="activeZoneId = zone.id"
          >
            <component
              :is="zone.icon"
              class="h-3.5 w-3.5"
              :style="{ color: activeZoneId === zone.id ? zone.gradientFrom : undefined }"
            />
            {{ t(zone.nameKey).split(' ')[0] }}
          </button>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="flex-1 px-4 pb-16 pt-4">
        <Transition name="zone-fade" mode="out-in">
          <div :key="activeZoneId">
            <!-- Zone header -->
            <div class="mb-5 flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl"
                :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }"
              >
                <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.gradientFrom }" />
              </div>
              <div>
                <h2 class="text-base font-bold text-foreground">
                  {{ t(activeZone.nameKey) }}
                </h2>
                <p class="text-xs text-muted-foreground/70">
                  {{ t(activeZone.descKey) }}
                </p>
              </div>
            </div>

            <!-- Cards -->
            <div class="grid gap-3">
              <button
                v-for="card in activeZone.cards"
                :key="card.id"
                class="group relative flex flex-col rounded-2xl p-4 text-left transition-all duration-500 active:scale-[0.98]"
                style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                @click="uiStore.setCurrentView(card.view as any)"
              >
                <!-- Double-Bezel outer -->
                <div
                  class="absolute inset-0 rounded-2xl p-[2px]"
                  :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}15, ${activeZone.gradientTo}08)` }"
                />
                <div class="relative rounded-[calc(1rem-2px)] bg-card p-4 ring-1 ring-border/10">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 pr-2">
                      <h3 class="text-sm font-semibold text-foreground">
                        {{ t(card.nameKey) }}
                      </h3>
                      <p class="mt-1 text-xs leading-relaxed text-muted-foreground/70">
                        {{ t(card.descKey) }}
                      </p>
                    </div>
                    <div
                      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      :style="{ background: `linear-gradient(135deg, ${activeZone.gradientFrom}20, ${activeZone.gradientTo}10)` }"
                    >
                      <svg
                        class="h-3.5 w-3.5"
                        :style="{ color: activeZone.gradientFrom }"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M4.5 11.5L11.5 4.5M11.5 4.5H6M11.5 4.5V10" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <!-- Zone pills -->
            <div class="mt-8 flex items-center justify-center gap-2">
              <button
                v-for="zone in zones"
                :key="`mpill-${zone.id}`"
                class="h-1.5 rounded-full transition-all duration-500"
                :class="activeZoneId === zone.id ? 'w-6' : 'w-1.5'"
                :style="{ background: activeZoneId === zone.id ? zone.gradientFrom : 'var(--border)' }"
                @click="activeZoneId = zone.id"
              />
            </div>
          </div>
        </Transition>
      </div>
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

/* ─── Arc flywheel subtle pulse ─── */
.arc-flywheel {
  animation: arc-breathe 8s ease-in-out infinite;
}

@keyframes arc-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.015);
  }
}

/* ─── Arc nodes gentle float ─── */
.arc-node {
  animation: node-float 6s ease-in-out infinite;
}

.arc-node:nth-child(2) {
  animation-delay: 0.4s;
}
.arc-node:nth-child(3) {
  animation-delay: 0.8s;
}
.arc-node:nth-child(4) {
  animation-delay: 1.2s;
}
.arc-node:nth-child(5) {
  animation-delay: 1.6s;
}
.arc-node:nth-child(6) {
  animation-delay: 2s;
}

@keyframes node-float {
  0%,
  100% {
    transform: translate(-50%, -50%) translateY(0);
  }
  50% {
    transform: translate(-50%, -50%) translateY(-3px);
  }
}

/* ─── Arc path dash animation ─── */
.arc-path {
  animation: dash-flow 20s linear infinite;
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -40;
  }
}

/* ─── Zone content transitions ─── */
.zone-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.zone-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.zone-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.zone-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ─── Card entry animation ─── */
.card-enter {
  opacity: 0;
  transform: translateY(16px);
  animation: card-reveal 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

@keyframes card-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-enter:nth-child(1) {
  animation-delay: 0.08s;
}
.card-enter:nth-child(2) {
  animation-delay: 0.16s;
}
.card-enter:nth-child(3) {
  animation-delay: 0.24s;
}

/* ─── Hide scrollbar on mobile nav ─── */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
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
