# netlify/

Netlify Functions 服务端函数。解决浏览器端无法处理的跨域、编码、服务端解析等问题。

## 函数列表

| 文件 | 功能 |
|---|---|
| **RSS 相关** | |
| `rss-fetch.ts` | RSS 抓取（自动检测编码：charset / XML 声明 / chardet） |
| `rss-feed-proxy.ts` | RSS/Atom 代理（服务端解析，零依赖） |
| `rsshub-discover.ts` | RSSHub 路由发现（查询可用 RSS 路由） |
| **Folo 相关** | |
| `folo-proxy.ts` | Folo API 代理（带重试机制） |
| `folo-import.ts` | Folo 数据导入 |
| **微信相关** | |
| `fulltext-extract.ts` | 全文提取（去噪：script/style/nav/footer 等） |
| **分享相关** | |
| `share-create.ts` | 创建分享链接 |
| `share-get.ts` | 获取分享内容 |
| `share-delete.ts` | 删除分享链接 |
| **GitHub 相关** | |
| `github-device-flow.ts` | GitHub OAuth 设备授权流程 |

## 为什么需要服务端函数

浏览器端受以下限制：
- **CORS**：无法直接请求第三方 API（RSSHub、Folo、微信等）
- **编码检测**：浏览器无法检测 RSS 源的字符编码（GB2312、GBK 等）
- **HTML 解析**：全文提取需要服务端处理
- **密钥安全**：GitHub OAuth client_secret 不能暴露在前端

## 部署

通过 Netlify 自动部署。函数路径为 `/.netlify/functions/<name>`。
