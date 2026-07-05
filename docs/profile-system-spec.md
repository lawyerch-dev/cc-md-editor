# 我的画像系统 — 开发规格文档

> 版本：v1.0 | 日期：2026-07-05 | 状态：设计完成，待实现

## 1. 产品定位

「我的画像」不是独立的自我评估工具，而是**整个知识工作流的发动机**。

```
画像（战略层）
    ↓ 驱动
┌───────────┬───────────┬───────────┐
│ 资讯阅读   │ 想法库     │ 编辑器    │
│ 该看什么   │ 该想什么   │ 该写什么  │
└───────────┴───────────┴───────────┘
    ↓ 反馈
成长追踪（我进步了吗？）
```

核心价值：帮用户从"无头苍蝇式阅读"变成"围绕职业规划汲取有效营养"。

## 2. 四层画像模型

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────┐
│              我的画像（动态成长系统）                       │
├──────────────┬──────────────┬──────────────┬──────────────┤
│  行为数据层    │  AI 推断层    │  用户配置层    │  外部验证层    │
│ （自动采集）   │ （自动分析）   │ （手动输入）   │ （定期审计）   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ 阅读统计      │ 性格推断      │ 目标设定       │ 搜索可见性    │
│ 批注模式      │ 专业画像      │ 约束条件       │ AI 可见性     │
│ 产出统计      │ 成长轨迹      │ 信任战略       │ 行业可见性    │
│ 知识图谱      │ 标杆对比      │ 关注话题       │ 社交可见性    │
└──────────────┴──────────────┴──────────────┴──────────────┘
                              ↓
                       信任建设仪表盘
                    （可追踪、可衡量、可行动）
```

四层数据互相验证：
- 用户说"我想成为专家"（配置层）→ 但搜不到你（验证层）→ 说明输出不够
- 阅读量很高（行为层）→ 但产出转化率低（推断层）→ 说明需要调整节奏
- AI 推断你是"深度思考者"（推断层）→ 但文章只有 2000 字（行为层）→ 说明潜力没发挥

### 2.2 第一层：行为数据（自动采集）

**零用户成本**，系统自动记录。

#### 数据结构

```ts
interface BehaviorEvent {
  type: 'read_start' | 'read_end' | 'annotate' | 'favorite' | 'skip' | 'extract_idea' | 'write'
  timestamp: number
  articleId?: string
  sourceId?: string
  contentType?: 'article' | 'video' | 'audio' | 'picture'
  duration?: number          // 阅读时长（秒）
  metadata?: Record<string, unknown>
}

interface BehaviorAnalysis {
  // 阅读统计
  totalReads: number
  avgReadDuration: number    // 秒
  readCompletionRate: number // 长文完成率
  contentPreference: Record<string, number>  // { article: 60, video: 25, ... }
  readingHours: Record<string, number>       // { '8': 12, '9': 15, ... } 按小时分布
  skipPatterns: string[]     // 跳过的内容类型

  // 产出统计
  annotationCount: number
  favoriteCount: number
  extractIdeaCount: number
  articleWriteCount: number

  // 转化漏斗
  readToAnnotateRate: number   // 批注率
  annotateToIdeaRate: number   // 想法转化率
  ideaToArticleRate: number    // 文章转化率

  // 知识图谱
  topKeywords: Array<{ word: string, count: number }>
  sourceDistribution: Record<string, number>  // 各源的阅读量
}
```

#### 埋点位置

| 文件 | 函数/位置 | 事件类型 | 说明 |
|---|---|---|---|
| `ArticleReader.vue` | `onMounted` | `read_start` | 打开文章时记录开始时间 |
| `ArticleReader.vue` | `onUnmounted` 或切换文章时 | `read_end` | 记录阅读时长 |
| `ArticleReader.vue` | `createAnnotation` | `annotate` | 添加批注 |
| `ArticleReader.vue` | 收藏按钮 click | `favorite` | 收藏文章 |
| `ArticleReader.vue` | `extractToIdea` | `extract_idea` | 提炼想法 |
| `ReadingView.vue` | `setActiveArticle` | `read_end` | 切换文章时结算上一篇 |
| `ArticleListView.vue` | 文章条目 3 秒内未点击即滑过 | `skip` | 快速跳过 |

#### 存储

```ts
// localStorage key: 'reading_behavior_events'
// 保留最近 90 天数据，超出自动清理
// 定期（每天）聚合为 BehaviorAnalysis 存入 'reading_behavior_analysis'
```

### 2.3 第二层：AI 推断（自动分析）

**低成本**，基于行为数据用 AI 生成推断。

#### 数据结构

```ts
interface AIInference {
  timestamp: number
  version: number  // 推断算法版本，用于兼容

