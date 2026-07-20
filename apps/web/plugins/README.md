# plugins/

Vite 构建插件。

## 文件说明

| 文件 | 功能 |
|---|---|
| `vite-plugin-utools-local-assets.ts` | uTools 平台构建时，将远程 CDN 资源替换为本地文件 |

## uTools 本地资源插件

uTools 是一个桌面插件平台。uTools 插件运行在本地，无法可靠访问 CDN。

此插件在 `SERVER_ENV=UTOOLS` 构建时：
1. 将 HTML 中 MathJax 的 CDN URL 替换为本地路径
2. 将 `node_modules/mathjax/es5/` 复制到构建输出目录

仅在 uTools 构建时生效，Web 应用和浏览器扩展不受影响。
