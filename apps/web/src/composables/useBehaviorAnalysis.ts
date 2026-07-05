/**
 * 行为数据分析 composable
 * 将原始行为事件聚合为可读的统计指标
 */

import { computed } from 'vue'
import { getEvents } from './useBehaviorTracking'

interface BehaviorAnalysis {
  // 阅读统计
  totalReads: number
  avgReadDuration: number
  readCompletionRate: number
  contentPreference: Record<string, number>
  readingHours: Record<string, number>
  peakHours: string[]

  // 产出统计
  annotationCount: number
  favoriteCount: number
  extractIdeaCount: number
  writeCount: number

  // 转化漏斗
  readToAnnotateRate: number
  annotateToIdeaRate: number

  // 趋势（最近 7 天 vs 之前 7 天）
  trend: {
    reads: { current: number, previous: number, change: number }
    annotations: { current: number, previous: number, change: number }
    ideas: { current: number, previous: number, change: number }
  }
}

function calcAvgDuration(events: ReturnType<typeof getEvents>): number {
  const durations = events.filter(e => e.type === 'read_end' && e.duration).map(e => e.duration!)
  return durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
}

function calcContentPreference(events: ReturnType<typeof getEvents>): Record<string, number> {
  const counts: Record<string, number> = {}
  let total = 0
  for (const e of events) {
    if (e.type === 'read_start' && e.contentType) {
      counts[e.contentType] = (counts[e.contentType] || 0) + 1
      total++
    }
  }
  if (!total)
    return {}
  const pref: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) {
    pref[k] = Math.round((v / total) * 100)
  }
  return pref
}

function calcReadingHours(events: ReturnType<typeof getEvents>): Record<string, number> {
  const hours: Record<string, number> = {}
  for (const e of events) {
    if (e.type === 'read_start') {
      const h = new Date(e.timestamp).getHours().toString()
      hours[h] = (hours[h] || 0) + 1
    }
  }
  return hours
}

function calcPeakHours(hours: Record<string, number>): string[] {
  const sorted = Object.entries(hours).sort(([, a], [, b]) => b - a)
  return sorted.slice(0, 3).map(([h]) => `${h}:00`)
}

function calcReadCompletion(events: ReturnType<typeof getEvents>): number {
  const starts = events.filter(e => e.type === 'read_start').length
  const ends = events.filter(e => e.type === 'read_end').length
  return starts ? Math.round((ends / starts) * 100) : 0
}

export function useBehaviorAnalysis(days = 30) {
  const events = computed(() => getEvents(days))
  const recentEvents = computed(() => getEvents(7))
  const previousEvents = computed(() => {
    const all = getEvents(14)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return all.filter(e => e.timestamp < cutoff)
  })

  const analysis = computed<BehaviorAnalysis>(() => {
    const evts = events.value
    const readingHours = calcReadingHours(evts)

    const currentReads = recentEvents.value.filter(e => e.type === 'read_start').length
    const previousReads = previousEvents.value.filter(e => e.type === 'read_start').length
    const currentAnnot = recentEvents.value.filter(e => e.type === 'annotate').length
    const previousAnnot = previousEvents.value.filter(e => e.type === 'annotate').length
    const currentIdeas = recentEvents.value.filter(e => e.type === 'extract_idea').length
    const previousIdeas = previousEvents.value.filter(e => e.type === 'extract_idea').length

    const totalReads = evts.filter(e => e.type === 'read_start').length
    const totalAnnot = evts.filter(e => e.type === 'annotate').length

    return {
      totalReads,
      avgReadDuration: calcAvgDuration(evts),
      readCompletionRate: calcReadCompletion(evts),
      contentPreference: calcContentPreference(evts),
      readingHours,
      peakHours: calcPeakHours(readingHours),

      annotationCount: totalAnnot,
      favoriteCount: evts.filter(e => e.type === 'favorite').length,
      extractIdeaCount: evts.filter(e => e.type === 'extract_idea').length,
      writeCount: evts.filter(e => e.type === 'write').length,

      readToAnnotateRate: totalReads ? Math.round((totalAnnot / totalReads) * 100) : 0,
      annotateToIdeaRate: totalAnnot ? Math.round((evts.filter(e => e.type === 'extract_idea').length / totalAnnot) * 100) : 0,

      trend: {
        reads: {
          current: currentReads,
          previous: previousReads,
          change: previousReads ? Math.round(((currentReads - previousReads) / previousReads) * 100) : 0,
        },
        annotations: {
          current: currentAnnot,
          previous: previousAnnot,
          change: previousAnnot ? Math.round(((currentAnnot - previousAnnot) / previousAnnot) * 100) : 0,
        },
        ideas: {
          current: currentIdeas,
          previous: previousIdeas,
          change: previousIdeas ? Math.round(((currentIdeas - previousIdeas) / previousIdeas) * 100) : 0,
        },
      },
    }
  })

  return { analysis, events }
}
