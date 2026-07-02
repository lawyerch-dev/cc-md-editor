# 数据源采集系统重构设计方案

## 一、当前系统问题分析

### 1.1 代码结构问题
- **单体 Store 过大**：`reading.ts` 有 849 行，混合了数据获取、解析、存储、UI 状态等所有逻辑
- **职责不清晰**：RSS 源和采集器逻辑交织在一起，难以维护
- **类型定义分散**：接口定义和实现混在一起

### 1.2 用户体验问题
- **配置复杂**：用户需要理解 CSS 选择器才能配置采集器
- **错误处理差**：代理失败时用户看不到明确的错误信息
- **缺乏反馈**：采集过程不透明，用户不知道发生了什么

### 1.3 功能缺陷
- **数据源管理混乱**：RSS 源和采集器分开管理，没有统一视图
- **缺乏验证**：添加数据源后无法验证是否正常工作
- **无监控**：没有数据源健康状态监控
- **无分享机制**：无法分享或导入数据源配置

## 二、重构目标

### 2.1 核心原则
1. **简单优先**：RSS 是主要源，采集器是补充
2. **渐进式复杂度**：基础功能简单，高级功能可选
3. **用户友好**：减少配置步骤，提供智能默认值
4. **可扩展**：易于添加新的数据源类型

### 2.2 具体目标
- 将 Store 拆分为多个小模块
- 统一数据源抽象层
- 简化配置流程
- 改进错误处理和用户反馈
- 添加数据源验证和监控

## 三、架构设计

### 3.1 数据源抽象层

```typescript
// 基础数据源接口
interface DataSource {
  id: string
  type: 'rss' | 'collector' | 'api'
  title: string
  url: string
  category: string
  addedAt: number
  refreshInterval: number
  status: 'active' | 'error' | 'disabled'
  lastFetch?: number
  lastError?: string
}

// RSS 源
interface RSSSource extends DataSource {
  type: 'rss'
  feedUrl: string
  siteUrl?: string
  favicon?: string
}

// 采集器
interface CollectorSource extends DataSource {
  type: 'collector'
  selectors: CollectorSelectors
  description?: string
  aiGenerated: boolean
}

// API 源
interface APISource extends DataSource {
  type: 'api'
  endpoint: string
  headers?: Record<string, string>
  transform?: string // JSONata 或 JS 函数
}
```

### 3.2 数据获取层

```typescript
// 统一的数据获取接口
interface DataFetcher {
  canFetch(source: DataSource): boolean
  fetch(source: DataSource): Promise<FetchResult>
  validate(source: DataSource): Promise<ValidationResult>
}

// RSS 获取器
class RSSFetcher implements DataFetcher { ... }

// 采集器获取器
class CollectorFetcher implements DataFetcher { ... }

// API 获取器
class APIFetcher implements DataFetcher { ... }
```

### 3.3 数据源管理器

```typescript
class DataSourceManager {
  private fetchers: Map<string, DataFetcher>
  private sources: Map<string, DataSource>
  
  // 注册获取器
  registerFetcher(type: string, fetcher: DataFetcher): void
  
  // 添加数据源
  async addSource(source: DataSource): Promise<void>
  
  // 获取数据
  async fetch(sourceId: string): Promise<Article[]>
  
  // 验证数据源
  async validate(sourceId: string): Promise<ValidationResult>
  
  // 监控状态
  getStatus(): DataSourceStatus[]
}
```

## 四、模块拆分

### 4.1 新目录结构

```
src/stores/reading/
├── index.ts                 # 主 Store（重组后的入口）
├── types.ts                 # 所有类型定义
├── sources/
│   ├── manager.ts           # 数据源管理器
│   ├── rss.ts               # RSS 相关逻辑
│   ├── collector.ts         # 采集器相关逻辑
│   └── api.ts               # API 相关逻辑
├── fetchers/
│   ├── base.ts              # 基础获取器
│   ├── rss.ts               # RSS 获取器
│   ├── collector.ts         # 采集器获取器
│   └── proxy.ts             # 代理管理
├── storage/
│   ├── persistence.ts       # 持久化逻辑
│   └── migration.ts         # 数据迁移
└── utils/
    ├── html-parser.ts       # HTML 解析工具
    ├── url-utils.ts         # URL 处理工具
    └── date-utils.ts        # 日期处理工具
```

### 4.2 Store 拆分

