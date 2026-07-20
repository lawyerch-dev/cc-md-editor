// @workspace report
export interface ReportMetric {
  id: string
  category: 'reputation' | 'revenue' | 'ability'
  name: string
  value: number
  unit: string
  date: string
  note?: string
}

export interface WeeklyReport {
  id: string
  weekStart: string
  weekEnd: string
  metrics: ReportMetric[]
  aiSummary?: string
  createdAt: number
}
