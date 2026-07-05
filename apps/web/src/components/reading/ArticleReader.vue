<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { BookOpen, ExternalLink, Languages, MessageSquarePlus, Sparkles, Star, X } from '@lucide/vue'
import DOMPurify from 'dompurify'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildAIHeaders, resolveEndpointUrl } from '@/composables/useAIFetch'
import { useAIConfigStore } from '@/stores/aiConfig'
import { useReadingStore } from '@/stores/reading'
import PodcastInlinePlayer from './views/PodcastInlinePlayer.vue'

const props = defineProps<{
  article: Article
}>()

const readingStore = useReadingStore()
const aiConfig = useAIConfigStore()
const { t } = useI18n()

const sanitize = (html: string) => DOMPurify.sanitize(html.replace(/\[!--begin:\w+--\][\s\S]*?\[!--end:\w+--\]/g, ''), { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] })

function formatDate(ts: number) {
  const diff = Date.now() - ts
  if (diff < 3600000)
    return t('reading.justNow')
  if (diff < 86400000)
    return t('reading.hoursAgo', { n: Math.floor(diff / 3600000) })
  if (diff < 604800000)
    return t('reading.daysAgo', { n: Math.floor(diff / 86400000) })
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 双语对照：将 HTML 拆分成段落块 */
const fullTextContent = ref('')

const bilingualBlocks = computed(() => {
  const content = fullTextContent.value || props.article.content || props.article.summary || ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html')
  const container = doc.body.firstElementChild
  if (!container)
    return []
  return Array.from(container.children).map(el => ({
    html: el.outerHTML,
    text: el.textContent?.trim() || '',
  }))
})

// ── AI 摘要 + 翻译 ──────────────────────────────────────
const aiPanelTab = ref<'summary' | null>(null)
const aiLoading = ref(false)
const aiResult = ref('')
const aiError = ref('')
const translateTarget = ref<'zh' | 'en' | 'ja'>('en')
const fullTextLoading = ref(false)
const fullTextError = ref('')
const translating = ref(false)
const translatedParagraphs = ref<Record<number, string>>({})
const translationActive = ref(false)

let currentAIAbort: AbortController | null = null

// 切换文章时，如果内容为空，自动提取全文
watch(() => props.article.id, async (id, oldId) => {
  if (id === oldId)
    return
  if (currentAIAbort) { currentAIAbort.abort(); currentAIAbort = null }
  fullTextContent.value = ''
  fullTextError.value = ''
  aiResult.value = ''
  aiError.value = ''
  aiPanelTab.value = null
  translatedParagraphs.value = {}
  translationActive.value = false
  translating.value = false
  // ponytail: media articles (video/audio/picture) already have their content, skip fetching original HTML
  const isMediaArticle = props.article.media?.length > 0
  const content = props.article.content || props.article.summary || ''
  const textLen = content.replace(/<[^>]*>/g, '').trim().length
  if (!isMediaArticle && textLen < 200 && props.article.link) {
    fullTextLoading.value = true
    fullTextError.value = ''
    try {
      fullTextContent.value = await readingStore.fetchFullText(props.article.link)
      if (!fullTextContent.value || fullTextContent.value.replace(/<[^>]*>/g, '').trim().length < 50) {
        fullTextError.value = t('reading.contentExtractFailed')
      }
      else {
        // 缓存到 store，同会话内切换回来不再重复抓取
        const stored = readingStore.articles.find(a => a.id === props.article.id)
        if (stored)
          stored.content = fullTextContent.value
      }
    }
    catch (e) {
      console.warn('自动全文提取失败:', e)
      fullTextError.value = t('reading.contentLoadFailed') + (e instanceof Error ? `: ${e.message.slice(0, 80)}` : '')
    }
    finally { fullTextLoading.value = false }
  }
}, { immediate: true })

async function callAIStream(
  systemPrompt: string,
  userContent: string,
  onDelta: (text: string) => void,
): Promise<string> {
  if (currentAIAbort)
    currentAIAbort.abort()
  currentAIAbort = new AbortController()
  const signal = currentAIAbort.signal
  const endpoint = aiConfig.textEndpoint || aiConfig.endpoint
  const apiKey = aiConfig.textApiKey || aiConfig.apiKey
  const model = aiConfig.textModel || aiConfig.model
  const type = aiConfig.textType || aiConfig.type
  const url = resolveEndpointUrl(endpoint, 'chat')
  const headers = buildAIHeaders(apiKey, type)
  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true,
  }
  const res = await window.fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal })
  if (!res.ok)
    throw new Error(t('reading.aiRequestFailed', { status: res.status }))
  const reader = res.body?.getReader()
  if (!reader)
    throw new Error(t('reading.streamReadFailed'))
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim() || line.trim() === 'data: [DONE]')
        continue
      try {
        const delta = JSON.parse(line.replace(/^data: /, '')).choices?.[0]?.delta?.content
        if (delta) { full += delta; onDelta(delta) }
      }
      catch { /* skip */ }
    }
  }
  return full
}