```typescript
// stores/reading/index.ts
export const useReadingStore = defineStore('reading', () => {
  // 组合各个子模块
  const sources = useSourcesStore()
  const articles = useArticlesStore()
  const fetchers = useFetchersStore()
  
  // 主要状态
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // 主要方法
  async function fetchAll() { ... }
  async function addSource(config: SourceConfig) { ... }
  
  return {
    // 状态
    loading,
    error,
    // 数据
    sources: sources.list,
    articles: articles.list,
    // 方法
    fetchAll,
    addSource,
    // ... 其他方法
  }
})
```

## 五、用户界面重构

### 5.1 数据源配置流程

#### 简化流程（推荐）
1. **输入 URL**：用户输入网站 URL
2. **自动检测**：系统自动检测是否为 RSS 源
3. **智能配置**：
   - 如果是 RSS：自动添加
   - 如果是网页：AI 分析并生成配置
4. **预览确认**：显示采集结果预览
5. **保存**：一键保存

#### 高级流程（可选）
1. **手动配置**：支持手动输入 CSS 选择器
2. **模板选择**：提供预置模板
3. **测试验证**：实时预览采集结果

### 5.2 数据源管理界面

```
┌─────────────────────────────────────────────┐
│ 数据源管理                          [+ 添加] │
├─────────────────────────────────────────────┤
│ 🔍 搜索数据源...                             │
├─────────────────────────────────────────────┤
│ ▼ 活跃 (12)                                  │
│   ├─ 📰 奇客Solidot        ✅ 30分钟前      │
│   ├─ 📰 36氪               ✅ 1小时前       │
│   └─ 🤖 广州律协           ⚠️ 错误          │
│ ▼ 已禁用 (2)                                 │
│   └─ 📰 某个源            ❌ 已禁用         │
├─────────────────────────────────────────────┤
│ [全部刷新] [导入/导出] [设置]                │
└─────────────────────────────────────────────┘
```

### 5.3 添加数据源对话框

```
┌─────────────────────────────────────────────┐
│ 添加数据源                                   │
├─────────────────────────────────────────────┤
│ 网站地址                                     │
│ ┌─────────────────────────────────────────┐ │
│ │ https://example.com                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [自动检测] [手动配置]                        │
│                                             │
│ ── 检测结果 ──                               │
│ ✅ 发现 RSS 源: https://example.com/feed    │
│                                             │
│ 标题: [自动生成的标题        ]               │
│ 分类: [科技                  ]               │
│ 刷新间隔: [30分钟 ▼]                        │
│                                             │
│ [预览] [取消] [添加]                         │
└─────────────────────────────────────────────┘
```

## 六、错误处理改进

### 6.1 错误分类

```typescript
enum ErrorType {
  NETWORK = 'network',           // 网络错误
  CORS = 'cors',                 // CORS 错误
  PARSE = 'parse',               // 解析错误
  TIMEOUT = 'timeout',           // 超时
  RATE_LIMIT = 'rate_limit',     // 频率限制
  AUTH = 'auth',                 // 认证错误
  UNKNOWN = 'unknown'            // 未知错误
}

interface DataSourceError {
  type: ErrorType
  message: string
  sourceId: string
  timestamp: number
  retryable: boolean
  suggestion?: string  // 用户友好的建议
}
```

### 6.2 错误处理策略

```typescript
class ErrorHandler {
  static handleError(error: DataSourceError): void {
    // 1. 记录错误
    this.logError(error)
    
    // 2. 更新数据源状态
    this.updateSourceStatus(error.sourceId, 'error')
    
    // 3. 显示用户友好的错误信息
    this.showErrorToast(error)
    
    // 4. 提供解决建议
    if (error.suggestion) {
      this.showSuggestion(error.suggestion)
    }
    
    // 5. 自动重试（如果可重试）
    if (error.retryable) {
      this.scheduleRetry(error.sourceId)
    }
  }
}
```

### 6.3 用户友好的错误信息

| 错误类型 | 用户提示 | 建议操作 |
|---------|---------|---------|
| 网络错误 | "无法连接到网站" | 检查网络连接，稍后重试 |
| CORS 错误 | "网站不允许跨域访问" | 使用代理或 RSSHub |
| 解析错误 | "无法解析网页内容" | 检查 URL 是否正确 |
| 超时 | "请求超时" | 检查网络或稍后重试 |
| 频率限制 | "请求过于频繁" | 增加刷新间隔 |

## 七、数据源验证和监控

### 7.1 数据源验证

