# Tasks

- [x] Task 1: 创建装饰性背景组件 — 实现浮动几何图形（圆环、线条）的 CSS 动画，作为 LandingPage 的背景层
  - 创建 `apps/web/src/shared/components/landing/DecorativeBackground.vue`
  - SubTask 1.1: 实现浮动圆环元素，使用 CSS `@keyframes` 做旋转和浮动动画
  - SubTask 1.2: 实现装饰线条元素
  - SubTask 1.3: 确保不影响内容可读性（低透明度、位于 z-index 底层）
  - SubTask 1.4: 支持暗色/亮色模式自适应

- [x] Task 2: 增强排版与新增 i18n 文案 — 升级标题字号，添加角标/标语
  - SubTask 2.1: 更新 `zh-CN/landing.ts` 和 `en-US/landing.ts`，新增 `badge` 等文案
  - SubTask 2.2: 在 LandingPage.vue 中升级标题层级（`text-3xl` → `text-5xl`/`text-4xl`）
  - SubTask 2.3: 添加角标元素（如版本号 `v2.x` 或特色标签）

- [x] Task 3: 实现内容入场动画 — 标题和卡片的交错滑入动画
  - SubTask 3.1: 使用 Vue Transition 或 CSS animation 实现标题出场动画
  - SubTask 3.2: 实现 4 个卡片的交错入场（`transition-delay` 递增）
  - SubTask 3.3: 确保 `prefers-reduced-motion` 尊重用户无障碍设置

- [x] Task 4: 增强卡片悬停效果 — 改进 4 个工作区卡片的 hover 微交互
  - SubTask 4.1: 增加 hover 时卡片 scale 放大效果
  - SubTask 4.2: 增加 hover 时边框发光/渐变动画
  - SubTask 4.3: 增加 hover 时图标旋转或脉冲动画
  - SubTask 4.4: 保持各卡片主题色（蓝色/琥珀色/primary/翡翠绿）不变

- [x] Task 5: 动态背景效果 — 添加细微的渐变或粒子动画
  - SubTask 5.1: 实现 CSS 渐变动画背景
  - SubTask 5.2: 或实现轻量级粒子/光晕效果
  - SubTask 5.3: 确保性能（`transform`/`opacity` 动画，GPU 加速）

- [x] Task 6: 运行 lint 和类型检查 — 确保代码质量
  - SubTask 6.1: 运行 `pnpm run lint`
  - SubTask 6.2: 运行 `pnpm run type-check`
  - SubTask 6.3: 修复发现的问题

# Task Dependencies

- [Task 2] 需在 [Task 3] 之前完成（排版改了再动画）
- [Task 1] 和 [Task 2] 可并行执行
- [Task 3] 和 [Task 4] 可并行执行
- [Task 5] 独立，可任意时间执行
- [Task 6] 在所有代码变更完成后执行
