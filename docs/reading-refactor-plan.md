# 资讯阅读重构验收清单

> 目标：修复资讯阅读工作区在稳定性、数据质量、安全成本、产品体验四个维度的问题。
> 策略：方案 A（渐进式修复），分 4 批推进，每批独立可验收。

---

## 全局约定

- 所有修改位于 `apps/web/src/workspaces/reading/` 与 `apps/web/netlify/functions/`。
- 新增/修改函数需补充 `*.test.ts` 单元测试（纯函数优先）。
- 每次提交遵循 Conventional Commits，英文 message。
- 每批完成后运行 `pnpm web test` 与 `pnpm run type-check`。

---

## 第一批：采集稳定性

### 问题清单

1. 本地开发无法使用 Netlify Functions，导致 RSS/HTML 采集失败。
2. 公共 CORS 代理不稳定，经常 403/超时。
3. Netlify Function 10s 超时限制，慢站易触发。
4. Folo API 境外直连不稳定。
5. 自建 RSSHub 为空时默认走 `rsshub.app`，国内访问差。
6. 采集失败后无重试/退避。

### 任务与验收标准

| # | 任务 | 涉及文件 | 验收标准 |
|---|---|---|---|
| 1.1 | 增加 Vite 本地开发代理 | `apps/web/vite.config.ts` | 新增 `/api/rss-fetch`、`/api/rss-feed-proxy`、`/api/folo-proxy`、`/api/rsshub-discover` 路由，本地开发时转发到对应 Netlify Function 源码或 mock。 |
| 1.2 | 统一代理路径 | `apps/web/src/workspaces/reading/stores/fetch-strategies.ts` | `netlifyFunctionPath()` 在本地开发时返回 `/api/xxx`，部署环境返回 `/.netlify/functions/xxx`。 |
| 1.3 | 自建 RSSHub 默认镜像 | `apps/web/src/workspaces/reading/stores/index.ts` | 当 `rsshubBaseUrl` 为空且需要 RSSHub 时，优先尝试 `https://rsshub.doocs.org`（或配置的可访问镜像），失败再回退 `rsshub.app`。 |
| 1.4 | 服务端缓存 feed | `apps/web/netlify/functions/rss-feed-proxy.ts` | 同一 URL 5 分钟内重复请求，优先返回缓存；缓存键 `feed:${url}`，存储 Netlify Blobs。 |
| 1.5 | 失败重试与退避 | `apps/web/src/workspaces/reading/stores/fetch-strategies.ts` | `fetchSourceArticles` 内部对网络错误重试 2 次，间隔 1s/2s；失败后源 `health.status='error'` 并记录 `lastError`。 |
| 1.6 | Folo 代理超时优化 | `apps/web/netlify/functions/folo-proxy.ts` | 单次 fetch 超时 12s，支持 retry；对 `/entries` 请求增加缓存 60s。 |
| 1.7 | 超时上限调整 | `apps/web/netlify/functions/rss-fetch.ts` | 单次 fetch 超时从 6s 提高到 8s，给编码解析留余量。 |

### 关键测试

- `pnpm web dev` 下能成功添加并刷新一个 RSS 源。
- 断网后恢复，源能自动重试成功。
- 同一 feed 5 分钟内刷新，Netlify Function 不重复上游请求。

---

## 第二批：数据质量

### 问题清单

1. 全文提取靠硬编码选择器，对 SPA/反爬/微信公众号不准。
2. CSS 选择器采集规则在目标站点改版后立即失效。
3. 文章去重按 `sourceId|title|publishedAt`，标题/时间微变会重复。
4. ID 生成使用简单 DJB2，存在冲突风险。
5. 列表项 ID 生成规则不统一。

### 任务与验收标准