async function handleSummarize() {
  aiPanelTab.value = 'summary'
  aiLoading.value = true
  aiError.value = ''
  aiResult.value = ''
  try {
    const content = fullTextContent.value || props.article.content || props.article.summary
    const text = content.replace(/<[^>]*>/g, '').slice(0, 4000)
    await callAIStream(
      '你是一个专业的文章摘要助手。请用简洁的中文总结文章的核心要点，使用 bullet points 格式。不超过 5 条。',
      `标题：${props.article.title}\n\n正文：${text}`,
      (delta) => { aiResult.value += delta },
    )
  }
  catch (e) {
    if (!currentAIAbort?.signal.aborted)
      aiError.value = e instanceof Error ? e.message : t('reading.summaryFailed')
  }
  finally { aiLoading.value = false; currentAIAbort = null }
}

async function handleTranslate() {
  if (translating.value) {
    translating.value = false
    translationActive.value = false
    translatedParagraphs.value = {}
    return
  }
  translating.value = true
  translationActive.value = true
  translatedParagraphs.value = {}
  const blocks = bilingualBlocks.value
  const langName = translateTarget.value === 'zh' ? '中文' : translateTarget.value === 'en' ? 'English' : '日本語'
  try {
    for (let i = 0; i < blocks.length && translating.value; i++) {
      const text = blocks[i].text
      if (!text || text.length < 5)
        continue
      translatedParagraphs.value[i] = ''
      await callAIStream(
        `翻译成${langName}，只输出翻译结果，不要解释。`,
        text,
        (delta) => { translatedParagraphs.value[i] = (translatedParagraphs.value[i] || '') + delta },
      )
    }
  }
  catch (e) {
    if (!currentAIAbort?.signal.aborted)
      console.warn('翻译失败:', e)
  }
  finally { translating.value = false; currentAIAbort = null }
}

// ── 批注 ──────────────────────────────────────────────

interface Annotation {
  id: string
  articleId: string
  text: string
  comment: string
  createdAt: number
}

const ANN_STORAGE_KEY = 'reading_annotations'
const annotations = ref<Annotation[]>([])
const annPopup = ref<{ x: number, y: number, text: string } | null>(null)
const activeAnnId = ref<string | null>(null)
const annPanelOpen = ref(true)
const contentRef = ref<HTMLElement | null>(null)

function loadAnnotations() {
  try {
    const raw = localStorage.getItem(ANN_STORAGE_KEY)
    const all: Annotation[] = raw ? JSON.parse(raw) : []
    annotations.value = all.filter(a => a.articleId === props.article.id)
  }
  catch { annotations.value = [] }
}

function saveAnnotations(updated: Annotation[]) {
  annotations.value = updated
  try {
    const raw = localStorage.getItem(ANN_STORAGE_KEY)
    const all: Annotation[] = raw ? JSON.parse(raw) : []
    const others = all.filter(a => a.articleId !== props.article.id)
    localStorage.setItem(ANN_STORAGE_KEY, JSON.stringify([...others, ...updated]))
  }
  catch { /* ignore */ }
}

