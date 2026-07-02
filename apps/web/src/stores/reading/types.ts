/** 获取策略类型 */
export type FetchStrategy = 'rss' | 'css-selector' | 'json-api'

/** 统一数据源 */
export interface Source {
  id: string
  url: string
  title: string
  category: string
  addedAt: number
  /** 自动刷新间隔（分钟），0 = 关闭 */
  refreshInterval: number
  /** 获取策略 */
  strategy: FetchStrategy
  /** CSS 选择器（仅 css-selector 策略需要） */
  selectors?: CollectorSelectors
  /** 描述 */
  description?: string
  /** 运行时健康状态（不持久化） */
  health?: SourceHealth
}

/** 源健康状态 */
export interface SourceHealth {
  status: 'ok' | 'error' | 'pending' | 'idle'
  lastFetchAt?: number
  lastError?: string
  articleCount?: number
}

/** CSS 选择器采集规则 */
export interface CollectorSelectors {
  /** 文章列表容器（每项 = 一篇文章） */
  item: string
  /** 相对于 item 的选择器 */
  title: string
  link: string
  content: string
  summary: string
  author: string
  date: string
}

/** 文章 */
export interface Article {
  id: string
  sourceId: string
  sourceTitle: string
  title: string
  link: string
  content: string
  summary: string
  author: string
  publishedAt: number
  read: boolean
  starred: boolean
}

/** 阅读列表 */
export interface ReadingList {
  id: string
  name: string
  articleIds: string[]
  createdAt: number
}