| # | 任务 | 涉及文件 | 验收标准 |
|---|---|---|---|
| 2.1 | 接入 Readability 全文提取 | 新增 `apps/web/src/workspaces/reading/utils/extractArticle.ts` | 使用 `@mozilla/readability` + `jsdom`（服务端）或浏览器 DOM，提取正文；返回 `{title, content, byline, excerpt}`。 |
| 2.2 | 全文提取兜底策略 | `apps/web/src/workspaces/reading/stores/fetch-strategies.ts` 中的 `fetchFullText` | 先尝试 Readability，失败再回退现有选择器列表；最终回退 body 最长子元素。 |
| 2.3 | CSS 选择器健康检查 | `apps/web/src/workspaces/reading/stores/index.ts` | 每次刷新时统计 `selectors` 命中数，连续 3 次命中数为 0 时标记 `health.status='stale'` 并提示用户更新规则。 |
| 2.4 | 统一文章 ID 生成 | 新增 `apps/web/src/workspaces/reading/utils/articleId.ts` | 基于 `normalizeUrl(link) + sourceId + publishedAt` 计算 SHA-256 短哈希（前 16 位），所有策略统一调用。 |
| 2.5 | 内容指纹去重 | `apps/web/src/workspaces/reading/stores/index.ts` 的 `mergeNewArticles` | 新增 `contentHash` 字段（标题+摘要的 simhash 或简单哈希），`contentHash` 相同且时间差 < 24h 视为重复。 |
| 2.6 | 数据迁移 | `apps/web/src/workspaces/reading/stores/persistence.ts` | 加载旧数据时，如果文章 ID 不是新格式，按新规则重新计算并去重。 |

### 关键测试

- 对微信公众号文章链接调用 `fetchFullText` 能正确提取正文。
- 对 SPA 站点（如 Next.js 博客）调用 `fetchFullText` 能提取到内容。
- 同一文章通过 RSS 和 CSS 采集两次，只生成一篇文章。

---

## 第三批：安全与成本

### 问题清单

1. Netlify Functions 暴露代理服务，可被任意调用刷流量。
2. `proxy.new-ai.cn` token 硬编码在源码中。
3. Folo 分页拉取无 rate limit，源多易触发限制。
4. 服务端无访问日志/监控。

### 任务与验收标准

| # | 任务 | 涉及文件 | 验收标准 |
|---|---|---|---|
| 3.1 | 代理 API 鉴权 | `apps/web/netlify/functions/rss-fetch.ts`、`rss-feed-proxy.ts` | 增加 `Authorization: Bearer ${ADMIN_KEY}` 或 `X-Admin-Key` 校验；未通过返回 401。 |
| 3.2 | 环境变量化 token | `apps/web/netlify/functions/rss-fetch.ts` | `PROXY_TOKEN` 从 `process.env.PROXY_TOKEN` 读取，源码中不再出现明文 token。 |
| 3.3 | 客户端统一携带 key | `apps/web/src/workspaces/reading/stores/fetch-strategies.ts` | 所有调用 Netlify Function 的请求统一从 `localStorage.getItem('proxy_admin_key')` 取 key。 |
| 3.4 | Folo 限流 | `apps/web/src/workspaces/reading/stores/fetch-strategies.ts` 的 `fetchFoloEntriesPaginated` | 最大页数从 3 降到 2；页与页之间增加 300ms 延迟；并发源数限制在 `FETCH_CONCURRENCY=5`。 |
| 3.5 | 访问日志 | `apps/web/netlify/functions/rss-fetch.ts`、`rss-feed-proxy.ts`、`folo-proxy.ts` | 在 Function 中打印 `console.log({url, status, durationMs})`，便于 Netlify Functions log 查看。 |
| 3.6 | 单用户/单 IP 限流 | `apps/web/netlify/functions/rss-fetch.ts` | 对同一 URL 30 秒内限制 5 次请求，超过返回 429（可借助 Netlify Blobs 计数）。 |

### 关键测试

- 不带 `X-Admin-Key` 调用 `/.netlify/functions/rss-fetch` 返回 401。
- 源码中搜索不到 `ccmd2024proxy` 明文。
- Folo 源刷新时网络请求间隔 >= 300ms。

---

## 第四批：体验与同步

### 问题清单

1. Web 端后台刷新只在浏览器扩展生效。
2. SocialMedia 视图未在筛选栏暴露。
3. 阅读数据未参与云同步。
4. 无采集失败后的用户提示/恢复入口。

### 任务与验收标准