  personality: {
    depthPreference: 'depth' | 'breadth' | 'mixed'
    decisionStyle: 'data-driven' | 'intuitive' | 'analogy-based'
    learningMode: 'case-based' | 'theory-first' | 'hands-on'
    riskTolerance: 'conservative' | 'moderate' | 'aggressive'
    confidence: number  // 0-1，推断置信度
  }

  expertise: {
    coreDomains: Array<{ name: string, confidence: number, evidence: string }>
    secondaryDomains: Array<{ name: string, confidence: number }>
    blindSpots: string[]      // 从未接触的领域
    emergingInterests: string[]  // 最近开始关注的领域
  }

  growth: {
    trend: 'improving' | 'stable' | 'declining'
    metrics: {
      readDepth: { current: number, change: number }
      outputRate: { current: number, change: number }
      knowledgeBreadth: { current: number, change: number }
    }
    bottlenecks: string[]
    recommendations: string[]
  }

  benchmarks: {
    peerComparison: string  // 和同领域从业者的对比描述
    gapAnalysis: Array<{ dimension: string, gap: number, suggestion: string }>
  }
}
```

#### 生成流程

```ts
async function generateInference(analysis: BehaviorAnalysis): Promise<AIInference> {
  const prompt = `
你是一个职业发展分析师。基于以下用户行为数据，推断用户的性格特征、专业领域和成长趋势。

用户行为数据：
${JSON.stringify(analysis, null, 2)}

请分析：
1. 性格特征（深度偏好、决策风格、学习模式、风险偏好）
2. 专业领域（核心、次要、盲区、新兴兴趣）
3. 成长趋势（进步/稳定/退步、瓶颈、建议）
4. 对标分析（和同领域从业者的差距）

返回 JSON 格式，包含 confidence 字段表示推断置信度。
`
  const result = await callAI(prompt)
  return JSON.parse(result)
}
```

#### 触发时机

- 用户在画像页面点击"更新洞察"按钮
- 每周自动检测（如果行为数据有更新且上次推断超过 7 天）
- 首次使用时自动生成

### 2.4 第三层：用户配置（手动输入）

**只问 AI 无法推断的事**，精简为 3 个卡片。

#### 数据结构

```ts
interface UserProfile {
  goals: {
    shortTerm: string       // 3 个月目标
    midTerm: string         // 1 年目标
    longTerm: string        // 3-5 年目标
    successCriteria: string // 怎么算达到
  }

  constraints: {
    weeklyHours: number     // 每周可用于阅读写作的时间
    bottleneck: string      // 当前最大瓶颈
    cannotDo: string        // 不能做什么
    mustMaintain: string    // 必须维护的关系/事务
  }

  trustStrategy: {
    targetAudience: string  // 想被谁信任
    visibility: string      // 他们怎么知道我
    uniqueValue: string     // 我的独特价值
    differentiation: string // 差异化定位
  }

  topics: Array<{
    name: string
    priority: 'high' | 'medium' | 'low'
    source: 'manual' | 'inferred'  // 手动添加 or AI 推断
  }>
}
```

#### 存储

```ts
// localStorage key: 'reading_user_profile'
// 保留 Ikigai 数据（向后兼容）
// 新增 goals, constraints, trustStrategy, topics 字段
```

### 2.5 第四层：外部可见性审计

**验证层**，确认用户在外部世界的实际存在感。

#### 数据结构

```ts
interface VisibilityAudit {
  timestamp: number

