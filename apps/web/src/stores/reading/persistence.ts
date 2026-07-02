import type { Article, CollectorSelectors, ReadingList, Source } from './types'

// ── 存储键 ─────────────────────────────────────────────

const STORAGE_SOURCES_V2 = 'reading_sources_v2'
const STORAGE_ARTICLES = 'reading_articles'
const STORAGE_LISTS = 'reading_lists'
const STORAGE_SOURCES_V1 = 'reading_sources'
const STORAGE_COLLECTORS_V1 = 'reading_collectors'

// ── JSON API 源的真实 URL ──────────────────────────────

const LEGAL_SOURCE_URLS: Record<string, string> = {
  'gov-policy': 'https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json',
}

// ── 默认源 ─────────────────────────────────────────────

const DEFAULT_SOURCES: Source[] = [
  { id: 'solidot', url: 'https://feeds.feedburner.com/solidot', title: '奇客Solidot', category: '科技', addedAt: Date.now(), refreshInterval: 30, strategy: 'rss' },
  { id: '36kr', url: 'https://36kr.com/feed', title: '36氪', category: '商业', addedAt: Date.now(), refreshInterval: 30, strategy: 'rss' },
  { id: 'gov-policy', url: LEGAL_SOURCE_URLS['gov-policy'], title: '中国政府网·最新政策', category: '政策法规', addedAt: Date.now(), refreshInterval: 60, strategy: 'json-api' },
  { id: 'cctv-law', url: 'https://rsshub.app/cctv/law', title: '央视网·法治频道', category: '法治资讯', addedAt: Date.now(), refreshInterval: 60, strategy: 'rss' },
  { id: 'gzlawyer', url: 'https://www.gzlawyer.org/notices', title: '广州律协', category: '律师协会', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'a[href*="info"]', title: '', link: '', content: '', summary: '', author: '', date: '.date, .time, time' }, description: '广州律师协会通知公告' },
  { id: 'chinacourt-qa', url: 'https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml', title: '中国法院网·法律问答', category: '司法案例', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'a[href*="/article/"]', title: '', link: '', content: '', summary: '', author: '', date: '.right, .date, time' }, description: '中国法院网法律问答' },
  { id: 'chinacourt-case', url: 'https://www.chinacourt.cn/article/index/id/MzAwNDAwNTAwNyACAAA.shtml', title: '中国法院网·案例点评', category: '司法案例', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'a[href*="/article/"]', title: '', link: '', content: '', summary: '', author: '', date: '.right, .date, time' }, description: '中国法院网案例点评' },
  { id: 'court-judicial', url: 'https://www.court.gov.cn/fabu/gengduo/17.html', title: '最高法·司法文件', category: '司法文件', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'li:has(a[title]):has(.date)', title: 'a[title]', link: 'a[title]', content: '', summary: '', author: '', date: 'i.date, .date' }, description: '最高人民法院司法文件' },
  { id: 'court-interpretation', url: 'https://www.court.gov.cn/fabu/gengduo/16.html', title: '最高法·司法解释', category: '司法文件', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'li:has(a[title]):has(.date)', title: 'a[title]', link: 'a[title]', content: '', summary: '', author: '', date: 'i.date, .date' }, description: '最高人民法院司法解释' },
  { id: 'moj-law', url: 'http://www.moj.gov.cn/pub/sfbgw/flfggz/flfg/', title: '司法部·最新发布', category: '政策法规', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'a[href*="moj.gov.cn"]', title: '', link: '', content: '', summary: '', author: '', date: 'span, .date, time' }, description: '司法部法律法规' },
  { id: 'samr-law', url: 'https://www.samr.gov.cn/flfg/', title: '市监局·法规', category: '政策法规', addedAt: Date.now(), refreshInterval: 120, strategy: 'css-selector', selectors: { item: 'a[href*="samr.gov.cn"]', title: '', link: '', content: '', summary: '', author: '', date: 'span, .date, time' }, description: '市场监管总局法规' },
  { id: 'ai-hot', url: 'https://aihot.virxact.com/', title: 'AI热点资讯', category: '科技资讯', addedAt: Date.now(), refreshInterval: 60, strategy: 'css-selector', selectors: { item: 'ol.m-hotcard-list > li.m-hotcard-row', title: 'a.m-hotcard-link', link: 'a.m-hotcard-link', content: '', summary: '', author: '', date: '' }, description: 'AI 热点新闻聚合' },
]