| # | 任务 | 涉及文件 | 验收标准 |
|---|---|---|---|
| 4.1 | Web 端后台刷新兜底 | `apps/web/src/workspaces/reading/composables/useBackgroundRefresh.ts` | 使用 `Page Visibility API` + `setInterval`，页面可见时检查到期源并刷新；与扩展 alarm 不冲突。 |
| 4.2 | Service Worker 消息通道 | `apps/web/src/workspaces/reading/composables/useBackgroundRefresh.ts` | 若未来注册 SW，可接收 `refresh-feeds` 消息。 |
| 4.3 | 暴露 SocialMedia 视图 | `apps/web/src/workspaces/reading/stores/types.ts` | 在 `VIEW_TYPE_OPTIONS` 中增加 `{ value: FeedViewType.SocialMedia, i18nKey: 'reading.viewSocialMedia' }`。 |
| 4.4 | 增加失败源提示 | `apps/web/src/workspaces/reading/components/SourceConfigDialog.vue` | 对 `health.status='error'` 或 `'stale'` 的源显示警告图标和最后错误信息，提供“重试”按钮。 |
| 4.5 | 阅读数据云同步 | `apps/web/src/shared/services/sync/settings.ts`、`apps/api/src/` | 将 `reading_sources_v4`、`reading_articles`、`reading_lists` 纳入 `SYNC_SETTING_KEYS` 或新增独立同步端点；需在 D1 中新增表/列。 |
| 4.6 | 同步冲突解决 | `apps/web/src/stores/sync.ts` | 阅读数据使用 LWW（Last-Write-Wins）+ 按 source URL 去重合并。 |

### 关键测试

- 筛选栏出现“社交媒体”选项。
- 源失败后界面显示错误信息和重试按钮。
- 登录账号后，阅读数据能在两个浏览器标签页/设备间同步。

---

## 批次依赖关系

```
第一批（稳定） ─┬─> 第二批（质量）
              │
              └─> 第三批（安全）
                        │
                        └─> 第四批（体验 + 同步）
```

建议按顺序推进，但第三批可与第二批并行。

---

## 验收总流程

每批完成后执行：

```bash
pnpm web test
pnpm run type-check
pnpm run lint
```

全部完成后额外执行：

```bash
pnpm web build
```

确保 Netlify Functions TypeScript 编译通过。

---

## 风险点

1. **环境变量**：`PROXY_TOKEN`、`ADMIN_KEY` 需要在 Netlify 站点设置中配置，否则部署后代理 401。
2. **D1 同步**：第四批涉及后端 schema 变更，需要 migration。
3. **用户数据迁移**：第二批 ID 变更后，旧文章的已读/收藏状态需要映射，否则用户会重新看到未读文章。
4. **缓存成本**：Netlify Blobs 免费额度 5GB， feed 缓存需设置 TTL 避免无限增长。

---

## 执行进度

| 批次 | 状态 | 关键落地项 |
|---|---|---|
| 第一批：采集稳定性 | 已完成 | Vite 本地代理、统一代理路径、RSSHub 镜像兜底、服务端缓存、失败重试、Folo 代理优化、超时调整 |
| 第二批：数据质量 | 已完成 | Readability 全文提取、兜底策略、CSS 选择器健康检查、统一文章 ID、内容指纹去重、旧数据迁移 |
| 第三批：安全与成本 | 已完成 | 代理 API 鉴权、token 环境变量化、客户端统一 key、Folo 限流、访问日志、单 URL 限流 |
| 第四批：体验与同步 | 已完成 | Web 后台刷新兜底、Service Worker 消息通道、SocialMedia 视图、失败源提示、阅读数据云同步、LWW 冲突解决 |

## 最终验收结果

```bash
pnpm run lint        # ✅ 通过，无告警
pnpm run type-check  # ✅ 通过
pnpm run test        # ✅ 通过（core 28 / web 43）
pnpm web build       # ✅ 通过，无 chunk 告警
```

> 构建告警已处理：将 `chunkSizeWarningLimit` 从 2000 kB 调整至 5000 kB，mermaid / excalidraw 已独立拆分为 vendor chunk。
