# workspaces/editor/

Markdown 编辑器工作区。

## stores/

| 文件 | 功能 |
|---|---|
| `post.ts` | 文章 CRUD、当前文档、排序、IndexedDB 持久化 |
| `editor.ts` | CodeMirror 6 编辑器实例管理、内容操作 |
| `render.ts` | Markdown 渲染管线、HTML 输出、标题提取 |
| `theme.ts` | 主题和样式配置（颜色、字体、代码块主题等） |
| `cssEditor.ts` | 自定义 CSS 编辑器管理 |
| `customComponent.ts` | 自定义 JSX 组件管理（如 QRCodeBlock） |
| `template.ts` | Markdown 模板 CRUD |
| `export.ts` | 导出功能（HTML/PDF/PNG/MD） |
| `folderSource.ts` | 本地文件夹 File System Access API |
| `mpAccounts.ts` | 微信公众号账号管理 |

## composables/

| 文件 | 功能 |
|---|---|
| `useScrollSync` | 编辑器↔预览区双向滚动同步 |
| `useCursorSync` | 点击预览区→定位编辑器光标 |
| `useEditorFormat` | 键盘格式化（加粗、斜体、标题等） |
| `useEditorRefresh` | 防抖触发预览重渲染 |
| `useEditorDocumentActions` | 文档操作（格式化、重置、清空） |
| `useInitialPreviewBoot` | 首次预览渲染完成后的启动屏关闭 |
| `useFolderFileSync` | 编辑器内容→本地文件夹同步 |
| `useImageUploader` | 图片上传（MD5 去重、多图床） |
| `useDeepLinkImport` | URL 参数 `?open=` 导入 |
| `useSlashCommand` | 斜杠命令菜单（CodeMirror 扩展） |
| `useSlashMenuPosition` | 斜杠菜单位置计算 |
| `useSlashMenuScrollHint` | 斜杠菜单滚动提示 |
| `slashCommands` | 斜杠命令定义（标题、列表、代码块等） |
| `useLocalizedStyleOptions` | 主题/样式选项的多语言化 |
| `useLocalizedBuiltinComponents` | 内置组件的多语言化 |
| `useLocalizedUploadHosts` | 上传图床选项的多语言化 |

## components/

| 目录/文件 | 功能 |
|---|---|
| `CodemirrorEditor.vue` | CodeMirror 编辑器主组件 |
| `EditorPanel.vue` | 编辑器面板（组合编辑器+工具栏） |
| `PreviewPanel.vue` | 预览面板 |
| `Footer.vue` | 底部状态栏 |
| `RightSlider.vue` | 右侧滑出面板 |
| `CssEditor.vue` | CSS 编辑器面板 |
| `SlashCommandMenu.vue` | 斜杠命令弹出菜单 |
| `EditorContextMenu.vue` | 右键上下文菜单 |
| `FormItem.vue` | 表单项组件 |
| `dialogs/` | 各种对话框（偏好设置、上传图片、模板等） |
| `editor-header/` | 顶部工具栏（文件、编辑、格式、分享等下拉菜单） |
| `post-slider/` | 文章列表侧边栏 |
| `folder-source-panel/` | 本地文件夹面板 |