// ── 通用工具 ───────────────────────────────────────────

function triggerSync() {
  window.dispatchEvent(new CustomEvent('md:data-changed', { detail: { scope: 'reading' } }))
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 0)
        return fallback
      return parsed
    }
  }
  catch { /* ignore */ }
  return fallback
}

// ── V1 → V2 迁移 ──────────────────────────────────────

interface LegacyRSSSource {
  id: string
  url: string
  title: string
  category: string
  addedAt: number
  refreshInterval: number
}

interface LegacyCollectorSource {
  id: string
  url: string
  title: string
  category: string
  addedAt: number
  refreshInterval: number
  selectors: CollectorSelectors
  description: string
}

function migrateV1Sources(): Source[] | null {
  const oldRSS = loadFromStorage<LegacyRSSSource[]>(STORAGE_SOURCES_V1, [])
  const oldCollectors = loadFromStorage<LegacyCollectorSource[]>(STORAGE_COLLECTORS_V1, [])
  if (!oldRSS.length && !oldCollectors.length)
    return null

  const migrated: Source[] = []

  for (const s of oldRSS) {
    if (s.url.startsWith('legal://')) {
      const id = s.url.replace('legal://', '')
      // cctv-law 改为 RSS 源
      if (id === 'cctv-law') {
        migrated.push({
          id: s.id,
          url: 'https://rsshub.app/cctv/law',
          title: s.title,
          category: s.category,
          addedAt: s.addedAt,
          refreshInterval: s.refreshInterval,
          strategy: 'rss',
        })
      }
      else {
        migrated.push({
          id: s.id,
          url: LEGAL_SOURCE_URLS[id] || s.url,
          title: s.title,
          category: s.category,
          addedAt: s.addedAt,
          refreshInterval: s.refreshInterval,
          strategy: 'json-api',
        })
      }
    }
    else {
      migrated.push({
        id: s.id,
        url: s.url,
        title: s.title,
        category: s.category,
        addedAt: s.addedAt,
        refreshInterval: s.refreshInterval,
        strategy: 'rss',
      })
    }
  }

  for (const c of oldCollectors) {
    migrated.push({
      id: c.id,
      url: c.url,
      title: c.title,
      category: c.category,
      addedAt: c.addedAt,
      refreshInterval: c.refreshInterval,
      strategy: 'css-selector',
      selectors: c.selectors,
      description: c.description,
    })
  }

  // 保存到 v2 key，清理 v1 keys
  localStorage.setItem(STORAGE_SOURCES_V2, JSON.stringify(migrated))
  localStorage.removeItem(STORAGE_SOURCES_V1)
  localStorage.removeItem(STORAGE_COLLECTORS_V1)
  return migrated
}

// ── 导出的加载/保存函数 ────────────────────────────────

export function loadSources(): Source[] {
  // 先尝试 v2 key
  const v2 = loadFromStorage<Source[]>(STORAGE_SOURCES_V2, [])
  if (v2.length > 0)
    return v2
  // 尝试迁移
  const migrated = migrateV1Sources()
  if (migrated)
    return migrated
  // 首次运行
  return [...DEFAULT_SOURCES]
}

export function saveSources(sources: Source[]) {
  localStorage.setItem(STORAGE_SOURCES_V2, JSON.stringify(sources))
  triggerSync()
}

export function loadArticles(): Article[] {
  const articles = loadFromStorage<Article[]>(STORAGE_ARTICLES, [])
  // 去掉旧版本的 type 字段（向后兼容）
  return articles.map(({ ...rest }) => rest)
}

export function saveArticles(articles: Article[]) {
  localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(articles))
  triggerSync()
}

export function loadLists(): ReadingList[] {
  return loadFromStorage<ReadingList[]>(STORAGE_LISTS, [])
}

export function saveLists(lists: ReadingList[]) {
  localStorage.setItem(STORAGE_LISTS, JSON.stringify(lists))
  triggerSync()
}
