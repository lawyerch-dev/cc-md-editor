import type { Plugin } from 'vite'
import path from 'node:path'

import process from 'node:process'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import { VitePluginRadar } from 'vite-plugin-radar'
import vueDevTools from 'vite-plugin-vue-devtools'

import { utoolsLocalAssetsPlugin } from './plugins/vite-plugin-utools-local-assets'

const isNetlify = process.env.SERVER_ENV === `NETLIFY`
const isUTools = process.env.SERVER_ENV === `UTOOLS`
const isCfWorkers = process.env.CF_WORKERS === `1`
const isCfPages = process.env.CF_PAGES === `1`

const base = isNetlify || isCfWorkers || isCfPages ? `/` : isUTools ? `./` : `/md/`

const PKG_NAME_SPECIAL_CHARS = /[^\w-]/g

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    base,
    server: {
      port: 5180,
      proxy: {
        '/.netlify/functions': {
          target: 'http://localhost:9999',
          changeOrigin: true,
        },
        // 本地开发代理 Folo API（绕过 CORS）
        '/api/folo': {
          target: 'https://api.folo.is',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/folo/, ''),
        },
      },
    },
    envPrefix: [`VITE_`, `CF_`],
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: tag => tag === `math-field`,
          },
        },
      }),
      isCfWorkers && cloudflare(),
      tailwindcss(),
      mode === `development` && env.VITE_VUE_DEVTOOLS === `true` && vueDevTools({
        launchEditor: env.VITE_LAUNCH_EDITOR ?? `code`,
      }),
      !isUTools && VitePluginRadar({
        analytics: { id: `G-7NZL3PZ0NK` },
      }),
      ...(process.env.ANALYZE === `true`
        ? [visualizer({ emitFile: true, filename: `stats.html` }) as Plugin]
        : []),
      AutoImport({
        imports: [`vue`, `pinia`, `@vueuse/core`, `vue-i18n`],
        dirs: [`./src/stores`, `./src/lib/toast`, `./src/composables/editor`, `./src/composables/shared`, `./src/composables/reading`],
      }),
      Components({
        resolvers: [],
      }),
      isUTools && utoolsLocalAssetsPlugin(),
      // Strip modulepreload for large vendor chunks — they'll load on demand via dynamic import
      {
        name: `strip-large-modulepreload`,
        transformIndexHtml(html) {
          const LARGE_CHUNKS = [`vendor_excalidraw`, `vendor_mermaid`, `codemirror-N`, `prettier`, `highlight-D`, `vendor_viz`, `vendor_aws`, `katex-DPk`, `vendor_cytoscape`, `vendor_d3-`, `vendor_dagre`, `vendor_lodash-`, `vendor_measury`, `vendor_culori`]
          return html.replace(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g, (tag, href) => {
            if (LARGE_CHUNKS.some(chunk => href.includes(chunk)))
              return `<!-- stripped: ${href} -->`
            return tag
          })
        },
      } as Plugin,
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, `./src`) },
      dedupe: [`@codemirror/state`, `@codemirror/view`],
    },
    optimizeDeps: {
      include: [
        `vue`,
        `pinia`,
        `vue-i18n`,
        `@vueuse/core`,
        `marked`,
        `juice`,
        `isomorphic-dompurify`,
        `crypto-js`,
        `jszip`,
        `spark-md5`,
        `es-toolkit`,
        `html-to-image`,
        `diff-match-patch`,
        `uuid`,
      ],
    },
    define: {
      'process.env': JSON.stringify({ NODE_ENV: mode }),
    },
    css: { devSourcemap: true },
    build: {
      cssCodeSplit: false,
      rolldownOptions: {
        onwarn(warning, warn) {
          // @vueuse/core 中的 /* #__PURE__ */ 注释位置不符合 Rolldown 要求，忽略该警告
          if (warning.code === `INVALID_ANNOTATION` && warning.message?.includes(`@vueuse/core`))
            return
          warn(warning)
        },
        output: {
          chunkFileNames: `static/js/md-[name]-[hash].js`,
          entryFileNames: `static/js/md-[name]-[hash].js`,
          assetFileNames: `static/[ext]/md-[name]-[hash].[ext]`,
          manualChunks(id) {
            if (!id.includes(`node_modules`))
              return

            // Only match actual npm packages, not @md/core source files (e.g. extensions/mermaid.ts)
            const isPnpm = id.includes(`/.pnpm/`)
            const afterNodeModules = (idx: string) => {
              const nm = idx.lastIndexOf(`/node_modules/`)
              return nm !== -1 ? idx.slice(nm + `/node_modules/`.length) : ``
            }

            // For .pnpm paths, extract the real package name
            if (isPnpm) {
              const after = afterNodeModules(id)
              const pkgSegment = after.startsWith(`@`) ? `${after.split(`/`)[0]}/${after.split(`/`)[1]}` : after.split(`/`)[0]

              // Heavy vendor chunks — match real package names only
              if (pkgSegment === `mermaid` || pkgSegment.startsWith(`mermaid`))
                return `vendor_mermaid`
              if (pkgSegment.startsWith(`@codemirror`) || pkgSegment.startsWith(`@lezer`))
                return `codemirror`
              if (pkgSegment === `katex`)
                return `katex`
              if (pkgSegment === `prettier` || pkgSegment.startsWith(`prettier/`))
                return `prettier`
              if (pkgSegment === `highlight.js`)
                return `highlight`
              if (pkgSegment === `@excalidraw` || pkgSegment.startsWith(`@excalidraw/`))
                return `vendor_excalidraw`

              // d3/antv/cytoscape/dagre — many tiny packages → one chunk
              if (pkgSegment.startsWith(`d3-`) || pkgSegment.startsWith(`d3/`)
                || pkgSegment.startsWith(`@antv`) || pkgSegment === `cytoscape` || pkgSegment === `cose-base`
                || pkgSegment === `dagre` || pkgSegment === `graphlib` || pkgSegment === `khroma`) {
                return `vendor_viz`
              }

              // AWS SDK — one chunk
              if (pkgSegment.startsWith(`@aws-sdk`) || pkgSegment.startsWith(`@aws-crypto`))
                return `vendor_aws`

              // Vue core
              if (pkgSegment === `vue` || pkgSegment === `@vue/runtime-dom` || pkgSegment === `@vue/runtime-core`
                || pkgSegment === `@vue/reactivity` || pkgSegment === `@vue/shared` || pkgSegment === `@vue/compiler-core`
                || pkgSegment === `@vue/compiler-dom` || pkgSegment === `@vue/compiler-sfc` || pkgSegment === `@vue/compiler-ssr`) {
                return `vendor_vue`
              }
              if (pkgSegment === `pinia` || pkgSegment.startsWith(`@pinia/`))
                return `vendor_vue`
              if (pkgSegment === `@vueuse` || pkgSegment.startsWith(`@vueuse/`))
                return `vendor_vueuse`

              const np = pkgSegment.replace(/^@/, `npm_`).replace(PKG_NAME_SPECIAL_CHARS, `_`)
              return `vendor_${np}`
            }

            // Non-.pnpm node_modules (rare in pnpm monorepos)
            if (id.includes(`codemirror`) || id.includes(`@lezer`))
              return `codemirror`
            if (id.includes(`katex`))
              return `katex`
            if (id.includes(`prettier`))
              return `prettier`
            if (id.includes(`highlight.js`))
              return `highlight`
            if (id.includes(`excalidraw`))
              return `vendor_excalidraw`
            if (id.includes(`mermaid`))
              return `vendor_mermaid`

            // d3/antv/cytoscape/dagre — many tiny packages → one chunk
            if (id.includes(`d3-`) || id.includes(`d3/`) || id.includes(`antv/`)
              || id.includes(`@antv`) || id.includes(`cytoscape`) || id.includes(`cose-base`)
              || id.includes(`dagre`) || id.includes(`graphlib`) || id.includes(`khroma`)) {
              return `vendor_viz`
            }

            // AWS SDK — one chunk
            if (id.includes(`@aws-sdk`) || id.includes(`@aws-crypto`))
              return `vendor_aws`

            const pkg = id.split(`node_modules/`)[1].split(`/`)[0].replace(`@`, `npm_`)
            const np = pkg.replace(PKG_NAME_SPECIAL_CHARS, `_`)
            return `vendor_${np}`
          },
        },
      },
      chunkSizeWarningLimit: 2000,
    },
  }
})
