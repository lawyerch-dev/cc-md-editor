# i18n/

国际化（internationalization）模块。

## 目录结构

```
i18n/
├── index.ts                    vue-i18n 实例创建
├── translate.ts                翻译辅助函数（t, te）
├── types.ts                    类型定义（AppLocale）
├── constants.ts                常量（存储键）
├── detect.ts                   语言检测（浏览器 → 存储 → 默认）
├── builtin-component-examples.ts  内置组件的多语言示例
└── messages/
    ├── zh-CN/                  中文翻译
    │   ├── index.ts            模块注册
    │   ├── common.ts           通用文本
    │   ├── editor.ts           编辑器
    │   ├── reading.ts          资讯阅读
    │   ├── ideaBoard.ts        想法库
    │   ├── ai.ts               AI 功能
    │   └── ...
    └── en-US/                  英文翻译（同结构）
```

## 规则

- **所有用户可见文本必须使用 i18n**，禁止硬编码中文/英文
- 新增模块时必须同时提供 `zh-CN` 和 `en-US` 翻译
- 翻译 key 命名：`module.feature.label`，如 `reading.sourceManage`
- 在组件中使用：`const { t } = useI18n()` → `t('module.key')`
