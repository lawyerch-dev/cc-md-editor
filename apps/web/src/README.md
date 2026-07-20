# src/ 目录结构总览

```
src/
├── workspaces/          ← 工作区（按功能模块划分）
│   ├── editor/          Markdown 编辑器
│   ├── reading/         资讯阅读
│   ├── idea-board/      想法库
│   └── profile/         我的画像
├── shared/              ← 跨工作区共享
│   ├── stores/          全局 store（AI、认证、同步、UI）
│   ├── composables/     全局 composable（AI 调用、命令面板）
│   ├── components/      共享组件（AI、导航、首页）
│   ├── services/        业务服务（认证、同步、上传、导出）
│   └── types/           全局类型定义
├── components/ui/       ← Shadcn-Vue UI 原语（不修改）
├── storage/             ← 统一存储抽象层（localStorage + IndexedDB）
├── lib/                 ← 通用工具库（纯函数、无状态）
├── i18n/                ← 国际化（zh-CN + en-US）
├── entrypoints/         ← 浏览器扩展入口（WXT）
├── assets/              ← 静态资源（CSS、图片、示例）
├── App.vue              ← 根组件
├── main.ts              ← Web 应用入口
├── bootstrap.ts         ← 应用初始化
└── sidepanel.ts         ← 扩展侧边栏入口
```

## 核心原则

1. **工作区优先**：改某个功能时，所有相关文件在 `workspaces/<name>/` 下
2. **共享层独立**：`shared/` 不依赖任何 `workspaces/`
3. **工具库无依赖**：`lib/` 不引用 store/composable/component
4. **UI 原语不动**：`components/ui/` 是 Shadcn 约定，不修改内部实现
5. **每个文件有归属**：首行 `// @workspace <name>` 或 `<!-- @workspace <name> -->`

## 新增功能指南

| 场景 | 放哪 |
|---|---|
| 新工作区 | `workspaces/<name>/{stores,composables,components}/` |
| 跨工作区 store | `shared/stores/` |
| 跨工作区 composable | `shared/composables/` |
| 跨工作区组件 | `shared/components/<category>/` |
| 业务服务 | `shared/services/<domain>/` |
| 纯工具函数 | `lib/<category>/` |
| 翻译文本 | `i18n/messages/{zh-CN,en-US}/<module>.ts` |
