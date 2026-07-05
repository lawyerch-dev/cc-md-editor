# Copilot Instructions

This repository is a pnpm monorepo containing a Vue 3 web application, a VSCode extension, and a core markdown rendering library.

## Build, Test, and Lint

### Global Commands
- **Install Dependencies:** `pnpm install`
- **Lint (ESLint + Prettier):** `pnpm run lint`
- **Type Check (Vue/TS):** `pnpm run type-check`

### Web App (@md/web)
- **Development Server:** `pnpm web dev`
- **Build for Production:** `pnpm web build`
- **Build Browser Extension:** `pnpm web ext:zip` (uses WXT)

### VSCode Extension (@md/vscode)
- **Development:** `pnpm vscode`

### CLI (@doocs/md-cli)
- **Build CLI:** `pnpm run build:cli`

## High-Level Architecture

### Monorepo Structure
- **apps/web**: The main application. Built with Vue 3, Vite, Pinia, and Tailwind CSS. It functions as both a web app and a browser extension (via WXT).
- **packages/core**: The markdown rendering engine. It wraps `marked` and implements custom extensions (Mermaid, PlantUML, Ruby, etc.) and theme injection.
- **packages/shared**: Shared utilities and configurations.
- **packages/md-cli**: A CLI wrapper that serves the built web application.

### Key Technologies
- **Frontend Framework:** Vue 3 (Composition API)
- **Build System:** Vite 8
- **State Management:** Pinia
- **Styling:** Tailwind CSS 4 + PostCSS + Custom CSS Variables for themes.
- **Markdown Parsing:** `marked` (in `@md/core`)
- **Editor Component:** CodeMirror 6
- **Extension Framework:** WXT (Web Extension Tools)
- **IndexedDB:** `idb` library (reading module direct persistence)
- **Internationalization:** `vue-i18n` (composition API, `legacy: false`)

## Key Conventions

### Development Patterns
- **Direct TypeScript Imports:** The `@md/core` and `@md/shared` packages export TypeScript source files directly (`src/index.ts`). Do not attempt to build these packages separately; they are compiled by the consumer's build tool (Vite).
- **UI Components:** The project uses Shadcn-Vue style components located in `apps/web/src/components/ui`. Prefer using these over raw HTML/CSS.
- **Store Structure:** State is divided into domain-specific Pinia stores (e.g., `useEditorStore`, `useThemeStore`, `useUIStore`) located in `apps/web/src/stores`.

### Internationalization (i18n)
**所有用户可见文本必须使用 i18n，禁止硬编码中文/英文。**

- 翻译文件：`apps/web/src/i18n/messages/{zh-CN,en-US}/`
- 每个模块一个翻译文件（如 `reading.ts`、`ideaBoard.ts`），并在 `index.ts` 中注册
- 在组件中使用：`const { t } = useI18n()`，模板中 `{{ t('module.key') }}`
- 新增模块时必须同时提供 `zh-CN` 和 `en-US` 翻译
- 翻译 key 命名：`module.feature.label`，如 `reading.sourceManage`、`ideaBoard.newNote`
- 动态参数：`t('reading.articles', { count: 30 })` → "30 篇文章" / "30 articles"
- 按钮、标签、占位符、提示文字、错误信息全部需要翻译

### Application Structure (3 Workspaces)
应用包含 3 个工作区，通过 `useUIStore().currentView` 切换：

