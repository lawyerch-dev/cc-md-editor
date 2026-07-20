# lib/

通用工具库。与业务逻辑无关的纯函数、工具类、辅助方法。

## 目录结构

```
lib/
├── utils.ts               通用工具函数（cn 合并类名等）
├── keyboard-shortcuts.ts  键盘快捷键配置
├── a11y/                  无障碍辅助（对话框焦点管理）
├── bootstrap/             应用启动（组件注册、启动屏、日志配置）
├── browser/               浏览器 API 封装（剪贴板）
├── format/                格式化工具（相对时间）
├── markdown/              Markdown 解析工具（公式、标题提取、导航）
├── preview/               预览区工具（图表渲染、MathJax、就绪检测）
├── toast/                 Toast 通知工具
└── upload/                上传工具（图片校验）
```

## 规则

- **不引用** `stores/`、`composables/`、`components/` 中的代码
- 只包含纯函数和无状态工具
- 可以被任何地方引用
