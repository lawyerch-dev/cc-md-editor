// @workspace reading

// ── RSSHub 配置 ────────────────────────────────────

let _rsshubBaseUrl = ''

/** 设置自建 RSSHub 地址（有值时跳过 Folo API，直接走 RSSHub） */
export function setRsshubBaseUrl(url: string) {
  _rsshubBaseUrl = url.replace(/\/+$/, '')
}

/** 获取 RSSHub 地址 */
export function getRsshubBaseUrl(): string {
  return _rsshubBaseUrl
}

/** RSSHub 镜像回退列表（用户未配置自建时默认使用） */
export const RSSHUB_FALLBACK_BASES = [
  'https://rsshub.app',
]

/** 获取所有可用的 RSSHub 基地址（自定义优先） */
export function getRsshubBases(): string[] {
  const custom = _rsshubBaseUrl ? [_rsshubBaseUrl] : []
  return [...custom, ...RSSHUB_FALLBACK_BASES]
}

/** 判断 URL 是否由 RSSHub 提供 */
export function isRsshubUrl(url: string): boolean {
  return url.includes('rsshub.app') || url.startsWith('rsshub://')
}

/** 拼接 RSSHub 基地址与路由路径 */
export function buildRsshubUrl(base: string, path: string): string {
  return base + (path.startsWith('/') ? '' : '/') + path
}
