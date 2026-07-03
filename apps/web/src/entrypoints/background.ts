import { browser, defineBackground } from '#imports'
import { detectInitialLocale } from '@/i18n/detect'
import enUS from '@/i18n/messages/en-US/store'
import zhCN from '@/i18n/messages/zh-CN/store'

function getExtensionTitle(): string {
  return detectInitialLocale() === `en-US`
    ? enUS.extension.editorTitle
    : zhCN.extension.editorTitle
}

const FEED_REFRESH_ALARM = `feed-refresh`
const FEED_REFRESH_INTERVAL_MINUTES = 5

export default defineBackground({
  type: `module`,
  main() {
    // ── Install / Update ───────────────────────────────
    browser.runtime.onInstalled.addListener((detail) => {
      if (import.meta.env.COMMAND === `serve`) {
        browser.runtime.openOptionsPage()
        return
      }
      if (detail.reason === `install`) {
        browser.tabs.create({ url: `https://md-pages.doocs.org/welcome` })
        scheduleFeedRefresh()
      }
      else if (detail.reason === `update`) {
        browser.runtime.openOptionsPage()
      }
    })

    // ── Side panel context menu ────────────────────────
    browser.runtime.onInstalled.addListener(() => {
      if (typeof browser.sidePanel === `undefined`)
        return
      browser.contextMenus.create({
        id: `openSidePanel`,
        title: getExtensionTitle(),
        documentUrlPatterns: [`https://mp.weixin.qq.com/cgi-bin/appmsg*`],
        contexts: [`all`],
      })
    })

    browser.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === `openSidePanel` && tab?.id)
        browser.sidePanel.open({ tabId: tab.id })
    })

    // ── Background feed refresh via alarms ──────────────
    scheduleFeedRefresh()

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== FEED_REFRESH_ALARM)
        return
      // Notify content scripts to trigger feed refresh.
      // The composable useBackgroundRefresh listens for this message
      // and calls useReadingStore().fetchAll() in the DOM context.
      browser.runtime.sendMessage({ type: `refresh-feeds` }).catch(() => {
        // No listener registered — content script not loaded; ignore.
      })
    })
  },
})

function scheduleFeedRefresh(): void {
  browser.alarms.create(FEED_REFRESH_ALARM, {
    delayInMinutes: FEED_REFRESH_INTERVAL_MINUTES,
    periodInMinutes: FEED_REFRESH_INTERVAL_MINUTES,
  })
}