```
apps/web/src/
├── components/
│   ├── LandingPage.vue          # 主页（工作区选择）
│   ├── editor/                  # Markdown 编辑器工作区
│   │   ├── CodemirrorEditor.vue
│   │   ├── EditorPanel.vue
│   │   ├── PreviewPanel.vue
│   │   └── dialogs/             # 编辑器对话框
│   ├── reading/                 # 资讯阅读工作区
│   │   ├── ReadingView.vue      # 主视图（自适应布局）
│   │   ├── ArticleReader.vue    # 文章阅读器
│   │   ├── MediaArticleReader.vue # 多媒体文章阅读器
│   │   ├── ArticleAnnotator.vue # 批注系统
│   │   ├── SourceConfigDialog.vue # 数据源管理（列表 + 导入/导出）
│   │   ├── AddSourceDialog.vue  # 添加/编辑数据源（统一）
│   │   ├── CSSImportDialog.vue  # CSS 选择器采集规则导入
│   │   └── views/               # 多媒体视图组件
│   │       ├── ArticleListView.vue   # 文章列表视图
│   │       ├── PictureGridView.vue   # 图片网格视图
│   │       ├── PictureMasonryView.vue # 图片瀑布流视图
│   │       ├── VideoGridView.vue     # 视频网格视图
│   │       ├── AudioPlayerView.vue   # 音频播放器列表
│   │       ├── PodcastInlinePlayer.vue # 播客内联播放器
│   │       ├── CornerPlayer.vue      # 全局角落音频播放器
│   │       ├── SocialMediaView.vue   # 社交媒体视图
│   │       ├── ImageLightbox.vue     # 图片灯箱预览
│   │       └── MediaRenderer.vue     # 多媒体内容渲染
│   ├── idea-board/              # 想法库工作区
│   │   ├── IdeaBoard.vue        # 主视图
│   │   ├── ExcalidrawWrapper.vue # Excalidraw 画布
│   │   ├── MermaidAIDialog.vue  # AI 生成 Mermaid 图表
│   │   ├── AIDraftDialog.vue    # AI 草稿生成
│   │   └── StickyNoteCard.vue   # 便签卡片
│   ├── landing/                 # 首页相关组件
│   │   ├── ChangelogDialog.vue  # 更新日志弹窗
│   │   └── changelog-data.ts    # 版本日志数据
│   ├── shared/                  # 跨工作区共享组件
│   │   ├── ViewNav.vue          # 顶部导航栏
│   │   └── SyncButton.vue       # 同步按钮
│   ├── ai/                      # AI 功能组件
│   │   ├── SidebarAIToolbar.vue # 侧边栏 AI 工具栏
│   │   ├── chat-box/            # AI 对话组件
│   │   │   ├── AIConfig.vue     # AI 配置面板
│   │   │   ├── FloatingAIPanel.vue # 浮动 AI 对话面板
│   │   │   ├── AIAssistantPanel.vue # AI 助手面板
│   │   │   └── QuickCommandManager.vue # 快捷指令管理
│   │   ├── image-generator/     # AI 图片生成
│   │   │   ├── AIImageGeneratorPanel.vue # 图片生成面板
│   │   │   └── AIImageConfig.vue # 图片生成配置
│   │   └── tool-box/            # AI 工具箱
│   │       └── ToolBoxPopover.vue
│   └── ui/                      # Shadcn-Vue 基础组件
│       ├── back-top/            # 返回顶部
│       ├── sonner/              # Toast 通知
│       └── ...                  # 其他 UI 组件（dialog, button, tabs 等）
├── stores/                      # Pinia 状态管理
│   ├── ui.ts                    # 全局 UI 状态（视图切换、暗色模式）
│   ├── reading.ts               # 资讯阅读数据（向后兼容入口）
│   └── reading/                 # 资讯阅读模块
│       ├── index.ts             # useReadingStore + re-exports
│       ├── types.ts             # Source, Article, FeedViewType, MediaItem 等接口
│       ├── fetch-strategies.ts  # RSS / CSS / Folo / CORS 代理策略
│       ├── persistence.ts       # localStorage + V1→V2 迁移
│       ├── indexeddb-persistence.ts # IndexedDB 直接持久化（idb 库）
│       └── folo-import.ts       # OPML + Folo SQLite follow.db 导入
│   ├── ideaBoard.ts             # 想法库数据
│   ├── editor.ts                # 编辑器状态
│   ├── aiConfig.ts              # AI 模型配置
│   ├── aiPanel.ts               # AI 面板状态
│   ├── aiImageConfig.ts         # AI 图片生成配置
│   ├── githubSync.ts            # GitHub 同步状态
│   ├── export.ts                # 导出功能
│   ├── template.ts              # 模板管理
│   ├── quickCommands.ts         # 快捷指令
│   ├── auth.ts                  # 认证状态
│   ├── folderSource.ts          # 文件夹数据源集成
│   ├── mpAccounts.ts            # 微信公众号账号
│   ├── confirm.ts               # 全局确认对话框
│   └── locale.ts                # 语言设置
├── composables/                 # 组合式函数
│   ├── useAudioPlayer.ts        # 全局音频播放器单例
│   ├── useBackgroundRefresh.ts  # 后台自动刷新
│   ├── useSyncStatusMeta.ts     # 同步状态元数据
│   ├── useCollectorAI.ts        # 采集器 AI 分析
│   ├── useDynamicAIModels.ts    # 动态 AI 模型列表
│   └── useAIFetch.ts            # AI API 调用
└── i18n/                        # 国际化
    ├── messages/
    │   ├── zh-CN/               # 中文翻译
    │   │   ├── index.ts         # 注册所有模块
    │   │   ├── common.ts        # 通用文本
    │   │   ├── editor.ts        # 编辑器
    │   │   ├── dialog.ts        # 对话框
    │   │   ├── store.ts         # Store 提示
    │   │   ├── upload.ts        # 上传
    │   │   ├── chrome.ts        # 浏览器扩展
    │   │   ├── ai.ts            # AI 功能
    │   │   ├── reading.ts       # 资讯阅读
    │   │   ├── ideaBoard.ts     # 想法库
    │   │   └── changelog.ts     # 更新日志
    │   └── en-US/               # 英文翻译（同结构）
    └── index.ts
```

