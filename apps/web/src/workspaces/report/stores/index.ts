import type { ReportMetric, WeeklyReport } from '../types'
// @workspace report
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'report-metrics'
const REPORTS_KEY = 'report-weekly'

export const useReportStore = defineStore('report', () => {
  const metrics = ref<ReportMetric[]>(loadMetrics())
  const reports = ref<WeeklyReport[]>(loadReports())

  function loadMetrics(): ReportMetric[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    }
    catch { return [] }
  }

  function loadReports(): WeeklyReport[] {
    try {
      const raw = localStorage.getItem(REPORTS_KEY)
      return raw ? JSON.parse(raw) : []
    }
    catch { return [] }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics.value))
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.value))
  }

  const reputationMetrics = computed(() =>
    metrics.value.filter(m => m.category === 'reputation').sort((a, b) => b.date.localeCompare(a.date)),
  )

  const revenueMetrics = computed(() =>
    metrics.value.filter(m => m.category === 'revenue').sort((a, b) => b.date.localeCompare(a.date)),
  )

  const abilityMetrics = computed(() =>
    metrics.value.filter(m => m.category === 'ability').sort((a, b) => b.date.localeCompare(a.date)),
  )

  function addMetric(metric: Omit<ReportMetric, 'id'>) {
    metrics.value.push({
      ...metric,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    })
    persist()
  }

  function deleteMetric(id: string) {
    metrics.value = metrics.value.filter(m => m.id !== id)
    persist()
  }

  function addReport(report: Omit<WeeklyReport, 'id' | 'createdAt'>) {
    reports.value.push({
      ...report,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
    })
    persist()
  }

  return {
    metrics,
    reports,
    reputationMetrics,
    revenueMetrics,
    abilityMetrics,
    addMetric,
    deleteMetric,
    addReport,
  }
})
