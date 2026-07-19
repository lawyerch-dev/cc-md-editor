// @workspace shared
import { isAccountConfigured } from '@/shared/services/account/config'
import { isSyncUiEnabled } from '@/shared/services/sync/client'

/** 初始化账户与云同步（需在 Pinia 就绪后调用） */
export function useAccountSyncBootstrap() {
  const authStore = useAuthStore()
  const syncStore = useSyncStore()
  let cloudSyncReady = false

  async function ensureCloudSync(): Promise<void> {
    if (!isSyncUiEnabled() || !authStore.isLoggedIn)
      return

    if (!cloudSyncReady) {
      syncStore.startAutoSyncWatcher()
      cloudSyncReady = true
    }
    void syncStore.sync()
  }

  onMounted(async () => {
    if (isAccountConfigured())
      await authStore.bootstrap()

    await ensureCloudSync()
  })

  watch(() => authStore.isLoggedIn, (loggedIn) => {
    if (loggedIn)
      void ensureCloudSync()
  })
}