  searchEngine: {
    baidu: { found: boolean, resultCount: number, topResults: string[] }
    wechat: { found: boolean, resultCount: number }
    zhihu: { found: boolean, resultCount: number }
    google: { found: boolean, resultCount: number }
  }

  aiPlatforms: {
    chatgpt: { mentioned: boolean, context: string }
    kimi: { mentioned: boolean, context: string }
    tongyi: { mentioned: boolean, context: string }
  }

  industry: {
    courtRecords: number    // 裁判文书网
    papers: number          // 知网
    mediaMentions: number   // 行业媒体
  }

  social: {
    wechatFollowers: number
    wechatAvgReads: number
    zhihuFollowers: number
    linkedinConnections: number
  }

  notes: string  // 用户备注
  aiSuggestions: string[]  // AI 基于可见性缺口的建议
}
```

#### 实现方式

**MVP（手动输入）**：用户自己搜索，手动填写结果表单。

**进阶（AI 自动搜索）**：
```ts
async function auditVisibility(userName: string, domain: string) {
  // 1. 搜索引擎
  const baiduResults = await webSearch(`${userName} ${domain}`)
  const wechatResults = await webSearch(`site:mp.weixin.qq.com ${userName}`)

  // 2. AI 平台
  const chatgptAnswer = await callAI(`你听说过"${userName}"吗？他是${domain}领域的专家吗？`)

  // 3. 生成建议
  const suggestions = await callAI(`
    用户：${userName}，领域：${domain}
    搜索结果：${JSON.stringify(baiduResults)}
    请给出提升可见性的具体建议。
  `)

  return { searchEngine, aiPlatforms, suggestions }
}
```

### 2.6 信任建设仪表盘

**汇总层**，把四层数据整合为可追踪的指标。

```ts
interface TrustDashboard {
  professionalTrust: {
    knowledgeDepth: number      // 1-10
    domainCoverage: number      // 1-10
    caseAccumulation: number    // 案例数
    citationCount: number       // 被引用次数
    trend: 'up' | 'stable' | 'down'
  }

  contentTrust: {
    outputFrequency: number     // 篇/月
    contentDepth: number        // 平均字数
    conversionRate: number      // 阅读→产出转化率
    distribution: string[]      // 发布平台
    trend: 'up' | 'stable' | 'down'
  }

  relationshipTrust: {
    industryInteractions: number
    contentShares: number
    consultations: number
    collaborations: number
    trend: 'up' | 'stable' | 'down'
  }

  aiRecommendations: string[]  // 基于四层数据的综合建议
}
```

## 3. 页面设计

### 3.1 页面结构

```
┌─────────────────────────────────────────────────────────┐
│  ← 返回    我的画像                                      │
├─────────────────────────────────────────────────────────┤
│  📊 行为分析  │  🧠 AI 洞察  │  ⚙️ 我的配置  │  🌐 外部可见性 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  （根据选中的 Tab 显示对应内容）                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tab 1：行为分析

**自动统计，无需用户操作。**

```
┌──────────────────────┬──────────────────────┐
│ 📖 阅读统计           │ ✍️ 产出统计           │
│                      │                      │
│ 本月阅读：47 篇       │ 想法提炼：8 条        │
│ 日均：1.6 篇          │ 文章产出：2 篇        │
│ 平均时长：3.2 分钟    │ 转化率：17%           │
│ 批注率：26%           │ 产出节奏：集中在周末   │
│                      │                      │
│ 偏好：案例分析 60%    │ 漏斗：                │
│       政策解读 25%    │ 阅读 47 → 批注 12     │
│       新闻快讯 15%    │ → 想法 8 → 文章 2     │
└──────────────────────┴──────────────────────┘

┌──────────────────────────────────────────────┐
│ 🏷️ 知识图谱（标签云）                         │
│                                              │
│ AI法律(28)  数据隐私(15)  合规(12)  开源(8)  │
│ 知识产权(5)  商业法(2)  刑法(0)              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 📈 阅读趋势（折线图，最近 30 天）              │
└──────────────────────────────────────────────┘
```

### 3.3 Tab 2：AI 洞察

**定期生成，用户可确认/修正。**

