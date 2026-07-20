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
const isMobile = ref(false)

// Flywheel geometry
const FW = 400
const CX = FW / 2
const CY = FW / 2
const R = 150

function nodePos(index: number) {
  const angle = (-90 + index * 72) * (Math.PI / 180)
  return {
    x: CX + R * Math.cos(angle),
    y: CY + R * Math.sin(angle),
  }
}

// Keyboard 1-5
function onKey(e: KeyboardEvent) {
  const idx = Number.parseInt(e.key) - 1
  if (idx >= 0 && idx < zones.length) activeZoneId.value = zones[idx].id
}

// Responsive
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div
    class="landing-root relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background"
    tabindex="0"
    @keydown="onKey"
  >
    <!-- ─── Ethereal background (dark mode only) ─── -->
    <div class="ethereal-bg pointer-events-none fixed inset-0 z-0">
      <div class="absolute inset-0 bg-[#050508]" />
      <!-- Radial mesh gradients -->
      <div class="absolute left-1/4 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-indigo-500/[0.04] blur-[120px]" />
      <div class="absolute right-1/4 bottom-0 h-[500px] w-[500px] translate-x-1/3 translate-y-1/4 rounded-full bg-rose-500/[0.03] blur-[100px]" />
      <div class="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.02] blur-[80px]" />
    </div>

    <!-- ─── Floating toolbar (preserved) ─── -->
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

    <!-- ══════════════════════════════════════════════════ -->
    <!-- LAYER 1: Hero title area                          -->
    <!-- ══════════════════════════════════════════════════ -->
    <header class="relative z-10 flex flex-col items-center px-4 pt-20 pb-16 md:pt-28 md:pb-20">
      <!-- Eyebrow pill -->
      <div class="eyebrow mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.25em]">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400/60" />
        {{ t('landing.eyebrow') }}
      </div>
      <!-- Giant title -->
      <h1
        class="hero-title text-center font-extrabold leading-[0.92] tracking-[-0.04em]"
        style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; font-size: clamp(2.5rem, 5vw, 4rem)"
      >
        {{ t('landing.title') }}
      </h1>
      <!-- Subtitle -->
      <p class="hero-subtitle mt-5 max-w-md text-center text-sm leading-relaxed md:text-base">
        {{ t('landing.subtitle') }}
      </p>
    </header>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- LAYER 2: Flywheel + Cards                         -->
    <!-- ══════════════════════════════════════════════════ -->
    <div class="relative z-10 flex flex-1 flex-col items-start justify-start gap-8 px-8 pb-20 md:flex-row md:items-center md:justify-center">

      <!-- ─── Mobile: horizontal nav ─── -->
      <div v-if="isMobile" class="w-full">
        <div class="mb-6 flex justify-center gap-2 overflow-x-auto pb-2">
          <button
            v-for="zone in zones"
            :key="zone.id"
            class="mobile-zone-btn flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all duration-300"
            :class="activeZoneId === zone.id ? 'active' : ''"
            :style="{ '--zone-color': zone.color }"
            @click="activeZoneId = zone.id"
          >
            <component :is="zone.icon" class="h-3.5 w-3.5" :style="{ color: activeZoneId === zone.id ? zone.color : 'currentColor' }" />
            {{ t(zone.nameKey) }}
          </button>
        </div>
        <!-- Mobile cards -->
        <div class="w-full">
          <Transition name="zone-fade" mode="out-in">
            <div :key="activeZoneId" class="space-y-3">
              <div class="mb-4 flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl" :style="{ background: `${activeZone.color}15` }">
                  <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                </div>
                <div>
                  <h2 class="card-zone-title text-base font-bold">{{ t(activeZone.nameKey) }}</h2>
                  <p class="card-zone-desc text-xs">{{ t(activeZone.descKey) }}</p>
                </div>
              </div>
              <button
                v-for="(card, ci) in activeZone.cards"
                :key="card.id"
                class="card-item group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-500"
                style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                :style="{ animationDelay: `${ci * 80}ms`, '--zone-color': activeZone.color }"
                @click="uiStore.setCurrentView(card.view as any)"
              >
                <!-- Double-Bezel: outer gradient shell -->
                <div class="card-bezel" />
                <!-- Bottom glow line -->
                <div class="card-glow-line" />
                <!-- Content -->
                <div class="relative flex items-center gap-4 p-5">
                  <div class="card-icon-box flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="card-name text-sm font-semibold">{{ t(card.nameKey) }}</div>
                    <div class="card-desc mt-0.5 text-xs">{{ t(card.descKey) }}</div>
                  </div>
                  <!-- Button-in-Button CTA -->
                  <div class="card-cta-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <svg class="h-3.5 w-3.5 transition-all duration-500 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ─── Desktop: Flywheel + Cards side by side ─── -->
      <template v-else>
        <!-- LEFT: Flywheel -->
        <div class="w-[400px] shrink-0">
          <div
            class="flywheel-container relative mx-auto"
            :style="{ width: `${FW}px`, height: `${FW}px` }"
            @mouseenter="flywheelHover = true"
            @mouseleave="flywheelHover = false"
          >
            <!-- Ambient radial glow -->
            <div class="flywheel-ambient" />

            <!-- SVG flywheel -->
            <svg
              class="relative z-10 h-full w-full"
              :viewBox="`0 0 ${FW} ${FW}`"
              fill="none"
            >
              <defs>
                <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="white" stop-opacity="0.08" />
                  <stop offset="100%" stop-color="white" stop-opacity="0" />
                </radialGradient>
                <radialGradient id="centerGlowLight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="black" stop-opacity="0.04" />
                  <stop offset="100%" stop-color="black" stop-opacity="0" />
                </radialGradient>
                <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="nodeGlowActive" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="14" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <!-- Rotating orbit ring -->
              <g class="orbit-ring" :class="{ paused: flywheelHover }">
                <circle
                  :cx="CX" :cy="CY" :r="R"
                  class="orbit-circle"
                  stroke-width="1"
                  stroke-dasharray="6 8"
                />
                <!-- Orbit tick marks -->
                <circle
                  v-for="i in 30" :key="`tick-${i}`"
                  :cx="CX + (R + 8) * Math.cos(i * 12 * Math.PI / 180)"
                  :cy="CY + (R + 8) * Math.sin(i * 12 * Math.PI / 180)"
                  r="0.8"
                  class="orbit-tick"
                />
              </g>

              <!-- Inner decorative ring -->
              <circle
                :cx="CX" :cy="CY" :r="R - 30"
                class="inner-ring"
                stroke-width="0.5"
              />

              <!-- Connection lines (node to center) -->
              <line
                v-for="(zone, i) in zones"
                :key="`line-${zone.id}`"
                :x1="nodePos(i).x"
                :y1="nodePos(i).y"
                :x2="CX"
                :y2="CY"
                class="conn-line"
                :class="{ active: activeZoneId === zone.id }"
                stroke-width="0.5"
                stroke-dasharray="3 4"
              />

              <!-- Center glow -->
              <circle :cx="CX" :cy="CY" r="60" class="center-glow-circle" />

              <!-- Center conic halo (CSS animated) -->
              <foreignObject :x="CX - 24" :y="CY - 24" width="48" height="48">
                <div class="center-halo" :class="{ paused: flywheelHover }" />
              </foreignObject>

              <!-- Center dot -->
              <circle :cx="CX" :cy="CY" r="3" class="center-dot-outer" />
              <circle :cx="CX" :cy="CY" r="1.5" class="center-dot-inner" />

              <!-- Zone nodes -->
              <g
                v-for="(zone, i) in zones"
                :key="`node-${zone.id}`"
                class="node-group cursor-pointer"
                :class="{ active: activeZoneId === zone.id }"
                @click="activeZoneId = zone.id"
              >
                <!-- Node glow background -->
                <circle
                  :cx="nodePos(i).x"
                  :cy="nodePos(i).y"
                  :r="activeZoneId === zone.id ? 28 : 20"
                  :fill="zone.color"
                  :fill-opacity="activeZoneId === zone.id ? 0.15 : 0.06"
                  :filter="activeZoneId === zone.id ? 'url(#nodeGlowActive)' : 'url(#nodeGlow)'"
                  class="node-glow transition-all duration-500"
                  style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                />
                <!-- Node circle bg -->
                <circle
                  :cx="nodePos(i).x"
                  :cy="nodePos(i).y"
                  :r="activeZoneId === zone.id ? 22 : 18"
                  class="node-bg transition-all duration-500"
                  :stroke="zone.color"
                  :stroke-opacity="activeZoneId === zone.id ? 0.5 : 0.15"
                  :stroke-width="activeZoneId === zone.id ? 1.5 : 0.75"
                  style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                />
                <!-- Icon -->
                <foreignObject
                  :x="nodePos(i).x - 10"
                  :y="nodePos(i).y - 10"
                  width="20"
                  height="20"
                  class="pointer-events-none"
                >
                  <div class="flex h-full w-full items-center justify-center">
                    <component
                      :is="zone.icon"
                      class="h-4 w-4 transition-all duration-500"
                      :style="{
                        color: activeZoneId === zone.id ? zone.color : 'var(--node-icon-default)',
                        filter: activeZoneId === zone.id ? `drop-shadow(0 0 6px ${zone.color}60)` : 'none',
                      }"
                    />
                  </div>
                </foreignObject>
                <!-- Label text -->
                <text
                  :x="nodePos(i).x + (i === 0 || i === 1 ? 30 : i === 3 || i === 4 ? -30 : 0)"
                  :y="nodePos(i).y + (i === 2 ? 35 : i === 0 || i === 1 || i === 3 || i === 4 ? 4 : -30)"
                  :text-anchor="i === 3 || i === 4 ? 'end' : i === 0 || i === 1 ? 'start' : 'middle'"
                  :fill="activeZoneId === zone.id ? zone.color : 'var(--node-label-default)'"
                  font-size="11"
                  font-weight="600"
                  class="node-label transition-all duration-500 select-none"
                  style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
                >
                  {{ t(zone.nameKey).split(' ')[0] }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <!-- RIGHT: Active zone cards -->
        <div class="flex max-w-xl flex-1 items-center pt-8">
          <div class="w-full">
            <Transition name="zone-fade" mode="out-in">
              <div :key="activeZoneId">
                <!-- Zone header -->
                <div class="mb-8 flex items-center gap-4">
                  <div
                    class="zone-header-icon flex h-12 w-12 items-center justify-center rounded-2xl"
                    :style="{ '--zone-color': activeZone.color }"
                  >
                    <component :is="activeZone.icon" class="h-6 w-6" :style="{ color: activeZone.color }" />
                  </div>
                  <div>
                    <h2
                      class="card-zone-title text-xl font-bold"
                      style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
                    >
                      {{ t(activeZone.nameKey) }}
                    </h2>
                    <p class="card-zone-desc mt-0.5 text-xs">{{ t(activeZone.descKey) }}</p>
                  </div>
                </div>

                <!-- Cards -->
                <div class="space-y-4">
                  <button
                    v-for="(card, ci) in activeZone.cards"
                    :key="card.id"
                    class="card-item group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-500 hover:-translate-y-0.5"
                    style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                    :style="{ animationDelay: `${ci * 80}ms`, '--zone-color': activeZone.color }"
                    @click="uiStore.setCurrentView(card.view as any)"
                  >
                    <!-- Double-Bezel: outer gradient shell -->
                    <div class="card-bezel" />
                    <!-- Bottom glow line (expands on hover) -->
                    <div class="card-glow-line" />
                    <!-- Hover shadow glow -->
                    <div class="card-hover-shadow" />
                    <!-- Content -->
                    <div class="relative flex items-center gap-5 p-6">
                      <div class="card-icon-box flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                        <component :is="activeZone.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="card-name text-sm font-semibold">{{ t(card.nameKey) }}</div>
                        <div class="card-desc mt-1 text-xs leading-relaxed">{{ t(card.descKey) }}</div>
                      </div>
                      <!-- Button-in-Button CTA -->
                      <div class="card-cta-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                        <svg class="h-4 w-4 transition-all duration-500 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </template>
    </div>

    <!-- Dialogs -->
    <div v-if="showAIConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="showAIConfig = false">
      <div class="dialog-shell flex h-[80vh] w-[620px] max-w-[95vw] flex-col overflow-hidden rounded-[2rem] border shadow-2xl">
        <div class="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <span class="dialog-title text-sm font-semibold">AI 设置</span>
          <Button variant="ghost" size="icon" class="dialog-close-btn h-7 w-7" @click="showAIConfig = false"><X class="h-4 w-4" /></Button>
        </div>
        <div class="flex-1 overflow-y-auto p-5"><AIConfig /></div>
      </div>
    </div>
    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════ */
/* CSS Custom Properties — Dark (default) & Light       */
/* ══════════════════════════════════════════════════════ */

/* ─── Dark mode (default for Ethereal Glass) ─── */
.landing-root {
  --tb-color: rgba(255, 255, 255, 0.35);
  --tb-bg: rgba(255, 255, 255, 0.04);
  --tb-border: rgba(255, 255, 255, 0.06);
  --tb-hover-bg: rgba(255, 255, 255, 0.08);
  --tb-hover-color: rgba(255, 255, 255, 0.7);
  --eyebrow-color: rgba(255, 255, 255, 0.4);
  --eyebrow-bg: rgba(255, 255, 255, 0.03);
  --eyebrow-border: rgba(255, 255, 255, 0.06);
  --title-color: white;
  --subtitle-color: rgba(255, 255, 255, 0.35);
  --orbit-stroke: rgba(255, 255, 255, 0.06);
  --orbit-tick: rgba(255, 255, 255, 0.08);
  --inner-ring-stroke: rgba(255, 255, 255, 0.03);
  --conn-line-default: rgba(255, 255, 255, 0.04);
  --conn-line-active: rgba(255, 255, 255, 0.12);
  --center-glow-fill: url(#centerGlow);
  --center-dot-outer: rgba(255, 255, 255, 0.15);
  --center-dot-inner: rgba(255, 255, 255, 0.4);
  --node-bg-fill: #0a0a12;
  --node-bg-active-fill: #0f0f18;
  --node-icon-default: rgba(255, 255, 255, 0.35);
  --node-label-default: rgba(255, 255, 255, 0.3);
  --zone-title-color: white;
  --zone-desc-color: rgba(255, 255, 255, 0.3);
  --zone-header-icon-bg: linear-gradient(135deg, color-mix(in srgb, var(--zone-color, #818cf8) 15%, transparent), color-mix(in srgb, var(--zone-color, #818cf8) 5%, transparent));
  --card-name-color: rgba(255, 255, 255, 0.9);
  --card-desc-color: rgba(255, 255, 255, 0.25);
  --card-icon-bg: color-mix(in srgb, var(--zone-color, #818cf8) 5%, transparent);
  --card-bezel-from: rgba(255, 255, 255, 0.06);
  --card-bezel-to: rgba(255, 255, 255, 0.02);
  --card-bezel-inner: #0a0a0f;
  --card-cta-border: rgba(255, 255, 255, 0.06);
  --card-cta-color: rgba(255, 255, 255, 0.15);
  --card-cta-hover-border: rgba(255, 255, 255, 0.2);
  --card-cta-hover-bg: rgba(255, 255, 255, 0.04);
  --card-cta-hover-color: rgba(255, 255, 255, 0.5);
  --mobile-btn-bg: rgba(255, 255, 255, 0.03);
  --mobile-btn-color: rgba(255, 255, 255, 0.4);
  --mobile-btn-active-bg: rgba(255, 255, 255, 0.1);
  --mobile-btn-active-color: white;
  --dialog-bg: #0a0a0f;
  --dialog-border: rgba(255, 255, 255, 0.06);
  --dialog-title-color: rgba(255, 255, 255, 0.8);
  --dialog-close-color: rgba(255, 255, 255, 0.4);
}

/* ─── Light mode overrides ─── */
:global(.light) .landing-root,
:global(html:not(.dark)) .landing-root {
  --tb-color: hsl(var(--muted-foreground));
  --tb-bg: hsl(var(--card) / 0.8);
  --tb-border: hsl(var(--border) / 0.4);
  --tb-hover-bg: hsl(var(--accent));
  --tb-hover-color: hsl(var(--foreground));
  --eyebrow-color: hsl(var(--muted-foreground));
  --eyebrow-bg: hsl(var(--muted) / 0.6);
  --eyebrow-border: hsl(var(--border) / 0.3);
  --title-color: hsl(var(--foreground));
  --subtitle-color: hsl(var(--muted-foreground) / 0.7);
  --orbit-stroke: hsl(var(--border) / 0.15);
  --orbit-tick: hsl(var(--border) / 0.3);
  --inner-ring-stroke: hsl(var(--border) / 0.08);
  --conn-line-default: hsl(var(--border) / 0.1);
  --conn-line-active: hsl(var(--border) / 0.25);
  --center-glow-fill: url(#centerGlowLight);
  --center-dot-outer: hsl(var(--muted-foreground) / 0.2);
  --center-dot-inner: hsl(var(--muted-foreground) / 0.4);
  --node-bg-fill: hsl(var(--card));
  --node-bg-active-fill: hsl(var(--card));
  --node-icon-default: hsl(var(--muted-foreground));
  --node-label-default: hsl(var(--muted-foreground) / 0.5);
  --zone-title-color: hsl(var(--foreground));
  --zone-desc-color: hsl(var(--muted-foreground) / 0.6);
  --card-name-color: hsl(var(--foreground));
  --card-desc-color: hsl(var(--muted-foreground) / 0.5);
  --card-bezel-from: hsl(var(--border) / 0.3);
  --card-bezel-to: hsl(var(--border) / 0.1);
  --card-bezel-inner: hsl(var(--card));
  --card-cta-border: hsl(var(--border) / 0.15);
  --card-cta-color: hsl(var(--muted-foreground) / 0.3);
  --card-cta-hover-border: hsl(var(--border) / 0.3);
  --card-cta-hover-bg: hsl(var(--accent) / 0.5);
  --card-cta-hover-color: hsl(var(--foreground) / 0.5);
  --mobile-btn-bg: hsl(var(--muted) / 0.5);
  --mobile-btn-color: hsl(var(--muted-foreground) / 0.6);
  --mobile-btn-active-bg: hsl(var(--accent));
  --mobile-btn-active-color: hsl(var(--foreground));
  --dialog-bg: hsl(var(--background));
  --dialog-border: hsl(var(--border));
  --dialog-title-color: hsl(var(--foreground));
  --dialog-close-color: hsl(var(--muted-foreground));
}

/* Hide ethereal background in light mode */
:global(html:not(.dark)) .ethereal-bg {
  display: none;
}

/* ══════════════════════════════════════════════════════ */
/* Toolbar                                               */
/* ══════════════════════════════════════════════════════ */
.tb {
  display: flex; height: 2.25rem; align-items: center; gap: 0.375rem;
  border-radius: 9999px; padding: 0 0.75rem; font-size: 0.75rem;
  color: var(--tb-color);
  background: var(--tb-bg);
  border: 1px solid var(--tb-border);
  transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  backdrop-filter: blur(12px);
}
.tb:hover {
  background: var(--tb-hover-bg);
  color: var(--tb-hover-color);
}

/* ══════════════════════════════════════════════════════ */
/* Hero Section                                          */
/* ══════════════════════════════════════════════════════ */
.eyebrow {
  color: var(--eyebrow-color);
  background: var(--eyebrow-bg);
  border: 1px solid var(--eyebrow-border);
  backdrop-filter: blur(8px);
}
.hero-title {
  color: var(--title-color);
}
.hero-subtitle {
  color: var(--subtitle-color);
}

/* ══════════════════════════════════════════════════════ */
/* Flywheel                                              */
/* ══════════════════════════════════════════════════════ */
.flywheel-ambient {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(99, 102, 241, 0.04) 0%,
    rgba(59, 130, 246, 0.02) 40%,
    transparent 70%
  );
  filter: blur(60px);
}

/* Orbit ring */
.orbit-ring {
  transform-origin: 200px 200px;
  animation: orbit-spin 40s linear infinite;
}
.orbit-ring.paused {
  animation-play-state: paused;
}
@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}
.orbit-circle {
  stroke: var(--orbit-stroke);
}
.orbit-tick {
  fill: var(--orbit-tick);
}
.inner-ring {
  stroke: var(--inner-ring-stroke);
}

/* Connection lines */
.conn-line {
  stroke: var(--conn-line-default);
  transition: stroke-opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.conn-line.active {
  stroke: var(--conn-line-active);
}

/* Center */
.center-glow-circle {
  fill: var(--center-glow-fill);
}
.center-dot-outer {
  fill: var(--center-dot-outer);
}
.center-dot-inner {
  fill: var(--center-dot-inner);
}
.center-halo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(129, 140, 248, 0.2) 60deg,
    rgba(96, 165, 250, 0.15) 120deg,
    rgba(251, 191, 36, 0.1) 180deg,
    rgba(52, 211, 153, 0.15) 240deg,
    rgba(251, 113, 133, 0.2) 300deg,
    transparent 360deg
  );
  animation: halo-spin 12s linear infinite;
  opacity: 0.6;
}
.center-halo.paused {
  animation-play-state: paused;
}
@keyframes halo-spin {
  to { transform: rotate(360deg); }
}

/* Nodes */
.node-bg {
  fill: var(--node-bg-fill);
}
.node-group.active .node-bg {
  fill: var(--node-bg-active-fill);
}
.node-group {
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.node-group:hover .node-glow {
  fill-opacity: 0.12;
}

/* ══════════════════════════════════════════════════════ */
/* Cards                                                 */
/* ══════════════════════════════════════════════════════ */
.zone-header-icon {
  background: var(--zone-header-icon-bg);
}
.card-zone-title {
  color: var(--zone-title-color);
}
.card-zone-desc {
  color: var(--zone-desc-color);
}
.card-name {
  color: var(--card-name-color);
}
.card-desc {
  color: var(--card-desc-color);
}
.card-icon-box {
  background: color-mix(in srgb, var(--zone-color, #818cf8) 5%, transparent);
}

/* Double-Bezel */
.card-bezel {
  position: absolute;
  inset: 0;
  border-radius: 1rem;
  background: linear-gradient(to bottom, var(--card-bezel-from), var(--card-bezel-to));
  padding: 1px;
}
.card-bezel::after {
  content: '';
  display: block;
  height: 100%;
  width: 100%;
  border-radius: 15px;
  background: var(--card-bezel-inner);
}

/* Bottom glow line */
.card-glow-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  height: 1px;
  width: 0;
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, var(--zone-color, #818cf8), transparent);
  opacity: 0.4;
  transition: width 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.card-item:hover .card-glow-line {
  width: 75%;
}

/* Hover shadow */
.card-hover-shadow {
  position: absolute;
  inset: 0;
  border-radius: 1rem;
  opacity: 0;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.card-item:hover .card-hover-shadow {
  opacity: 1;
}

/* CTA button */
.card-cta-btn {
  border: 1px solid var(--card-cta-border);
  color: var(--card-cta-color);
  transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.card-item:hover .card-cta-btn {
  border-color: var(--card-cta-hover-border);
  background: var(--card-cta-hover-bg);
  color: var(--card-cta-hover-color);
}

/* Mobile zone buttons */
.mobile-zone-btn {
  background: var(--mobile-btn-bg);
  color: var(--mobile-btn-color);
  border: 1px solid transparent;
}
.mobile-zone-btn.active {
  background: var(--mobile-btn-active-bg);
  color: var(--mobile-btn-active-color);
  border-color: color-mix(in srgb, var(--zone-color, #818cf8) 40%, transparent);
}

/* Dialog */
.dialog-shell {
  background: var(--dialog-bg);
  border-color: var(--dialog-border);
}
.dialog-title {
  color: var(--dialog-title-color);
}
.dialog-close-btn {
  color: var(--dialog-close-color);
}

/* ══════════════════════════════════════════════════════ */
/* Transitions & Animations                              */
/* ══════════════════════════════════════════════════════ */

/* Zone fade transition */
.zone-fade-enter-active {
  transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-fade-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.zone-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Card staggered fade-up */
.card-item {
  animation: card-fadeUp 0.6s cubic-bezier(0.32, 0.72, 0, 1) both;
}
@keyframes card-fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
