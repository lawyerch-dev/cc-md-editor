// @workspace reading
import { onMounted, onUnmounted } from 'vue'
import { browser } from '#imports'
import { useReadingStore } from '@/workspaces/reading/stores'

interface RefreshFeedsMessage {
  type: `refresh-feeds`
}

function isRefreshFeedsMessage(msg: unknown): msg is RefreshFeedsMessage {
  return typeof msg === `object` && msg !== null && (msg as RefreshFeedsMessage).type === `refresh-feeds`
}

/** 判断当前是否运行在浏览器扩展上下文 */
function isExtensionContext(): boolean {
  try {
    return typeof browser !== `undefined` && !!browser.runtime?.id
  }
  catch {
    return false
  }
}

/**
 * Web 端后台刷新兜底：页面可见时 + 定时器检查到期源。
 * 与扩展 alarm 互不冲突：扩展上下文优先走 runtime message。
 */
export function useBackgroundRefresh(): void {
  const readingStore = useReadingStore()

  function handleMessage(msg: unknown, _sender: unknown, sendResponse: (response?: unknown) => void): boolean {
    if (isRefreshFeedsMessage(msg)) {
      // Fire and forget — fetchAll manages its own loading/error state.
      void readingStore.fetchAll(false, true)
      sendResponse({ ok: true })
    }
    return false
  }

  function handleSwMessage(event: MessageEvent<unknown>) {
    if (isRefreshFeedsMessage(event.data)) {
      void readingStore.fetchAll(false, true)
    }
  }

  /** 检查是否有源已经到期，有则触发后台刷新 */
  function refreshIfOverdue() {
    const now = Date.now()
    const overdue = readingStore.sources.some((src) => {
      if (src.refreshInterval <= 0)
        return false
      const lastFetch = readingStore.lastFetchMap[src.id] || 0
      return now - lastFetch >= src.refreshInterval * 60 * 1000
    })
    if (overdue)
      void readingStore.fetchAll(false, true)
  }

  let visibilityTimer: ReturnType<typeof setInterval> | null = null
  const VISIBILITY_CHECK_INTERVAL_MS = 5 * 60 * 1000

  function handleVisibilityChange() {
    if (document.hidden) {
      if (visibilityTimer) {
        clearInterval(visibilityTimer)
        visibilityTimer = null
      }
      return
    }
    // 页面重新可见时立即检查一次
    refreshIfOverdue()
    // 可见期间每 5 分钟检查一次
    if (!visibilityTimer) {
      visibilityTimer = setInterval(refreshIfOverdue, VISIBILITY_CHECK_INTERVAL_MS)
    }
  }

  onMounted(() => {
    if (isExtensionContext()) {
      browser.runtime.onMessage.addListener(handleMessage)
      return
    }

    // Web / PWA 兜底：Page Visibility + 定时器
    document.addEventListener(`visibilitychange`, handleVisibilityChange)
    navigator.serviceWorker?.addEventListener(`message`, handleSwMessage)
    if (!document.hidden)
      handleVisibilityChange()
  })

  onUnmounted(() => {
    if (isExtensionContext()) {
      try {
        browser.runtime.onMessage.removeListener(handleMessage)
      }
      catch {
        // ignore
      }
      return
    }

    document.removeEventListener(`visibilitychange`, handleVisibilityChange)
    navigator.serviceWorker?.removeEventListener(`message`, handleSwMessage)
    if (visibilityTimer) {
      clearInterval(visibilityTimer)
      visibilityTimer = null
    }
  })
}
