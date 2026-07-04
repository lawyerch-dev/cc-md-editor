/** 获取策略类型 */
export type FetchStrategy = 'rss' | 'css-selector' | 'folo-rsshub'

/** 内容视图类型 — 决定如何渲染条目 */
export enum FeedViewType {
  Articles = 0,
  Pictures = 1,
  Videos = 2,
  Audios = 3,
  SocialMedia = 4,
}

/** 视图类型选项 — 用于筛选栏和下拉菜单，顺序统一 */
export const VIEW_TYPE_OPTIONS: { value: FeedViewType, i18nKey: string }[] = [
  { value: FeedViewType.Articles, i18nKey: 'reading.viewArticles' },
  { value: FeedViewType.Pictures, i18nKey: 'reading.viewPictures' },
  { value: FeedViewType.Audios, i18nKey: 'reading.viewAudios' },
  { value: FeedViewType.Videos, i18nKey: 'reading.viewVideos' },
]

/** 多媒体条目 */
export interface MediaItem {
  url: string
  type: 'photo' | 'video' | 'audio'
  previewImageUrl?: string
  width?: number
  height?: number
  durationInSeconds?: number
  mimeType?: string
  blurhash?: string
}

/** 附件 */
export interface Attachment {
  url: string
  durationInSeconds?: number
  mimeType?: string
  sizeInBytes?: number
  title?: string
}

/** 统一数据源 */
export interface Source {
  id: string
  url: string
  title: string
  addedAt: number
  /** 自动刷新间隔（分钟），0 = 关闭 */
  refreshInterval: number
  /** 获取策略 */
  strategy: FetchStrategy
  /** CSS 选择器（仅 css-selector 策略需要） */
  selectors?: CollectorSelectors
  /** 内容视图类型 */
  view: FeedViewType
  /** 描述 */
  description?: string
  /** 运行时健康状态（不持久化） */
  health?: SourceHealth
  /** RSSHub 路由路径（如 /weibo/user/123），优先于直接 RSS 获取 */
  rsshubPath?: string
  /** Folo feed ID（rsshub:// 源首次获取后缓存，后续刷新用 entries API） */
  foloFeedId?: string
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
  /** 结构化多媒体（图片/视频/音频） */
  media: MediaItem[]
  /** 附件 */
  attachments: Attachment[]
}

/** 阅读列表 */
export interface ReadingList {
  id: string
  name: string
  articleIds: string[]
  createdAt: number
}
