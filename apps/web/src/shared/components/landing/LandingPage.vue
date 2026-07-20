<!-- @workspace shared -->
<script setup lang="ts">
import type { Component } from 'vue'
import { BarChart3, Globe, Lightbulb, Moon, PenLine, Satellite, ScrollText, Settings, Sun, Target, X } from '@lucide/vue'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
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
  color: string
  cards: FunctionCard[]
}

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
    cards: [
      { id: 'radar-feed', nameKey: 'landing.zones.radar.cardFeed', descKey: 'landing.zones.radar.cardFeedDesc', view: 'reading' },
    ],
  },
  {
    id: 'insight', nameKey: 'landing.zones.insight.name', descKey: 'landing.zones.insight.desc',
    icon: Lightbulb, color: '#fbbf24',
    cards: [
      { id: 'insight-board', nameKey: 'landing.zones.insight.cardBoard', descKey: 'landing.zones.insight.cardBoardDesc', view: 'ideaBoard' },
    ],
  },
  {
    id: 'output', nameKey: 'landing.zones.output.name', descKey: 'landing.zones.output.desc',
    icon: PenLine, color: '#34d399',
    cards: [
      { id: 'output-editor', nameKey: 'landing.zones.output.cardEditor', descKey: 'landing.zones.output.cardEditorDesc', view: 'editor' },
    ],
  },
  {
    id: 'report', nameKey: 'landing.zones.report.name', descKey: 'landing.zones.report.desc',
    icon: BarChart3, color: '#fb7185',
    cards: [
      { id: 'report-entry', nameKey: 'landing.zones.report.cardEntry', descKey: 'landing.zones.report.cardEntryDesc', view: 'report' },
    ],
  },
]

const activeZoneId = ref('coach')
const activeZone = computed(() => zones.find(z => z.id === activeZoneId.value) ?? zones[0])

// ── Arc geometry (semicircle, left side) ──────────────────
const CX = 210
const CY = 200
const R = 160
const START = -120
const SPAN = 240

