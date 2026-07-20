# workspaces/

工作区目录。每个子目录代表一个独立的功能模块，包含该模块的 store、composable 和组件。

## 目录结构

```
workspaces/
├── editor/          Markdown 编辑器
├── reading/         资讯阅读
├── idea-board/      想法库
└── profile/         我的画像
```

## 每个工作区的结构

```
<workspace>/
├── stores/          Pinia store（数据模型、业务逻辑）
├── composables/     Vue 组合式函数（可复用逻辑）
└── components/      Vue 组件（UI 表现层）
```

## 规则

- 工作区之间**不直接引用**，通过 `shared/` 中的共享层通信
- 每个工作区的 store、composable、component 可以自由互相引用
- 新增工作区时，在此目录下创建子目录，并在 `stores/ui.ts` 的 `currentView` 类型中添加新视图