function handleAnnMouseUp(_e: MouseEvent) {
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (!text || text.length < 2) { annPopup.value = null; return }
  const range = sel?.getRangeAt(0)
  if (!range || !contentRef.value?.contains(range.commonAncestorContainer))
    return
  const rect = range.getBoundingClientRect()
  annPopup.value = { x: rect.right + 8, y: rect.top, text }
}

function createAnnotation() {
  if (!annPopup.value)
    return
  const ann: Annotation = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    articleId: props.article.id,
    text: annPopup.value.text,
    comment: '',
    createdAt: Date.now(),
  }
  saveAnnotations([...annotations.value, ann])
  annPopup.value = null
  activeAnnId.value = ann.id
  annPanelOpen.value = true
  nextTick(() => highlightAnn(ann))
}

function removeAnnotation(id: string) {
  const spans = contentRef.value?.querySelectorAll(`[data-ann-id="${id}"]`)
  spans?.forEach((span) => {
    const parent = span.parentNode
    if (parent) { while (span.firstChild) parent.insertBefore(span.firstChild, span); parent.removeChild(span) }
  })
  saveAnnotations(annotations.value.filter(a => a.id !== id))
  if (activeAnnId.value === id)
    activeAnnId.value = null
}

function updateAnnComment(id: string, value: string) {
  saveAnnotations(annotations.value.map(a => a.id === id ? { ...a, comment: value } : a))
}

function highlightAnn(ann: Annotation) {
  if (!contentRef.value)
    return
  const body = contentRef.value.querySelector('.article-body-content')
  if (!body || body.querySelector(`[data-ann-id="${ann.id}"]`))
    return
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  let remaining = ann.text
  let startNode: Node | null = null
  let startOffset = 0
  let currentPos = 0
  while (walker.nextNode() && remaining) {
    const node = walker.currentNode as Text
    const nodeText = node.textContent || ''
    if (!startNode) {
      const idx = nodeText.indexOf(remaining[0])
      if (idx === -1)
        continue
      startNode = node; startOffset = idx; currentPos = idx
    }
    while (currentPos < nodeText.length && remaining) {
      if (nodeText[currentPos] === remaining[0]) { remaining = remaining.slice(1); currentPos++ }
      else { remaining = ann.text; startNode = null; break }
    }
    if (!remaining && startNode) {
      const range = document.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(node, currentPos)
      const span = document.createElement('span')
      span.className = 'ann-highlight'
      span.dataset.annId = ann.id
      span.addEventListener('click', () => { activeAnnId.value = ann.id; annPanelOpen.value = true })
      try { range.surroundContents(span) }
      catch { /* skip cross-element */ }
      return
    }
    if (!startNode)
      currentPos = 0
  }
}

function highlightAllAnnotations() {
  nextTick(() => annotations.value.forEach(a => highlightAnn(a)))
}

