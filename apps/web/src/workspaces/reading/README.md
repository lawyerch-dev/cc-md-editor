# workspaces/reading/

资讯阅读工作区。支持 RSS、CSS 选择器采集、Folo/RSSHub 等多种数据源。

## stores/

| 文件 | 功能 |
|---|---|
| `index.ts` | 阅读 store 入口（数据源 CRUD、文章获取、分组管理） |
| `types.ts` | 类型定义（Source, Article, FeedViewType, MediaItem 等） |
| `fetch-strategies.ts` | 获取策略（RSS 解析、CSS 采集、Folo API、全文提取） |
| `persistence.ts` | 持久化（localStorage + IndexedDB 双写） |
| `indexeddb-persistence.ts` | IndexedDB 存储实现 |
| `folo-import.ts` | OPML + Folo SQLite 导入 |

## composables/

| 文件 | 功能 |
|---|---|
| `useAudioPlayer` | 全局音频播放器单例（播客播放） |
| `useBackgroundRefresh` | 后台自动刷新（浏览器扩展 alarm） |
| `useCollectorAI` | AI 生成 CSS 选择器采集规则 |

## components/

| 文件 | 功能 |
|---|---|
| `ReadingView.vue` | 主视图（自适应布局） |
| `ArticleReader.vue` | 文章阅读器 |
| `MediaArticleReader.vue` | 多媒体文章阅读器 |
| `ArticleAnnotator.vue` | 批注系统 |
| `SourceConfigDialog.vue` | 数据源管理 |
| `AddSourceDialog.vue` | 添加/编辑数据源 |
| `CSSImportDialog.vue` | CSS 选择器规则导入 |
| `views/` | 多媒体视图（图片网格、瀑布流、视频、音频、社交媒体） |
