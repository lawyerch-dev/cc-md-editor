// @workspace reading

// ── RSSHub 发现 ────────────────────────────────────────

/** 输入 URL，查询 RSSHub API 获取可用的 RSS 路由 */
export async function discoverRSSHubRoutes(url: string): Promise<Array<{ name: string, path: string }>> {
  try {
    const domain = new URL(url).hostname

    // 优先使用 Netlify Function 代理
    try {
      const fnUrl = `${window.location.origin}/.netlify/functions/rsshub-discover`
      const fnRes = await window.fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
        signal: AbortSignal.timeout(12_000),
      })
      if (fnRes.ok) {
        const data = await fnRes.json() as { ok?: boolean, routes?: Array<{ name: string, path: string }> }
        if (data.ok && Array.isArray(data.routes))
          return data.routes
      }
    }
    catch { /* 回退到直接请求 */ }

    const res = await window.fetch(`https://rsshub.app/v1/website?domain=${domain}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok)
      return []
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'routes' in data) {
      const routes = (data as Record<string, unknown>).routes
      if (Array.isArray(routes)) {
        return routes.filter((r): r is string => typeof r === 'string').map(r => ({
          name: r,
          path: `https://rsshub.app${r}`,
        }))
      }
    }
    return []
  }
  catch {
    return []
  }
}
