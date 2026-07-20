<!-- @workspace shared -->
<script setup lang="ts">
import type { Component } from 'vue'
import { BarChart3, Globe, Lightbulb, Moon, PenLine, Satellite, ScrollText, Settings, Sun, Target, X } from '@lucide/vue'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
  icon: Component
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
    id: 'coach',
    nameKey: 'landing.zones.coach.name',
    descKey: 'landing.zones.coach.desc',
    icon: Target,
    color: '#818cf8',
    cards: [
      { id: 'coach-diag', nameKey: 'landing.zones.coach.cardDiag', descKey: 'landing.zones.coach.cardDiagDesc', view: 'coach', icon: Target },
      { id: 'coach-goal', nameKey: 'landing.zones.coach.cardGoal', descKey: 'landing.zones.coach.cardGoalDesc', view: 'coach', icon: Target },
    ],
  },
  {
    id: 'radar',
    nameKey: 'landing.zones.radar.name',
    descKey: 'landing.zones.radar.desc',
    icon: Satellite,
    color: '#60a5fa',
    cards: [
      { id: 'radar-feed', nameKey: 'landing.zones.radar.cardFeed', descKey: 'landing.zones.radar.cardFeedDesc', view: 'reading', icon: Satellite },
    ],
  },
  {
    id: 'insight',
    nameKey: 'landing.zones.insight.name',
    descKey: 'landing.zones.insight.desc',
    icon: Lightbulb,
    color: '#fbbf24',
    cards: [
      { id: 'insight-board', nameKey: 'landing.zones.insight.cardBoard', descKey: 'landing.zones.insight.cardBoardDesc', view: 'ideaBoard', icon: Lightbulb },
    ],
  },
  {
    id: 'output',
    nameKey: 'landing.zones.output.name',
    descKey: 'landing.zones.output.desc',
    icon: PenLine,
    color: '#34d399',
    cards: [
      { id: 'output-editor', nameKey: 'landing.zones.output.cardEditor', descKey: 'landing.zones.output.cardEditorDesc', view: 'editor', icon: PenLine },
    ],
  },
  {
    id: 'report',
    nameKey: 'landing.zones.report.name',
    descKey: 'landing.zones.report.desc',
    icon: BarChart3,
    color: '#fb7185',
    cards: [
      { id: 'report-entry', nameKey: 'landing.zones.report.cardEntry', descKey: 'landing.zones.report.cardEntryDesc', view: 'report', icon: BarChart3 },
    ],
  },
]

const activeZoneId = ref('coach')
const activeZone = computed(() => zones.find(z => z.id === activeZoneId.value) ?? zones[0])
const activeZoneIndex = computed(() => zones.findIndex(z => z.id === activeZoneId.value))

// ── Arc geometry ──────────────────────────────────────────
const ARC_RADIUS = 150
const ARC_CENTER_X = 170
const ARC_CENTER_Y = 180
const ARC_START_DEG = -80
const ARC_SPAN_DEG = 160

function arcNodePos(index: number) {
  const angleDeg = ARC_START_DEG + (index / (zones.length - 1)) * ARC_SPAN_DEG
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: ARC_CENTER_X + ARC_RADIUS * Math.cos(angleRad),
    y: ARC_CENTER_Y + ARC_RADIUS * Math.sin(angleRad),
  }
}

// ── Flywheel rotation ──────────────────────────────────────
const rotationDeg = ref(0)
let animFrame = 0

function animateFlywheel() {
  rotationDeg.value += 0.08
  animFrame = requestAnimationFrame(animateFlywheel)
}

onMounted(() => { animFrame = requestAnimationFrame(animateFlywheel) })
onUnmounted(() => { cancelAnimationFrame(animFrame) })

// ── Intersection observer for scroll entry ──────────────────
const pageRef = ref<HTMLElement | null>(null)
</script>

