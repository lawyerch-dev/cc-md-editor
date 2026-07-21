// @workspace ideaBoard
import type { ActionResult, WorkspaceAIAdapter } from '@/shared/composables/ai'

/**
 * 想法库工作区 AI 适配器。
 *
 * 提供：当前场景标题 + 描述 + 白板截图作为上下文
 * 支持：excalidraw-elements / note-create / none
 */
export function useIdeaBoardAdapter(opts: {
  getSceneInfo: () => { title: string, desc: string } | null
  getScreenshot: () => Promise<File | null>
  addElements: (json: string) => Promise<boolean>
  createNote?: (content: string, x: number, y: number, color: string) => void
}): WorkspaceAIAdapter {
  return {
    id: 'ideaBoard',

    async collectContext() {
      const scene = opts.getSceneInfo()
      const metadata: Record<string, unknown> = {}
      if (scene) {
        metadata.sceneTitle = scene.title
        metadata.sceneDesc = scene.desc
      }

      // 截图转 data URL
      const images: string[] = []
      const screenshot = await opts.getScreenshot()
      if (screenshot) {
        const dataUrl = await fileToDataUrl(screenshot)
        if (dataUrl)
          images.push(dataUrl)
      }

      return {
        workspaceId: 'ideaBoard',
        images,
        metadata,
      }
    },

    supportedActions: ['excalidraw-elements', 'note-create', 'none'],

    async execute(result: ActionResult) {
      if (result.type === 'none')
        return

      if (result.type === 'excalidraw-elements') {
        await opts.addElements(JSON.stringify(result.elements))
      }

      if (result.type === 'note-create' && opts.createNote) {
        opts.createNote(result.content, result.x, result.y, result.color)
      }
    },
  }
}

function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    try {
      reader.readAsDataURL(file)
    }
    catch {
      resolve(null)
    }
  })
}