```
┌──────────────────────────────────────────────┐
│ 🧠 AI 洞察                        [更新洞察] │
│ 上次更新：2026-07-05                         │
├──────────────────────────────────────────────┤
│                                              │
│ 性格推断                                     │
│ ├── 深度偏好：倾向于深度分析（置信度 85%）      │
│ ├── 决策风格：数据 + 判例驱动（置信度 78%）     │
│ └── 学习模式：通过案例学理论（置信度 82%）      │
│                                              │
│ 专业画像                                     │
│ ├── 核心领域：AI 法律（置信度 92%）            │
│ ├── 次要领域：数据隐私（置信度 75%）           │
│ ├── 潜在兴趣：开源合规（偶尔阅读无批注）        │
│ └── 知识盲区：商业法、刑法、国际法             │
│                                              │
│ 成长趋势                                     │
│ ├── 知识深度：↑ 过去 3 个月 +35%              │
│ ├── 产出效率：↑ 转化率 12% → 17%             │
│ ├── 注意力：从泛科技转向法律科技               │
│ └── 瓶颈：阅读量足够，产出转化率偏低           │
│                                              │
│ 标杆对比                                     │
│ ├── 你的阅读量 47/月 vs 专家平均 80/月         │
│ ├── 你的产出量 2/月 vs 专家平均 8/月           │
│ └── 差距：产出频率是最大短板                   │
└──────────────────────────────────────────────┘
```

### 3.4 Tab 3：我的配置

**精简表单，只问 AI 无法推断的事。**

```
┌──────────────────────────────────────────────┐
│ 🎯 目标设定                                  │
│                                              │
│ 3 个月目标                                    │
│ [完成 10 篇 AI 法律案例分析              ]    │
│                                              │
│ 1 年目标                                      │
│ [公众号粉丝达到 5000                     ]    │
│                                              │
│ 3-5 年目标                                   │
│ [成为该领域被引用的专家                   ]    │
│                                              │
│ 成功标准                                      │
│ [每月产出 4 篇，每篇至少 1 个真实案例     ]    │
├──────────────────────────────────────────────┤
│ ⚠️ 约束条件                                  │
│                                              │
│ 每周可用时间：[10] 小时                       │
│ 当前最大瓶颈：[写作产出不够]                   │
│ 不能做的事：[不能做免费咨询]                   │
│ 必须维护：[律所日常工作]                       │
├──────────────────────────────────────────────┤
│ 🤝 信任战略                                  │
│                                              │
│ 想被谁信任：[科技公司法务、创业者]             │
│ 他们怎么知道我：[公众号、知乎、行业会议]       │
│ 我的独特价值：[法律 + 技术双重背景]            │
│ 差异化：[专注 AI 法律，不做泛法律]             │
├──────────────────────────────────────────────┤
│ 🏷️ 关注话题                                  │
│                                              │
│ [AI法律] ★★★  [数据隐私] ★★★  [开源合规] ★★ │
│ [知识产权] ★★  [区块链] ★    [+ 添加话题]     │
└──────────────────────────────────────────────┘
```

### 3.5 Tab 4：外部可见性

**MVP 为手动输入表单。**

```
┌──────────────────────────────────────────────┐
│ 🌐 外部可见性审计                    [重新检测] │
│ 上次检测：2026-07-01                         │
├──────────────────────────────────────────────┤
│                                              │
│ 搜索引擎                                     │
│ ├── 百度搜"张三 律师"     找到 3 条  ⚠️      │
│ ├── 微信搜"张三 AI法律"   找到 0 条  ❌      │
│ └── 知乎搜"张三"          找到 1 条  ⚠️      │
│                                              │
│ AI 平台                                      │
│ ├── ChatGPT "AI法律专家"  未提及    ❌       │
│ ├── Kimi "科技法律"       未提及    ❌       │
│ └── 通义 "数据隐私律师"   未提及    ❌       │
│                                              │
│ 行业平台                                     │
│ ├── 裁判文书网            5 个案件  ✅       │
│ ├── 知网论文              0 篇      ❌       │
│ └── 行业媒体报道          0 次      ❌       │
│                                              │
│ AI 建议：                                    │
│ 1. 搜索结果太少——需要在知乎、公众号持续输出    │
│ 2. AI 平台都不知道你——需要积累公开内容         │
│ 3. 裁判文书是优势——把案例写成分析文章发布      │
└──────────────────────────────────────────────┘
```