### Adding a New Workspace
1. 创建组件目录：`apps/web/src/components/your-workspace/`
2. 创建翻译文件：`i18n/messages/{zh-CN,en-US}/yourWorkspace.ts`
3. 在 `i18n/messages/*/index.ts` 注册翻译模块
4. 在 `stores/ui.ts` 的 `currentView` 类型中添加新视图
5. 在 `LandingPage.vue` 添加入口卡片
6. 在 `components/shared/ViewNav.vue` 添加导航项
7. 所有用户可见文本使用 `t('yourWorkspace.key')`

### Adding a New Feature to Existing Workspace
1. 如需新的翻译 key，在对应的 `i18n/messages/*/xxx.ts` 中添加中英文
2. 组件中 `const { t } = useI18n()` 后使用 `t('module.key')`
3. 禁止在模板中硬编码任何用户可见文本

### Styling & Theming
- **Theme Injection:** Theming is handled by `@md/core/src/theme`. Themes are applied by injecting CSS variables into the DOM.
- **CSS processing:** Uses PostCSS and Tailwind. Global styles are in `apps/web/src/assets`.

### Markdown Extensions
- **Implementation:** New markdown features should be implemented as extensions in `@md/core/src/extensions`.
- **Registration:** Extensions must be registered in the renderer configuration.

### Git Conventions
- **Commit Messages:** Follow Conventional Commits (`feat`, `fix`, `docs`, `chore`, etc.).
- **Branch Naming:** `feat/description`, `fix/description`.

### WeChat (公众号) 兼容性
复制到公众号后台时，CSS 通过 juice 内联。**公众号编辑器不支持以下 CSS 特性**，主题开发时必须注意：

- **`::after` / `::before` 伪元素** — 公众号会完全剥离。`content` 属性中的 unicode 转义（如 `\25A0`）会被 juice 拆成乱码。需要在 `apps/web/src/services/export/clipboard.ts` 的 `processPseudoElementsForWeChat()` 中转成真正的 HTML 元素。
- **`::first-letter` 伪元素** — 公众号不支持。需要在 `processFirstLetterForWeChat()` 中转成 `<span>` 包裹首字。
- **`display: inline-block` + `margin: auto`** — 不会水平居中。需要改成 `display: block; width: fit-content; margin-left: auto; margin-right: auto`。
- **CSS 变量（`var(--xxx)`）** — juice 的 `resolveCSSVariables: false`，不解析变量。复制流程中通过字符串替换手动处理关键变量。
- **`hsl(var(--foreground))`** — 替换为 `#3f3f3f`。
- **`<blockquote>` 超 300 字** — 公众号会报"不合理引用"错误。复制时将 `<blockquote>` 转为 `<div>`（样式已由 juice 内联）。
- **`<ul>/<ol>/<li>`** — 公众号渲染有 bug（重复圆点、序号全变 1）。复制时转为纯文本 `<p>` 段落。
- **列表 `padding-left`** — 主题 CSS 统一使用 `0.5em`，避免缩进过大。

**新增主题时**，如果使用了伪元素（`::after`、`::before`、`::first-letter`），必须在 `clipboard.ts` 中添加对应的公众号兼容处理，否则复制后效果丢失。
