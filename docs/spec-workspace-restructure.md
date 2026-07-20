# Spec: 工作区重构 — AI 驱动的成长飞轮

## Objective

将 New-AI 智能工作台从「4 个独立工具」重构为「AI 驱动的成长飞轮」。

**核心哲学：**
- AI 了解你 → 规划路径 → 督促疯狂输出 → 输出带来名和利 → 阶层跃迁
- 输入不是目的，输出才是。输入只是输出的弹药。
- 成功 = 提升与他人的交互 → 取得信任 → 提升名 → 提升利

**关键约束：**
- 不是简单重命名，是架构级重构
- AI 是主导驱动，不是辅助工具
- 不影响现有功能正常使用
- 结构可扩展，后续不断新增功能卡片

## LandingPage 设计

### 飞轮布局

首页采用「成长飞轮」布局：

```
                    ┌─────────┐
                    │  🧭 Coach │  ← 知己区（顶部）
                    │  诊断·规划 │
                    └─────────┘
                         │
    ┌─────────┐         │         ┌─────────┐
    │ 📡 Radar │ ←───────┼───────→ │📊 Report│
    │ 信息输入  │    ┌────▼────┐   │ 数据战报  │
    └─────────┘    │         │   └─────────┘
                   │  🔄 成长 │
                   │   飞轮   │
    ┌─────────┐    │         │   ┌─────────┐
    │💡 Insight│ ←──┼─────────┼──→│✍️ Output│
    │ 洞察孵化  │    └─────────┘   │ 疯狂输出  │
    └─────────┘                    └─────────┘
```

**中心：** 圆形成长飞轮动画（CSS 动画，展示 5 个阶段循环转动）

**5 个辐射区：** 每个区是一个功能模块，包含多张功能卡片

### 功能卡片体系

每个工作区（Zone）包含多张功能卡片，卡片可独立开发和添加：

#### 🧭 Coach 知己区
| 卡片 | 说明 | Phase |
|------|------|-------|
| AI 诊断 | 问卷+对话了解你 | 1 |
| 目标设定 | AI 帮你定 3 个月目标 | 1 |
| 任务拆解 | 目标→周任务→日任务 | 1 |
| 每日督导 | AI 每天提醒你该做什么 | 2 |
| 周复盘 | AI 每周总结进展 | 2 |

#### 📡 Radar 雷达区
| 卡片 | 说明 | Phase |
|------|------|-------|
| 信息流 | RSS 订阅（现有功能） | 1 |
| AI 筛选 | AI 根据目标推送内容 | 2 |
| 素材标注 | 阅读时标注可用素材 | 2 |
| 热点追踪 | 行业热点自动追踪 | 3 |

#### 💡 Insight 洞察区
| 卡片 | 说明 | Phase |
|------|------|-------|
| 白板画布 | Excalidraw（现有功能） | 1 |
| 素材池 | 自动聚类素材 | 2 |
| 关联发现 | AI 发现素材间关联 | 2 |
| 孵化器 | 素材→大纲→输出 | 3 |

#### ✍️ Output 输出区
| 卡片 | 说明 | Phase |
|------|------|-------|
| 编辑器 | Markdown 编辑（现有功能） | 1 |
| 多平台发布 | 一键适配多平台 | 2 |
| AI 写作助手 | AI 辅助写作 | 2 |
| 变现工具 | 电子书/课程打包 | 3 |

#### 📊 Report 战报区
| 卡片 | 说明 | Phase |
|------|------|-------|
| 手动数据录入 | 用户输入关键数据 | 1 |
| 趋势分析 | AI 分析数据趋势 | 2 |
| 平台对接 | 自动拉取平台数据 | 3 |
| 阶层跃迁追踪 | 进度可视化 | 2 |

### 首页技术实现

```vue
<!-- LandingPage.vue 结构 -->
<template>
  <div class="flywheel-page">
    <!-- 顶部标题 -->
    <header>New-AI 智能工作台</header>

    <!-- 中心飞轮 -->
    <div class="flywheel-center">
      <FlywheelDiagram />  <!-- CSS 动画圆形飞轮 -->
    </div>

    <!-- 5 个辐射区 -->
    <div class="zones">
      <WorkspaceZone v-for="zone in zones" :key="zone.id" :zone="zone">
        <FunctionCard v-for="card in zone.cards" :key="card.id" :card="card" />
      </WorkspaceZone>
    </div>
  </div>
</template>
```

**数据结构：**
```ts
interface WorkspaceZone {
  id: string           // 'coach' | 'radar' | 'insight' | 'output' | 'report'
  name: string         // '知己'
  nameEn: string       // 'Coach'
  icon: string         // Lucide icon name
  color: string        // 主题色
  description: string  // 副标题
  cards: FunctionCard[]
}

interface FunctionCard {
  id: string           // 'diagnosis' | 'goal-setting' | ...
  name: string         // 'AI 诊断'
  description: string  // '问卷+对话了解你'
  icon: string         // Lucide icon name
  phase: number        // 1 | 2 | 3
  enabled: boolean     // 是否已实现
  view?: string        // 点击后跳转的 view
}
```

## AI 主导架构

### 不是「用户用 AI 工具」，是「AI 带用户成长」

**当前架构（工具导向）：**
```
用户 → 打开编辑器 → 手动写作 → 手动发布
用户 → 打开阅读器 → 手动阅读 → 手动记录
```

