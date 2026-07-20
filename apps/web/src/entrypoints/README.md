# entrypoints/

浏览器扩展入口点（WXT 框架）。

## 目录结构

```
entrypoints/
├── background.ts          Service Worker（后台脚本）
├── appmsg.content.ts      公众号编辑器内容脚本
├── injected.ts            注入脚本
└── popup/
    ├── popup.ts           弹出窗口入口
    ├── App.vue            弹出窗口根组件
    └── index.html         弹出窗口 HTML
```

## 说明

这些文件仅在构建浏览器扩展时使用。Web 应用的入口是 `main.ts`。

如需修改扩展行为，参考 [WXT 文档](https://wxt.dev/)。