```typescript
interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  suggestions: string[]
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  field?: string
}

class SourceValidator {
  async validate(source: DataSource): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    
    // 1. URL 格式验证
    if (!this.isValidUrl(source.url)) {
      issues.push({
        type: 'error',
        message: 'URL 格式不正确',
        field: 'url'
      })
    }
    
    // 2. 可访问性验证
    try {
      await this.checkAccessibility(source.url)
    } catch (e) {
      issues.push({
        type: 'error',
        message: '无法访问该地址',
        field: 'url'
      })
    }
    
    // 3. 内容验证（针对 RSS）
    if (source.type === 'rss') {
      const feedValid = await this.validateFeed(source.url)
      if (!feedValid) {
        issues.push({
          type: 'warning',
          message: '可能不是有效的 RSS 源'
        })
      }
    }
    
    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues,
      suggestions: this.generateSuggestions(issues)
    }
  }
}
```

### 7.2 数据源监控

```typescript
interface SourceHealth {
  sourceId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: number
  successRate: number  // 最近 24 小时成功率
  avgResponseTime: number
  errorCount: number
  lastError?: DataSourceError
}

class SourceMonitor {
  private healthMap: Map<string, SourceHealth> = new Map()
  
  // 定期检查数据源健康状态
  async checkHealth(sourceId: string): Promise<SourceHealth> {
    const source = this.getSource(sourceId)
    const startTime = Date.now()
    
    try {
      await this.fetchSource(source)
      const responseTime = Date.now() - startTime
      
      return {
        sourceId,
        status: 'healthy',
        lastCheck: Date.now(),
        successRate: this.calculateSuccessRate(sourceId),
        avgResponseTime: responseTime,
        errorCount: this.getErrorCount(sourceId)
      }
    } catch (error) {
      return {
        sourceId,
        status: 'unhealthy',
        lastCheck: Date.now(),
        successRate: this.calculateSuccessRate(sourceId),
        avgResponseTime: 0,
        errorCount: this.getErrorCount(sourceId) + 1,
        lastError: error as DataSourceError
      }
    }
  }
  
  // 获取所有数据源的健康状态
  getOverallHealth(): SourceHealth[] {
    return Array.from(this.healthMap.values())
  }
}
```

## 八、数据导入导出

### 8.1 导出格式

```typescript
interface ExportData {
  version: '1.0'
  exportedAt: string
  sources: DataSource[]
  settings: {
    defaultRefreshInterval: number
    proxySettings: ProxySettings
  }
}

// 导出为 JSON 文件
function exportSources(sources: DataSource[]): void {
  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sources,
    settings: {
      defaultRefreshInterval: 30,
      proxySettings: getProxySettings()
    }
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reading-sources-${formatDate(new Date())}.json`
  a.click()
}
```

### 8.2 导入验证

```typescript
async function importSources(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as ExportData
  
  // 版本兼容性检查
  if (data.version !== '1.0') {
    throw new Error('不支持的导入格式版本')
  }
  
  // 验证数据源
  const validationResults = await Promise.all(
    data.sources.map(source => validateSource(source))
  )
  
  const validSources = data.sources.filter((_, i) => validationResults[i].valid)
  const invalidSources = data.sources.filter((_, i) => !validationResults[i].valid)
  
  return {
    success: true,
    imported: validSources.length,
    skipped: invalidSources.length,
    details: {
      validSources,
      invalidSources,
      validationResults
    }
  }
}
```

## 九、实施计划

### 9.1 阶段一：基础重构（1-2 周）
1. 创建新的目录结构
2. 提取类型定义到 `types.ts`
3. 实现基础的数据源抽象层
4. 拆分 Store 为多个小模块

### 9.2 阶段二：功能改进（2-3 周）
1. 实现统一的数据获取层
2. 改进错误处理机制
3. 添加数据源验证
4. 重构用户界面

### 9.3 阶段三：高级功能（1-2 周）
1. 实现数据源监控
2. 添加导入导出功能
3. 实现数据源分享机制
4. 性能优化和测试

### 9.4 阶段四：测试和发布（1 周）
1. 单元测试
2. 集成测试
3. 用户测试
4. 文档更新
5. 发布新版本

## 十、总结

本重构方案旨在解决当前数据源采集系统的以下问题：

1. **代码结构混乱** → 模块化拆分
2. **用户体验差** → 简化配置流程
3. **错误处理不完善** → 统一的错误处理机制
4. **缺乏监控** → 数据源健康状态监控
5. **功能缺失** → 导入导出、分享机制

通过这次重构，我们将建立一个：
- **可维护** 的代码架构
- **用户友好** 的配置界面
- **可靠** 的数据获取系统
- **可扩展** 的数据源支持

预计总工期：4-8 周
