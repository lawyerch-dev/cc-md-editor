# shared/stores/

跨工作区共享的 Pinia store。

| 文件 | 功能 |
|---|---|
| `ui.ts` | 全局 UI 状态（暗色模式、视图切换、对话框显示、预览设备等） |
| `auth.ts` | 账户认证（JWT、OAuth、用户信息） |
| `locale.ts` | 语言切换（zh-CN / en-US） |
| `confirm.ts` | 全局确认对话框 |
| `aiConfig.ts` | AI 文本/视觉/图片模型配置 |
| `aiImageConfig.ts` | AI 图片生成配置 |
| `aiPanel.ts` | AI 浮动面板状态（位置、大小、消息） |
| `quickCommands.ts` | AI 快捷指令管理 |
| `sync.ts` | 云同步状态机（push/pull） |
| `githubSync.ts` | GitHub 备份同步（全工作区数据） |