<template>
  <div ref="pageRef" class="relative flex h-[100dvh] overflow-hidden bg-background">
    <!-- ─── Floating toolbar (top-right, unchanged) ─── -->
    <div class="fixed right-6 top-6 z-40 flex items-center gap-2">
      <button
        class="toolbar-btn"
        @click="localeStore.setLocale(localeStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ localeStore.locale === 'zh-CN' ? '中文' : 'EN' }}
      </button>
      <button class="toolbar-btn" @click="uiStore.toggleDark()">
        <Sun v-if="uiStore.isDark" class="h-3.5 w-3.5" />
        <Moon v-else class="h-3.5 w-3.5" />
        {{ uiStore.isDark ? t('common.lightMode') : t('common.darkMode') }}
      </button>
      <button class="toolbar-btn" @click="showAIConfig = true">
        <Settings class="h-3.5 w-3.5" />
        AI
      </button>
      <button class="toolbar-btn" @click="showChangelog = true">
        <ScrollText class="h-3.5 w-3.5" />
        {{ t('changelog.button') }}
      </button>
    </div>

    <!-- ─── LEFT PANEL: Dark flywheel ─── -->
    <aside class="left-panel relative flex w-[420px] shrink-0 flex-col items-center justify-center overflow-hidden">
      <!-- Deep gradient background -->
      <div class="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d0d24] to-[#08081a]" />
      <!-- Mesh gradient glow -->
      <div
        class="absolute inset-0 opacity-40 transition-all duration-1000"
        :style="{
          background: `radial-gradient(ellipse at 50% 50%, ${activeZone.color}15, transparent 70%)`,
        }"
      />
      <!-- Grain texture -->
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E');" />

      <!-- Brand -->
      <div class="relative z-10 mb-8 text-center">
        <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/30">
          <span class="inline-block h-1 w-1 rounded-full bg-white/40" />
          {{ t('landing.eyebrow') }}
        </div>
        <h1 class="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white/90">
          {{ t('landing.title') }}
        </h1>
        <p class="mt-2 max-w-[260px] text-center text-xs leading-relaxed text-white/30">
          {{ t('landing.subtitle') }}
        </p>
      </div>

      <!-- SVG Arc Flywheel -->
      <div class="relative" style="width: 340px; height: 340px;">
        <svg class="absolute inset-0 h-full w-full" viewBox="0 0 340 360" fill="none">
          <!-- Orbit track -->
          <path
            :d="`M ${arcNodePos(0).x} ${arcNodePos(0).y} Q ${ARC_CENTER_X} ${ARC_CENTER_Y - 20} ${arcNodePos(4).x} ${arcNodePos(4).y}`"
            class="stroke-white/[0.06]"
            stroke-width="1"
            stroke-dasharray="4 4"
            fill="none"
          />
          <!-- Connecting lines to center -->
          <line
            v-for="(zone, i) in zones"
            :key="`line-${zone.id}`"
            :x1="arcNodePos(i).x"
            :y1="arcNodePos(i).y"
            :x2="ARC_CENTER_X"
            :y2="ARC_CENTER_Y"
            class="transition-all duration-700"
            :stroke="activeZoneId === zone.id ? zone.color + '30' : 'rgba(255,255,255,0.03)'"
            stroke-width="1"
            stroke-dasharray="2 4"
          />
        </svg>

        <!-- Center hub -->
        <div
          class="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm"
          :style="{ left: `${ARC_CENTER_X - 32}px`, top: `${ARC_CENTER_Y - 32}px` }"
        >
          <div
            class="h-8 w-8 rounded-full transition-all duration-1000"
            :style="{
              background: `conic-gradient(from ${rotationDeg}deg, ${zones.map((z, i) => `${z.color}40 ${i * 72}deg ${(i + 1) * 72}deg`).join(', ')})`,
              filter: 'blur(1px)',
            }"
          />
          <div class="absolute h-4 w-4 rounded-full bg-[#0d0d24]" />
        </div>

        <!-- Zone nodes on arc -->
        <button
          v-for="(zone, index) in zones"
          :key="zone.id"
          class="absolute z-20 flex items-center justify-center rounded-full transition-all duration-500"
          :class="activeZoneId === zone.id
            ? 'h-12 w-12 shadow-[0_0_30px_rgba(255,255,255,0.06)]'
            : 'h-9 w-9 hover:h-10 hover:w-10'"
          :style="{
            left: `${arcNodePos(index).x - (activeZoneId === zone.id ? 24 : 18)}px`,
            top: `${arcNodePos(index).y - (activeZoneId === zone.id ? 24 : 18)}px`,
            background: activeZoneId === zone.id
              ? `linear-gradient(135deg, ${zone.color}30, ${zone.color}15)`
              : 'rgba(255,255,255,0.04)',
            border: activeZoneId === zone.id
              ? `1.5px solid ${zone.color}60`
              : '1px solid rgba(255,255,255,0.06)',
          }"
          @click="activeZoneId = zone.id"
        >
          <component
            :is="zone.icon"
            class="transition-all duration-500"
            :class="activeZoneId === zone.id ? 'h-5 w-5' : 'h-4 w-4'"
            :style="{ color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.3)' }"
          />
          <!-- Active ring pulse -->
          <span
            v-if="activeZoneId === zone.id"
            class="absolute inset-0 rounded-full animate-ping opacity-20"
            :style="{ border: `1px solid ${zone.color}` }"
          />
        </button>

        <!-- Zone labels -->
        <div
          v-for="(zone, index) in zones"
          :key="`label-${zone.id}`"
          class="absolute z-30 pointer-events-none transition-all duration-500"
          :style="{
            left: `${arcNodePos(index).x}px`,
            top: `${arcNodePos(index).y + (activeZoneId === zone.id ? 30 : 24)}px`,
            transform: 'translateX(-50%)',
          }"
        >
          <span
            class="whitespace-nowrap text-[10px] font-medium tracking-wide transition-all duration-500"
            :style="{
              color: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.2)',
            }"
          >
            {{ t(zone.nameKey) }}
          </span>
        </div>
      </div>

      <!-- Zone switcher pills (bottom) -->
      <div class="relative z-10 mt-6 flex items-center gap-1.5">
        <button
          v-for="zone in zones"
          :key="`pill-${zone.id}`"
          class="h-1 rounded-full transition-all duration-500"
          :class="activeZoneId === zone.id ? 'w-5' : 'w-1.5 hover:w-3'"
          :style="{
            background: activeZoneId === zone.id ? zone.color : 'rgba(255,255,255,0.1)',
            transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          }"
          @click="activeZoneId = zone.id"
        />
      </div>
    </aside>

    <!-- ─── RIGHT PANEL: Content ─── -->
    <main class="flex flex-1 items-center justify-center overflow-y-auto">
      <div class="w-full max-w-2xl px-12 py-16 lg:px-20">
        <Transition name="zone-slide" mode="out-in">
          <div :key="activeZoneId" class="zone-content">
            <!-- Zone header -->
            <div class="mb-10">
              <div class="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]"
                :style="{ color: activeZone.color, background: activeZone.color + '08', border: `1px solid ${activeZone.color}15` }"
              >
                <component :is="activeZone.icon" class="h-3 w-3" />
                {{ t(activeZone.nameKey) }}
              </div>
              <h2 class="text-3xl font-extrabold tracking-tight text-foreground"
                style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
              >
                {{ t(activeZone.nameKey) }}
              </h2>
              <p class="mt-2 text-base text-muted-foreground/60">
                {{ t(activeZone.descKey) }}
              </p>
            </div>

            <!-- Function cards -->
            <div class="space-y-4">
              <button
                v-for="(card, cardIndex) in activeZone.cards"
                :key="card.id"
                class="group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-500 hover:-translate-y-0.5"
                style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
                @click="uiStore.setCurrentView(card.view as any)"
              >
                <!-- Card outer glow on hover -->
                <div
                  class="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  :style="{ boxShadow: `0 8px 40px ${activeZone.color}10, 0 0 0 1px ${activeZone.color}15` }"
                />
                <!-- Card body -->
                <div class="relative flex items-center gap-5 rounded-2xl border border-border/40 bg-card p-6 transition-all duration-500 group-hover:border-border/60 group-hover:shadow-sm">
                  <!-- Icon -->
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-105"
                    :style="{
                      background: `linear-gradient(135deg, ${activeZone.color}12, ${activeZone.color}06)`,
                      border: `1px solid ${activeZone.color}15`,
                    }"
                  >
                    <component :is="card.icon" class="h-5 w-5" :style="{ color: activeZone.color }" />
                  </div>
                  <!-- Text -->
                  <div class="flex-1 min-w-0">
                    <h3 class="text-base font-semibold text-foreground">
                      {{ t(card.nameKey) }}
                    </h3>
                    <p class="mt-0.5 text-sm text-muted-foreground/60">
                      {{ t(card.descKey) }}
                    </p>
                  </div>
                  <!-- Arrow -->
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/30 transition-all duration-500 group-hover:translate-x-0.5 group-hover:border-border/50 group-hover:shadow-sm"
                  >
                    <svg class="h-4 w-4 text-muted-foreground/40 transition-all duration-500 group-hover:text-foreground/60" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                  <!-- Bottom accent -->
                  <div
                    class="absolute bottom-0 left-6 right-6 h-px w-0 transition-all duration-700 group-hover:w-[calc(100%-3rem)]"
                    :style="{ background: `linear-gradient(to right, ${activeZone.color}30, transparent)`, transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }"
                  />
                </div>
              </button>
            </div>

            <!-- Keyboard hint -->
            <p class="mt-8 text-xs text-muted-foreground/30">
              <kbd class="rounded border border-border/30 bg-muted/30 px-1.5 py-0.5 text-[10px]">1</kbd>–<kbd class="rounded border border-border/30 bg-muted/30 px-1.5 py-0.5 text-[10px]">5</kbd>
              {{ t('landing.keyboardHint') || 'to switch zones' }}
            </p>
          </div>
        </Transition>
      </div>
    </main>

    <!-- ─── AI Config Dialog ─── -->
    <div
      v-if="showAIConfig"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
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

/* ─── Toolbar buttons ─── */
.toolbar-btn {
  @apply flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground backdrop-blur-md ring-1 ring-border/40 transition-all duration-500 hover:bg-accent hover:text-foreground;
  background: hsl(var(--card) / 0.8);
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}

/* ─── Zone transition ─── */
.zone-slide-enter-active {
  transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-slide-leave-active {
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.zone-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.zone-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ─── Card staggered entry ─── */
.zone-content button:nth-child(1) {
  animation: card-enter 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.05s both;
}
.zone-content button:nth-child(2) {
  animation: card-enter 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.12s both;
}
.zone-content button:nth-child(3) {
  animation: card-enter 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.19s both;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ─── Mobile responsive ─── */
@media (max-width: 767px) {
  .left-panel {
    width: 100% !important;
    height: auto !important;
    min-height: 360px;
  }
}
</style>
