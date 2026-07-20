# components/ui/

Shadcn-Vue UI 原语组件库。

## 说明

这是从 [shadcn-vue](https://www.shadcn-vue.com/) 引入的基础 UI 组件，基于 Radix Vue 构建。**不要修改这些组件的内部实现**，除非有明确的 bug 需要修复。

## 包含的组件

| 组件 | 用途 |
|---|---|
| `button/` | 按钮 |
| `dialog/` | 模态对话框 |
| `dropdown-menu/` | 下拉菜单 |
| `input/` | 输入框 |
| `select/` | 选择器 |
| `tabs/` | 标签页 |
| `tooltip/` | 提示气泡 |
| `popover/` | 弹出层 |
| `checkbox/` | 复选框 |
| `switch/` | 开关 |
| `textarea/` | 文本域 |
| `progress/` | 进度条 |
| `menubar/` | 菜单栏 |
| `resizable/` | 可调整大小面板 |
| `sonner/` | Toast 通知 |
| ... | 等 |

## 使用方式

```vue
<script setup>
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
</script>
```

## 新增组件

如需新增 Shadcn 组件，使用 CLI：

```bash
pnpx shadcn-vue@latest add <component-name>
```
