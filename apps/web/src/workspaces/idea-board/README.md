# workspaces/idea-board/

想法库工作区。便签墙 + Excalidraw 画布，用于收集和整理想法。

## stores/

| 文件 | 功能 |
|---|---|
| `index.ts` | 便签 CRUD、分组、搜索、置顶、选中、导出 |

## components/

| 文件 | 功能 |
|---|---|
| `IdeaBoard.vue` | 主视图（便签墙 + 画布分栏） |
| `StickyNoteCard.vue` | 便签卡片组件 |
| `ExcalidrawWrapper.vue` | Excalidraw 画布封装 |
| `MermaidAIDialog.vue` | AI 生成 Mermaid 图表 |
| `AIDraftDialog.vue` | AI 草稿生成 |