## 4. 数据打通

### 4.1 画像 → 阅读模块

**改动位置**：`ArticleReader.vue` 的 `callAIStream` 函数

```ts
function getUserProfileContext(): string {
  const profile = loadProfile()
  const analysis = loadBehaviorAnalysis()
  const inference = loadInference()

  const parts: string[] = []

  // 目标
  if (profile.goals?.shortTerm) parts.push(`用户短期目标：${profile.goals.shortTerm}`)

  // 关注话题（高优先级）
  const highTopics = profile.topics?.filter(t => t.priority === 'high').map(t => t.name)
  if (highTopics?.length) parts.push(`重点关注：${highTopics.join('、')}`)

  // 瓶颈
  if (profile.constraints?.bottleneck) parts.push(`当前瓶颈：${profile.constraints.bottleneck}`)

  // 行为偏好
  if (analysis?.contentPreference) {
    const pref = Object.entries(analysis.contentPreference)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k, v]) => `${k}(${v}%)`)
      .join('、')
    parts.push(`内容偏好：${pref}`)
  }

  // AI 推断
  if (inference?.personality?.depthPreference) {
    parts.push(`深度偏好：${inference.personality.depthPreference}`)
  }

  return parts.length
    ? `\n\n【用户画像】\n${parts.join('\n')}\n请基于以上背景提供更贴合该用户需求的分析。`
    : ''
}
```

**影响的功能**：
- AI 摘要（`handleSummarize`）
- AI 翻译（`handleTranslate`）
- 提炼想法（`extractToIdea`）

### 4.2 画像 → 想法库

**改动位置**：`ArticleReader.vue` 的 `extractToIdea` 函数

```ts
// 提炼想法时，自动打上画像话题标签
function extractToIdea(ann: Annotation) {
  const profile = loadProfile()
  const parts = [`> ${ann.text}`]
  if (ann.comment) parts.push('', ann.comment)
  parts.push('', `📎 ${props.article.title}`)

  // 自动匹配话题标签
  const matchedTopics = profile.topics?.filter(t =>
    ann.text.includes(t.name) || ann.comment?.includes(t.name)
  ).map(t => t.name) || []
  if (matchedTopics.length) parts.push('', `🏷️ ${matchedTopics.join('、')}`)

  // 写入 scenes 格式
  createScene(parts.join('\n'), matchedTopics)
}
```

### 4.3 画像 → 编辑器

**改动位置**：编辑器的 AI 辅助功能

```ts
// 编辑器 AI 助手注入画像
function getEditorAIContext(): string {
  const profile = loadProfile()
  const inference = loadInference()

  return `
写作风格：${inference?.personality?.learningMode || '未分析'}
目标受众：${profile.trustStrategy?.targetAudience || '未设置'}
差异化定位：${profile.trustStrategy?.differentiation || '未设置'}
当前瓶颈：${profile.constraints?.bottleneck || '未设置'}
`
}
```

## 5. 实现计划

### Phase 1：行为数据采集（1-2 天）

- [ ] 创建 `composables/useBehaviorTracking.ts`
- [ ] 在 `ArticleReader.vue` 加 read_start / read_end 埋点
- [ ] 在 `ArticleReader.vue` 加 annotate / favorite / extract_idea 埋点
- [ ] 在 `ArticleListView.vue` 加 skip 埋点
- [ ] 存入 localStorage，保留 90 天
- [ ] 创建 `composables/useBehaviorAnalysis.ts` 统计分析

### Phase 2：画像仪表盘页面（1 天）

- [ ] 重构 `UserProfileView.vue` 为 4 Tab 布局
- [ ] Tab 1: 行为分析展示（统计卡片 + 标签云）
- [ ] Tab 3: 精简配置表单（目标、约束、信任战略、话题）
- [ ] 接入 localStorage 数据
- [ ] i18n 中英文

### Phase 3：AI 洞察（1 天）