**新架构（AI 主导）：**
```
AI → 分析你的目标 → 告诉你今天该做什么
AI → 推送你需要读的内容 → 自动标注可用素材
AI → 用素材帮你生成大纲 → 辅助你快速输出
AI → 分析你的数据 → 告诉你哪里需要调整
```

### AI 主导的具体体现

1. **AI 是教练，不是工具**
   - 知己区：AI 主动诊断、规划、督导
   - 不是用户问 AI，是 AI 主动找用户

2. **AI 是编辑，不是打字员**
   - 输出区：AI 从洞察库拉素材生成大纲
   - 不是用户写完让 AI 润色，是 AI 帮用户写得更快

3. **AI 是经纪人，不是客服**
   - 战报区：AI 分析数据，建议下一步行动
   - 不是用户看数据，是 AI 告诉用户意味着什么

## 不影响现有功能

**原则：** 现有功能全部保留，只是重新组织到新的分区结构中。

| 现有功能 | 新归属 | 改动 |
|---------|--------|------|
| 资讯阅读 | 📡 Radar → 信息流卡片 | 重命名，功能不变 |
| 想法库 | 💡 Insight → 白板画布卡片 | 重命名，功能不变 |
| Markdown 编辑器 | ✍️ Output → 编辑器卡片 | 重命名，功能不变 |
| 我的画像 | 🧭 Coach → 重构为 AI 诊断 | 功能重构 |

## Tech Stack

- Vue 3 + Composition API
- shadcn-vue 组件
- Tailwind CSS（飞轮动画用 CSS animation）
- 已有 AI 模块：useAI / useAIConversation / useAIContext
- 存储：localStorage + IndexedDB（通过 @/storage）

## Commands

```bash
pnpm web dev          # 开发
pnpm run type-check   # 类型检查
pnpm web build        # 构建
```

## Project Structure

```
apps/web/src/
├── workspaces/
│   ├── coach/           → 🧭 知己（新建，替代 profile）
│   │   ├── components/
│   │   │   ├── CoachView.vue        # 主视图
│   │   │   ├── DiagnosisCard.vue    # AI 诊断卡片
│   │   │   ├── GoalSettingCard.vue  # 目标设定卡片
│   │   │   └── TaskBreakdownCard.vue# 任务拆解卡片
│   │   ├── composables/
│   │   │   └── useCoachAI.ts        # 知己 AI 逻辑
│   │   ├── stores/
│   │   │   └── index.ts             # 目标/任务/画像数据
│   │   └── types.ts
│   ├── radar/           → 📡 雷达（重命名 reading）
│   ├── insight/         → 💡 洞察（重命名 idea-board）
│   ├── output/          → ✍️ 输出（重命名 editor）
│   └── report/          → 📊 战报（新建）
│       ├── components/
│       │   ├── ReportView.vue       # 主视图
│       │   ├── DataEntryCard.vue    # 手动数据录入
│       │   └── TrendCard.vue        # 趋势分析
│       ├── stores/
│       │   └── index.ts             # 战报数据
│       └── types.ts
├── shared/
│   ├── components/
│   │   └── landing/
│   │       ├── LandingPage.vue      # 飞轮布局首页
│   │       ├── FlywheelDiagram.vue  # 中心飞轮动画
│   │       ├── WorkspaceZone.vue    # 工作区辐射区
│   │       └── FunctionCard.vue     # 功能卡片组件
│   ├── stores/
│   │   └── ui.ts                    # currentView 类型更新
│   └── types/
│       └── workspace.ts            # WorkspaceZone/FunctionCard 类型
```

## Code Style

遵循项目现有约定：
- i18n：所有用户可见文本使用 `t('module.key')`
- Store：Pinia composition API，`defineStore`
- 组件：`<script setup lang="ts">` + shadcn-vue
- 样式：Tailwind CSS，支持浅色/深色模式

## Testing Strategy

- 类型检查：`pnpm run type-check` 必须通过
- 手动验证：每个工作区的核心流程可在浏览器中运行
- 无单元测试（与项目现有约定一致）

## Boundaries

- **Always do：** i18n；类型检查通过；现有功能不受影响
- **Ask first：** 删除现有功能；改变存储格式；新增外部依赖
- **Never do：** 硬编码颜色值；破坏现有工作区功能

## Success Criteria

1. LandingPage 显示成长飞轮布局，中心有圆形动画
2. 5 个辐射区各含功能卡片，点击可进入对应功能
3. Coach 工作区有 AI 诊断对话界面（问卷+对话）
4. Report 工作区有手动数据录入和基本看板
5. 所有现有工作区功能不受影响（阅读/编辑器/想法库）
6. 类型检查通过
7. 功能卡片结构可扩展（后续新增卡片不需要改架构）

## Phased Implementation

### Phase 1：基础设施 + Coach + Report（本次）
- 更新 currentView 类型和路由
- 新建 LandingPage 飞轮布局
- 新建 Coach 工作区（AI 诊断问卷 + 目标设定）
- 新建 Report 工作区（手动数据录入 + 基本看板）
- 保留现有工作区功能

### Phase 2：AI 驱动增强
- Coach：每日督导 + 周复盘
- Radar：AI 筛选推送 + 素材标注
- Insight：素材池 + 关联发现
- Output：AI 写作助手
- Report：趋势分析 + 阶层跃迁追踪

### Phase 3：变现闭环
- Output：多平台发布 + 变现工具
- Report：平台数据自动拉取
- Insight：输出孵化器

## Open Questions

1. 飞轮动画的具体视觉效果？（CSS animation 还是 SVG？）
2. Coach 的诊断问卷具体有哪些问题？
3. Report 的数据维度有哪些？
