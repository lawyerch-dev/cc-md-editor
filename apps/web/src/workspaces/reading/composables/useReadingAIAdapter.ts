// @workspace reading
import type { ActionResult, AIContext, WorkspaceAIAdapter } from '@/shared/composables/ai'

/**
 * 阅读工作区 AI 适配器。
 *
 * 提供：当前文章标题+内容+摘要作为上下文
 * 支持：annotation / text-insert / none
 */
export function useReadingAdapter(opts: {
  getActiveArticle: () => { id: string, title: string, content: string, summary: string, author: string } | null
  addAnnotation?: (articleId: string, content: string) => void
}): WorkspaceAIAdapter {
  return {
    id: 'reading',

    async collectContext(): Promise<AIContext> {
      const article = opts.getActiveArticle()
      if (!article) {
        return { workspaceId: 'reading' }
      }

      const metadata: Record<string, unknown> = {
        articleTitle: article.title,
        articleAuthor: article.author,
      }

      return {
        workspaceId: 'reading',
        documentContent: article.content || article.summary,
        metadata,
      }
    },

    supportedActions: ['annotation', 'text-insert', 'none'],

    execute(result: ActionResult) {
      if (result.type === 'none')
        return

      if (result.type === 'annotation' && opts.addAnnotation) {
        opts.addAnnotation(result.articleId, result.content)
      }

      if (result.type === 'text-insert' && result.position === 'cursor') {
        // 阅读模式下没有编辑器，复制到剪贴板
        navigator.clipboard.writeText(result.content).catch(() => {})
      }
    },
  }
}