- [ ] Tab 2: AI 推断展示
- [ ] 创建 `composables/useAIInference.ts`
- [ ] 手动触发生成推断
- [ ] 用户可确认/修正推断结果
- [ ] 推断结果存入 localStorage

### Phase 4：外部可见性（半天）

- [ ] Tab 4: 手动输入表单
- [ ] 搜索结果记录和评分
- [ ] AI 建议生成

### Phase 5：打通阅读模块（半天）

- [ ] `callAIStream` 注入画像上下文
- [ ] `extractToIdea` 自动打话题标签
- [ ] 验证效果

### Phase 6：后续迭代

- [ ] AI 自动搜索外部可见性（需要 API 权限）
- [ ] 信任仪表盘汇总视图
- [ ] 行为数据可视化图表（折线图、雷达图）
- [ ] 画像 → 编辑器 AI 写作建议
- [ ] 定期推送成长报告

## 6. 技术细节

### 6.1 存储方案

| 数据 | localStorage key | 更新频率 | 大小估算 |
|---|---|---|---|
| 行为事件 | `reading_behavior_events` | 实时 | ~50KB/月 |
| 行为分析 | `reading_behavior_analysis` | 每天聚合 | ~2KB |
| AI 推断 | `reading_ai_inference` | 每周 | ~3KB |
| 用户画像 | `reading_user_profile` | 用户手动 | ~2KB |
| 可见性审计 | `reading_visibility_audit` | 每月 | ~2KB |
| Ikigai 数据 | `reading_user_profile.ikigai` | 用户手动 | ~1KB（兼容） |

### 6.2 数据迁移

现有 `reading_user_profile` 结构：
```ts
{ ikigai, whoAmI, goals, interests }
```

新结构：
```ts
{ ikigai, goals, constraints, trustStrategy, topics, whoAmI, interests }
```

`whoAmI` 和 `interests` 保留向后兼容，新字段用 `??` 默认值。

### 6.3 AI Prompt 注入格式

```text
【用户画像】
用户短期目标：完成 10 篇 AI 法律案例分析
重点关注：AI法律、数据隐私
当前瓶颈：写作产出不够
内容偏好：案例分析(60%)、政策解读(25%)、新闻(15%)
深度偏好：depth
请基于以上背景提供更贴合该用户需求的分析。
```

## 7. 与现有功能的关系

| 现有功能 | 画像如何增强 |
|---|---|
| AI 摘要 | 注入画像上下文，摘要更个性化 |
| AI 翻译 | 注入画像上下文，翻译更贴合专业领域 |
| 提炼想法 | 自动匹配话题标签，按目标方向聚合 |
| 数据源管理 | 未来可基于画像推荐数据源 |
| 想法库 | 未来可按画像话题分组展示 |
| 编辑器 AI | 未来可注入写作风格和受众信息 |

## 8. 设计原则

1. **行为 > 自述**：系统观察到的比用户自己说的更真实
2. **自动 > 手动**：能自动采集的不要让用户填
3. **可执行 > 全面**：每个字段都要能驱动具体行为
4. **动态 > 静态**：画像随时间更新，不是一次性测评
5. **验证 > 假设**：外部可见性验证用户的目标是否现实
6. **信任为核心**：`信任 = 专业能力 × 持续输出 × 社交证明`，所有指标最终服务于建立信任

## 9. 现有模块在新架构中的定位

| 现有模块 | 定位 | 处理方式 |
|---|---|---|
| Ikigai 探索 | 用户配置层的「目标设定」补充 | **保留**，数据合并到 `user_profile.ikigai` |
| 生命之轮 | 行为数据层的「生活维度」基线 | **保留**，作为满意度基线，和行为数据对比 |
| 价值观排序 | 用户配置层的「决策准则」 | **保留**，注入 AI prompt 影响分析角度 |
| 能力图谱 | 用户配置层的「成长方向」 | **保留**，差距数据驱动行动计划 |
| 画像报告 | 汇总层 → 升级为「信任仪表盘」 | **改造**，从静态报告变为动态仪表盘 |

四个评估模块保留作为用户配置层的一部分，不废弃。新的四层模型在它们之上叠加行为数据和 AI 推断。