loadAnnotations()
watch(() => props.article.id, () => { loadAnnotations(); activeAnnId.value = null })
watch(() => fullTextContent.value, () => highlightAllAnnotations())
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- 顶部固定栏（标题 + 操作按钮同栏） -->
    <div class="flex items-center gap-3 px-6 py-2.5 border-b border-neutral-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950">
      <h1 class="flex-1 min-w-0 truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {{ article.title }}
      </h1>

      <div class="flex items-center gap-1.5 shrink-0" style="flex: none;">
        <!-- 摘要 -->
        <button class="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" :disabled="aiLoading" @click="handleSummarize">
          <Sparkles class="h-3.5 w-3.5" />
          {{ t('reading.summary') }}
        </button>

        <!-- 翻译（整体带边框） -->
        <div class="flex items-center rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <button class="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" :class="translationActive ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' : ''" :disabled="translating" @click="handleTranslate">
            <Languages class="h-3.5 w-3.5" />
            {{ translationActive ? t('reading.cancelTranslate') : t('reading.translate') }}
          </button>
          <select v-model="translateTarget" class="h-full border-0 border-l border-neutral-200 dark:border-neutral-700 bg-transparent pr-1 pl-0.5 text-[10px] text-neutral-500 outline-none cursor-pointer" :disabled="translating">
            <option value="en">
              EN
            </option>
            <option value="zh">
              中文
            </option>
            <option value="ja">
              日本語
            </option>
          </select>
        </div>

        <!-- 原文 -->
        <a v-if="article.link" :href="article.link" target="_blank" class="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ExternalLink class="h-3.5 w-3.5" />
          {{ t('reading.openOriginal') }}
        </a>

        <button class="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[11px] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" :class="article.starred ? 'text-amber-600 border-amber-300 dark:border-amber-700' : 'text-neutral-500'" @click="readingStore.toggleStar(article.id)">
          <Star class="h-3.5 w-3.5" :class="article.starred ? 'fill-amber-500' : ''" />
          {{ article.starred ? t('reading.unstar') : t('reading.star') }}
        </button>
      </div>
    </div>

    <!-- 内容区 + 批注面板 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 可滚动文章内容 -->
      <div ref="contentRef" class="flex-1 overflow-y-auto relative" @mouseup="handleAnnMouseUp">
        <div class="mx-auto max-w-3xl px-8 pb-32">
          <!-- 完整标题 -->
          <h1 class="pt-8 pb-3 text-[1.7rem] font-bold leading-snug text-neutral-900 dark:text-neutral-100 select-text">
            {{ article.title }}
          </h1>
          <!-- 元信息 -->
          <div class="pb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <div class="flex items-center gap-1.5">
              <span class="size-4 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">{{ article.sourceTitle.charAt(0) }}</span>
              <span>{{ article.sourceTitle }}</span>
            </div>
            <span v-if="article.author">{{ article.author }}</span>
            <span>{{ formatDate(article.publishedAt) }}</span>
          </div>

          <!-- 播客音频播放器 -->
          <div
            v-if="(article.media || []).some(m => m.type === 'audio') || article.attachments?.some(a => a.mimeType?.startsWith('audio/') || /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?|$)/i.test(a.url))"
            class="mb-6 mx-auto max-w-md rounded-xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-b from-orange-50/80 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 p-5"
          >
            <PodcastInlinePlayer :article="article" />
          </div>

          <!-- 正文 -->
          <div class="mt-4">
            <div v-if="translationActive">
              <div v-for="(block, i) in bilingualBlocks" :key="i">
                <div v-html="sanitize(block.html)" />
                <div v-if="translatedParagraphs[i] !== undefined" class="my-2 rounded bg-orange-50 dark:bg-orange-950/30 px-4 py-2 text-sm text-orange-800 dark:text-orange-200 italic border-l-2 border-orange-300">
                  {{ translatedParagraphs[i] || '...' }}
                </div>
              </div>
            </div>
            <div v-else-if="fullTextError" class="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
              <BookOpen class="h-8 w-8 opacity-30" />
              <p class="text-xs">
                {{ fullTextError }}
              </p>
              <a :href="article.link" target="_blank" class="text-xs text-primary hover:underline">
                {{ t('reading.openInBrowser') }}
              </a>
            </div>
            <div v-else class="article-body-content article-content prose prose-neutral dark:prose-invert max-w-none">
              <div v-html="sanitize(fullTextContent || article.content || article.summary)" />
            </div>
          </div>
        </div>
      </div>

      <!-- 选中弹窗 -->
      <div
        v-if="annPopup"
        class="fixed z-50"
        :style="{ left: `${annPopup.x}px`, top: `${annPopup.y}px` }"
      >
        <button
          class="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1.5 text-xs text-white shadow-lg hover:bg-red-600 transition-colors"
          @click.stop="createAnnotation"
        >
          <Sparkles class="h-3.5 w-3.5" />
          {{ t('reading.addAnnotation') }}
        </button>
      </div>

      <!-- 右侧批注面板 -->
      <div
        v-if="annPanelOpen"
        class="w-64 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col overflow-hidden shrink-0"
      >
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
          <span class="text-xs font-medium text-neutral-600 dark:text-neutral-400">{{ t('reading.annotations') }} ({{ annotations.length }})</span>
          <button class="text-neutral-400 hover:text-neutral-600" @click="annPanelOpen = false">
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto py-2">
          <!-- 空状态 -->
          <div v-if="!annotations.length" class="flex flex-col items-center justify-center h-32 text-neutral-400">
            <MessageSquarePlus class="h-6 w-6 mb-2 opacity-40" />
            <span class="text-[10px]">{{ t('reading.noAnnotations') }}</span>
            <span class="text-[9px] text-neutral-300 mt-1">{{ t('reading.selectToAnnotate') }}</span>
          </div>
          <div
            v-for="ann in annotations"
            :key="ann.id"
            class="group mx-2 mb-2 rounded-lg p-2 cursor-pointer transition-all"
            :class="activeAnnId === ann.id ? 'bg-white dark:bg-neutral-800 ring-1 ring-red-300 shadow-sm' : 'hover:bg-white dark:hover:bg-neutral-800'"
            @click="activeAnnId = ann.id"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-[11px] text-neutral-600 dark:text-neutral-400 flex-1 line-clamp-2">
                <span class="text-red-400 mr-1">●</span>
                {{ ann.comment || ann.text.slice(0, 50) }}
              </p>
              <button class="shrink-0 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500" @click.stop="removeAnnotation(ann.id)">
                <X class="h-3 w-3" />
              </button>
            </div>
            <div v-if="activeAnnId === ann.id" class="mt-2">
              <textarea
                :value="ann.comment"
                :placeholder="t('reading.writingAnnotation')"
                class="w-full min-h-[50px] text-xs resize-none rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300"
                @input="updateAnnComment(ann.id, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 批注数量角标（面板关闭时显示） -->
      <button
        v-if="!annPanelOpen && annotations.length"
        class="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white shadow-md hover:bg-red-600 transition-colors"
        @click="annPanelOpen = true"
      >
        <MessageSquarePlus class="h-3 w-3" />
        {{ annotations.length }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.article-content :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  color: hsl(var(--foreground));
}
.article-content :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 2.25rem;
  margin-bottom: 0.75rem;
  color: hsl(var(--foreground));
}
.article-content :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: hsl(var(--foreground));
}
.article-content :deep(p) {
  font-size: 1rem;
  line-height: 2;
  margin-bottom: 1.25rem;
  color: hsl(var(--foreground) / 0.87);
}
.article-content :deep(li) {
  font-size: 0.94rem;
  line-height: 2;
  margin-bottom: 0.5rem;
  color: hsl(var(--foreground) / 0.87);
}
.article-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: hsl(var(--primary) / 0.3);
  transition: text-decoration-color 0.15s;
}
.article-content :deep(a:hover) {
  text-decoration-color: hsl(var(--primary));
}
.article-content :deep(img) {
  display: block;
  max-width: 100%;
  border-radius: 0.75rem;
  margin: 1.5rem auto;
}
.article-content :deep(blockquote) {
  border-left: 3px solid hsl(var(--primary) / 0.3);
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: hsl(var(--foreground) / 0.7);
  font-style: italic;
}
.article-content :deep(code) {
  font-size: 0.85em;
  background: hsl(var(--muted));
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
}
.article-content :deep(pre) {
  background: hsl(var(--muted));
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1.5rem 0;
}
.article-content :deep(pre code) {
  background: none;
  padding: 0;
}
.article-content ::selection {
  background: hsl(var(--primary) / 0.15);
}

.article-body-content :deep(.ann-highlight) {
  background: rgba(239, 68, 68, 0.1);
  border-bottom: 2px dashed #ef4444;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 2px;
  padding: 0 1px;
}
.article-body-content :deep(.ann-highlight:hover) {
  background: rgba(239, 68, 68, 0.2);
}
</style>
