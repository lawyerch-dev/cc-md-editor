// @workspace shared
import type { AIContext, WorkspaceAIAdapter } from './types'

/**
 * AI 上下文注册中心 + 适配器管理。
 *
 * 各工作区在 onMounted 时注册自己的 WorkspaceAIAdapter，
 * 在 onUnmounted 时注销。当前活跃工作区的 adapter 会被自动识别。
 */
const adapters = ref<Map<string, WorkspaceAIAdapter>>(new Map())

/** 当前活跃的工作区 ID（由 useUIStore.currentView 驱动） */
const activeWorkspaceId = ref<string>('')

export function useAIContext() {
  /** 注册工作区适配器 */
  function register(adapter: WorkspaceAIAdapter) {
    adapters.value.set(adapter.id, adapter)
  }

  /** 注销工作区适配器 */
  function unregister(id: string) {
    adapters.value.delete(id)
  }

  /** 设置当前活跃工作区 */
  function setActiveWorkspace(id: string) {
    activeWorkspaceId.value = id
  }

  /** 获取当前活跃的适配器 */
  function getActiveAdapter(): WorkspaceAIAdapter | undefined {
    return adapters.value.get(activeWorkspaceId.value)
  }

  /** 收集当前活跃工作区的上下文 */
  async function collectContext(): Promise<AIContext> {
    const adapter = getActiveAdapter()
    if (!adapter) {
      return { workspaceId: activeWorkspaceId.value }
    }
    return adapter.collectContext()
  }

  /** 执行 action（分派到当前活跃 adapter） */
  async function executeAction(result: import('./types').ActionResult): Promise<boolean> {
    const adapter = getActiveAdapter()
    if (!adapter || !adapter.supportedActions.includes(result.type)) {
      return false
    }
    await adapter.execute(result)
    return true
  }

  return {
    adapters: computed(() => adapters.value),
    activeWorkspaceId: readonly(activeWorkspaceId),
    register,
    unregister,
    setActiveWorkspace,
    getActiveAdapter,
    collectContext,
    executeAction,
  }
}
