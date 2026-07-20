// @workspace shared
/**
 * AI 统一架构 — 类型定义
 *
 * 三层设计：
 * 1. AIContext — 各工作区提供给 AI 的上下文
 * 2. ActionResult — AI 产出的结构化结果，由 adapter 执行
 * 3. WorkspaceAIAdapter — 工作区适配器接口
 */

// ── 上下文 ─────────────────────────────────────────────────

/** AI 可消费的统一上下文 */
export interface AIContext {
  workspaceId: string
  selectedText?: string
  documentContent?: string
  images?: string[] // data URLs (截图、选中图片)
  metadata?: Record<string, unknown>
}

// ── 动作结果 ───────────────────────────────────────────────

/** AI 产出的结构化结果，由 adapter 分派执行 */
export type ActionResult
  = | TextReplaceAction
    | TextInsertAction
    | ExcalidrawElementsAction
    | NoteCreateAction
    | AnnotationAction
    | NavigateAction
    | NoneAction

export interface TextReplaceAction {
  type: 'text-replace'
  range?: { from: number, to: number }
  content: string
}

export interface TextInsertAction {
  type: 'text-insert'
  position: 'cursor' | 'end'
  content: string
}

export interface ExcalidrawElementsAction {
  type: 'excalidraw-elements'
  elements: unknown[]
}

export interface NoteCreateAction {
  type: 'note-create'
  content: string
  x: number
  y: number
  color: string
}

export interface AnnotationAction {
  type: 'annotation'
  articleId: string
  content: string
}

export interface NavigateAction {
  type: 'navigate'
  route: string
}

export interface NoneAction {
  type: 'none'
}

// ── 流式写入回调 ───────────────────────────────────────────

/** 流式 token 实时写入工作区（续写/润色/Mermaid 预览） */
export interface StreamSink {
  /** 准备接收（如锁定撤销历史、记录起始位置） */
  start: () => void
  /** 每个 token 实时写入工作区 */
  token: (text: string) => void
  /** 流结束，返回最终 ActionResult */
  done: (finalText: string) => ActionResult
  /** 用户中断，回滚到 start 前状态 */
  cancel: () => void
}

// ── 工作区适配器 ───────────────────────────────────────────

export interface WorkspaceAIAdapter {
  /** 工作区唯一标识 */
  id: string

  /** 收集当前工作区上下文 */
  collectContext: () => Promise<AIContext> | AIContext

  /** 本工作区支持的 action 类型 */
  supportedActions: ActionResult['type'][]

  /** 执行 AI 产出的 action */
  execute: (result: ActionResult) => Promise<void> | void

  /** 流式写入（续写/润色场景，可选） */
  stream?: StreamSink
}

// ── AI 调用选项 ────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIMessageContent[]
}

export interface AIMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface AIAskOptions {
  messages: AIMessage[]
  model?: 'text' | 'vision'
  onToken?: (token: string) => void
  onReasoningToken?: (token: string) => void
  onDone?: (fullText: string) => void
  onError?: (err: Error) => void
  signal?: AbortSignal
}