function nodePos(i: number) {
  const deg = START + (i / (zones.length - 1)) * SPAN
  const rad = (deg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

// Full arc path (semicircle)
const arcPath = computed(() => {
  const pts = zones.map((_, i) => nodePos(i))
  // Build a smooth cubic bezier through all 5 points
  return `M ${pts[0].x} ${pts[0].y} C ${pts[1].x - 20} ${pts[1].y - 30}, ${pts[2].x} ${pts[2].y - 40}, ${pts[2].x} ${pts[2].y} S ${pts[3].x + 20} ${pts[3].y + 30}, ${pts[4].x} ${pts[4].y}`
})

// Rotation animation
const rotDeg = ref(0)
let raf = 0
function tick() { rotDeg.value += 0.06; raf = requestAnimationFrame(tick) }
onMounted(() => { raf = requestAnimationFrame(tick) })
onUnmounted(() => cancelAnimationFrame(raf))

// Keyboard shortcuts
function handleKey(e: KeyboardEvent) {
  const idx = Number.parseInt(e.key) - 1
  if (idx >= 0 && idx < zones.length) activeZoneId.value = zones[idx].id
}
onMounted(() => document.addEventListener('keydown', handleKey))
onUnmounted(() => document.removeEventListener('keydown', handleKey))
</script>

<template>
  <div class="relative flex h-[100dvh] overflow-hidden bg-background">
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
      <button class="tb" @click="showChangelog = true">
        <ScrollText class="h-3.5 w-3.5" /> {{ t('changelog.button') }}
      </button>
    </div>

    <!-- ════════ LEFT: Arc Flywheel ════════ -->
    <aside class="left-panel relative flex w-[440px] shrink-0 flex-col items-center justify-center overflow-hidden">
      <!-- Background layers -->
      <div class="absolute inset-0 bg-[#07070f]" />
      <div class="absolute inset-0 opacity-30 transition-all duration-[1.5s]" :style="{ background: `radial-gradient(ellipse at 50% 45%, ${activeZone.color}12, transparent 65%)` }" />

      <!-- Brand -->
      <div class="relative z-10 mb-6 text-center">
        <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/25">
          <span class="inline-block h-1 w-1 rounded-full bg-white/30" />
          {{ t('landing.eyebrow') }}
        </div>
        <h1 class="text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em] text-white/90">
          {{ t('landing.title') }}
        </h1>
        <p class="mt-2 max-w-[240px] text-center text-[11px] leading-relaxed text-white/25">
          {{ t('landing.subtitle') }}
        </p>
      </div>

      <!-- Arc SVG -->
      <svg class="relative z-10" width="420" height="320" viewBox="0 0 420 320" fill="none">
        <!-- Outer arc track (thick, glowing) -->
        <path
          :d="arcPath"
          stroke="url(#arcGrad)"
          stroke-width="2.5"
          stroke-linecap="round"
          fill="none"
          opacity="0.2"
        />
        <!-- Inner dashed orbit -->
        <path
          :d="arcPath"
          stroke="rgba(255,255,255,0.04)"
          stroke-width="1"
          stroke-dasharray="6 8"
          fill="none"
        />
        <!-- Radial lines to center -->
        <line
          v-for="(z, i) in zones" :key="`rl-${z.id}`"
          :x1="nodePos(i).x" :y1="nodePos(i).y"
          :x2="CX" :y2="CY"
          :stroke="activeZoneId === z.id ? z.color + '18' : 'rgba(255,255,255,0.015)'"
          stroke-width="1"
          class="transition-all duration-700"
        />
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#818cf8" />
            <stop offset="25%" stop-color="#60a5fa" />
            <stop offset="50%" stop-color="#fbbf24" />
            <stop offset="75%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#fb7185" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Center hub (rotating) -->
      <div
        class="absolute z-20 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.06] bg-[#0a0a18]"
        :style="{ left: `${CX - 28}px`, top: `${CY - 28}px` }"
      >
        <div
          class="h-7 w-7 rounded-full transition-all duration-1000"
          :style="{
            background: `conic-gradient(from ${rotDeg}deg, ${zones.map((z, i) => `${z.color}35 ${i * 72}deg ${(i + 1) * 72}deg`).join(', ')})`,
            filter: 'blur(1.5px)',
          }"
        />
        <div class="absolute h-3.5 w-3.5 rounded-full bg-[#07070f]" />
      </div>

      <!-- Zone nodes on arc -->
      <button
        v-for="(zone, i) in zones" :key="zone.id"
        class="absolute z-30 flex items-center justify-center rounded-full transition-all duration-500"
        :class="activeZoneId === zone.id ? 'h-14 w-14' : 'h-10 w-10 hover:h-11 hover:w-11'"
        :style="{
          left: `${nodePos(i).x}px`, top: `${nodePos(i).y}px`,
          transform: 'translate(-50%, -50%)',
          background: activeZoneId === zone.id ? `linear-gradient(135deg, ${zone.color}25, ${zone.color}10)` : 'rgba(255,255,255,0.03)',
          border: activeZoneId === zone.id ? `2px solid ${zone.color}70` : '1px solid rgba(255,255,255,0.05)',
          boxShadow: activeZoneId === zone.id ? `0 0 24px ${zone.color}15, 0 0 60px ${zone.color}08` : 'none',
        }"
        @click="activeZoneId = zone.id"
      >
        <component
          :is="zone.icon"
          class="transition-all duration-500"
          :class="activeZoneId === zone.id ? 'h-6 w-6' : 'h-4 w-4'"
          :style="{ color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.25)' }"
        />
        <!-- Pulse ring -->
        <span
          v-if="activeZoneId === zone.id"
          class="absolute inset-0 rounded-full animate-ping opacity-15"
          :style="{ border: `1.5px solid ${zone.color}` }"
        />
      </button>

      <!-- Zone labels below nodes -->
      <div
        v-for="(zone, i) in zones" :key="`lbl-${zone.id}`"
        class="absolute z-30 pointer-events-none text-center transition-all duration-500"
        :style="{
          left: `${nodePos(i).x}px`,
          top: `${nodePos(i).y + (activeZoneId === zone.id ? 36 : 28)}px`,
          transform: 'translateX(-50%)',
        }"
      >
        <div
          class="whitespace-nowrap text-[11px] font-semibold tracking-wide transition-all duration-500"
          :style="{ color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.15)' }"
        >
          {{ t(zone.nameKey) }}
        </div>
      </div>

      <!-- Bottom pills -->
      <div class="relative z-10 mt-4 flex items-center gap-1.5">
        <button
          v-for="zone in zones" :key="`p-${zone.id}`"
          class="h-1 rounded-full transition-all duration-500"
          :class="activeZoneId === zone.id ? 'w-6' : 'w-1.5 hover:w-3'"
          :style="{ background: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.08)', transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }"
          @click="activeZoneId = zone.id"
        />
      </div>
    </aside>

    <!-- ════════ RIGHT: Content ════════ -->
    <main class="flex flex-1 items-center overflow-y-auto">
      <div class="w-full max-w-2xl px-16 py-20 lg:px-24">
        <Transition name="zone-slide" mode="out-in">
          <div :key="activeZoneId" class="zone-content">
            <!-- Eyebrow badge -->
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
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/20 transition-all duration-500 group-hover:border-border/40 group-hover:shadow-sm">
                  <svg class="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-500 group-hover:text-foreground/50 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </div>
              </button>
            </div>

            <!-- Hint -->
            <p class="mt-10 text-[11px] text-muted-foreground/25">
              <kbd class="rounded border border-border/20 bg-muted/20 px-1 py-0.5 text-[10px]">1</kbd>–<kbd class="rounded border border-border/20 bg-muted/20 px-1 py-0.5 text-[10px]">5</kbd>
              切换区域
            </p>
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
/* ─── Toolbar ─── */
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

/* ─── Zone transition ─── */
.zone-slide-enter-active { transition: opacity 0.4s cubic-bezier(0.32,0.72,0,1), transform 0.4s cubic-bezier(0.32,0.72,0,1); }
.zone-slide-leave-active { transition: opacity 0.2s cubic-bezier(0.32,0.72,0,1), transform 0.2s cubic-bezier(0.32,0.72,0,1); }
.zone-slide-enter-from { opacity: 0; transform: translateY(16px); }
.zone-slide-leave-to { opacity: 0; transform: translateY(-8px); }

/* ─── Card stagger ─── */
.zone-content button:nth-child(1) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.05s both; }
.zone-content button:nth-child(2) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.12s both; }
.zone-content button:nth-child(3) { animation: fadeUp 0.5s cubic-bezier(0.32,0.72,0,1) 0.19s both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* ─── Mobile ─── */
@media (max-width: 767px) {
  .left-panel { width: 100% !important; min-height: 340px; }
}
</style>
