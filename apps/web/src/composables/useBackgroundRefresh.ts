// @workspace reading
import type { Runtime } from 'wxt/browser'
import { onMounted, onUnmounted } from 'vue'
import { browser } from '#imports'
import { useReadingStore } from '@/stores/reading'

interface RefreshFeedsMessage {
  type: `refresh-feeds`
}

function isRefreshFeedsMessage(msg: unknown): msg is RefreshFeedsMessage {
  return typeof msg === `object` && msg !== null && (msg as RefreshFeedsMessage).type === `refresh-feeds`
}

/**
 * Listens for `refresh-feeds` messages from the background service worker
 * and triggers feed refresh via the reading store.
 *
 * The background script uses `chrome.alarms` to fire periodically and sends
 * `{ type: 'refresh-feeds' }` via `browser.runtime.sendMessage`. This
 * composable runs in the content / side-panel context where the Pinia store
 * is available.
 */
export function useBackgroundRefresh(): void {
  const readingStore = useReadingStore()

  function handleMessage(msg: unknown, _sender: Runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean {
    if (isRefreshFeedsMessage(msg)) {
      // Fire and forget — fetchAll manages its own loading/error state.
      void readingStore.fetchAll()
      sendResponse({ ok: true })
    }
    // Return false; we don't need to keep the message channel open.
    return false
  }

  onMounted(() => {
    browser.runtime.onMessage.addListener(handleMessage)
  })

  onUnmounted(() => {
    browser.runtime.onMessage.removeListener(handleMessage)
  })
}
