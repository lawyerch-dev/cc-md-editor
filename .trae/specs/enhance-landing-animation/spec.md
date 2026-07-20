# 首页动态增强 Spec

## Why

当前首页（LandingPage.vue）布局简洁但缺乏视觉动感，与产品"New-AI 智能工作台"的定位不够匹配。参考 GrowthRevolution 的动态设计语言，在不改变现有架构和功能的前提下，通过动画、装饰元素和视觉层次升级，让首页更有活力和品质感。

## What Changes

- **装饰性背景元素**：添加浮动几何图形（圆环、线条），营造空间层次感
- **入场动画**：标题和卡片在页面加载时以交错方式滑入
- **卡片悬停效果增强**：增加光晕、边框动画、图标旋转等微交互
- **排版增强**：加大标题字号，添加标语/角标装饰
- **动态背景**：添加细微的渐变或粒子动画
- **整体氛围**：全屏居中布局不变，但增加视觉丰富度

## Impact

- Affected specs: 无破坏性变更
- Affected code:
  - `apps/web/src/shared/components/landing/LandingPage.vue` — 主要修改文件
  - `apps/web/src/i18n/messages/zh-CN/landing.ts` — 新增 i18n 文案
  - `apps/web/src/i18n/messages/en-US/landing.ts` — 新增 i18n 文案
  - `apps/web/src/shared/components/landing/` — 可能新增子组件

## ADDED Requirements

### Requirement: 装饰性背景动画
The system SHALL display animated decorative elements in the landing page background.

#### Scenario: 页面加载时背景元素自动动画
- **WHEN** 用户打开首页
- **THEN** 页面背景中应出现浮动的几何装饰元素（圆环、线条等），以 CSS 动画持续运动

### Requirement: 内容入场动画
The system SHALL animate landing page content elements on page load.

#### Scenario: 元素交错入场
- **WHEN** 页面加载完成
- **THEN** 标题、副标题、4 个工作区卡片应按顺序交错滑入，每个元素间隔约 100ms

### Requirement: 卡片悬停微交互
The system SHALL enhance workspace card hover effects.

#### Scenario: 鼠标悬停卡片
- **WHEN** 用户将鼠标悬停在工作区卡片上
- **THEN** 卡片应有放大（scale 1.02-1.05）、边框发光、图标旋转等组合动画反馈
- **AND** 每个卡片的主题色（蓝色/琥珀色/primary/翡翠绿）应保持不变

### Requirement: 排版增强
The system SHALL enhance typography hierarchy on the landing page.

#### Scenario: 标题放大加角标
- **WHEN** 首页渲染
- **THEN** 标题字号应从 `text-3xl` 增大（如 `text-4xl` 或 `text-5xl`），并添加一个"角标"元素（如版本号或特色标签）
- **AND** 副标题应保持可读性

### Requirement: i18n 支持
The system SHALL support i18n for new text elements.

#### Scenario: 新增文案双语覆盖
- **WHEN** 添加任何新文案
- **THEN** 必须在 `zh-CN/landing.ts` 和 `en-US/landing.ts` 中同时添加对应翻译

## MODIFIED Requirements

### Requirement: 现有首页功能保持不变
顶部工具栏（语言切换、主题切换、AI 设置、更新日志按钮）的功能和位置维持不变。
4 个工作区卡片（资讯阅读、想法库、MD编辑器、我的画像）的点击导航功能维持不变。
暗色/亮色模式切换功能维持不变。

## REMOVED Requirements

无
