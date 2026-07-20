# shared/

跨工作区共享代码。所有工作区共用的基础设施都在这里。

## 目录结构

```
shared/
├── stores/          全局 Pinia store（AI 配置、认证、同步、UI 状态等）
├── composables/     全局组合式函数（AI 调用、命令面板、快捷键等）
├── components/      共享组件
│   ├── ai/          AI 相关组件（对话面板、图片生成、工具箱）
│   ├── navigation/  导航组件（ViewNav、SyncButton、确认对话框）
│   ├── landing/     首页组件（LandingPage、更新日志）
│   └── icons/       图标组件
├── services/        业务服务层
│   ├── account/     账户认证（JWT、OAuth）
│   ├── sync/        云同步（push/pull 合并策略）
│   ├── ai/          AI 服务适配（SiliconFlow 等）
│   ├── upload/      图片上传（多图床支持）
│   ├── export/      导出服务（HTML/PDF/PNG/MD）
│   ├── share/       分享服务
│   └── github/      GitHub API 客户端
└── types/           全局 TypeScript 类型定义
```

## 规则

- `shared/` 不依赖任何 `workspaces/` 目录
- 所有工作区都可以引用 `shared/` 中的代码
- 新增跨工作区功能放在这里，不要放到某个工作区里
