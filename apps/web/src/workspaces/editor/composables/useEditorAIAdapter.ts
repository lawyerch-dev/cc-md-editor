// @workspace editor
import type { ActionResult, StreamSink, WorkspaceAIAdapter } from '@/shared/composables/ai'
import { Transaction } from '@codemirror/state'
import { useEditorStore } from '@/workspaces/editor/stores/editor'
import { usePostStore } from '@/workspaces/editor/stores/post'

/**
 * 编辑器工作区 AI 适配器。
 *
 * 提供：选中文本 + 文档内容作为上下文
 * 支持：text-replace / text-insert / none
 * 流式：实时写入编辑器（续写/润色场景）
 */
export function useEditorAdapter(): WorkspaceAIAdapter {
  const editorStore = useEditorStore()
  const postStore = usePostStore()

  function getEditorView() {
    return editorStore.editor
  }

  return {
    id: 'editor',

    async collectContext() {
      const view = getEditorView()
      const selectedText = editorStore.getSelection() || undefined
      const documentContent = view?.state.doc.toString() || postStore.currentPost?.content || undefined

      return {
        workspaceId: 'editor',
        selectedText,
        documentContent,
        metadata: {
          postTitle: postStore.currentPost?.title,
        },
      }
    },

    supportedActions: ['text-replace', 'text-insert', 'none'],

    execute(result: ActionResult) {
      const view = getEditorView()
      if (!view || result.type === 'none')
        return

      if (result.type === 'text-replace') {
        const { range, content } = result
        if (range) {
          view.dispatch({
            changes: { from: range.from, to: range.to, insert: content },
          })
        }
        else {
          view.dispatch(view.state.replaceSelection(content))
        }
      }

      if (result.type === 'text-insert') {
        const { position, content } = result
        if (position === 'cursor') {
          view.dispatch(view.state.replaceSelection(content))
        }
        else {
          // 插入到文档末尾
          const len = view.state.doc.length
          view.dispatch({
            changes: { from: len, to: len, insert: `\n${content}` },
          })
        }
      }
    },

    stream: createEditorStreamSink(),
  }

  function createEditorStreamSink(): StreamSink {
    let startPos = 0
    let cursorPos = 0

    return {
      start() {
        const view = getEditorView()
        if (!view)
          return
        startPos = view.state.selection.main.head
        cursorPos = startPos
      },

      token(text: string) {
        const view = getEditorView()
        if (!view)
          return
        view.dispatch({
          changes: { from: cursorPos, insert: text },
          annotations: Transaction.addToHistory.of(false),
        })
        cursorPos += text.length
      },

      done() {
        return { type: 'none' as const }
      },

      cancel() {
        const view = getEditorView()
        if (!view)
          return
        if (cursorPos > startPos) {
          view.dispatch({
            changes: { from: startPos, to: cursorPos, insert: '' },
          })
        }
        cursorPos = startPos
      },
    }
  }
}
