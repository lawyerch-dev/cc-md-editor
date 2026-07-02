<script setup lang="ts">
import type { Article } from '@/stores/reading'
import { BookOpen, ExternalLink, Languages, Sparkles, Star } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildAIHeaders, resolveEndpointUrl } from '@/composables/useAIFetch'
import { useAIConfigStore } from '@/stores/aiConfig'
import { useReadingStore } from '@/stores/reading'
import ArticleAnnotator from './ArticleAnnotator.vue'

const props = defineProps<{
  article: Article
}>()

const readingStore = useReadingStore()
const aiConfig = useAIConfigStore()
const { t } = useI18n()

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
const translating = ref(false)
const translatedParagraphs = ref<Record<number, string>>({})
const translationActive = ref(false)

// 切换文章时，如果内容为空，自动提取全文
watch(() => props.article.id, async (id, oldId) => {
  if (id === oldId)
    return
  fullTextContent.value = ''
  const content = props.article.content || props.article.summary || ''
  const textLen = content.replace(/<[^>]*>/g, '').trim().length
  if (textLen < 200 && props.article.link) {
    fullTextLoading.value = true
    try { fullTextContent.value = await readingStore.fetchFullText(props.article.link) }
    catch (e) { console.warn('自动全文提取失败:', e) }
    finally { fullTextLoading.value = false }
  }
}, { immediate: true })

async function callAIStream(
  systemPrompt: string,
  userContent: string,
  onDelta: (text: string) => void,
): Promise<string> {
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
  const res = await window.fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
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
  catch (e) { aiError.value = e instanceof Error ? e.message : t('reading.summaryFailed') }
  finally { aiLoading.value = false }
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
  catch (e) { console.warn('翻译失败:', e) }
  finally { translating.value = false }
}

async function handleFetchFullText() {
  if (!props.article.link || fullTextLoading.value)
    return
  fullTextLoading.value = true
  try { fullTextContent.value = await readingStore.fetchFullText(props.article.link) }
  catch (e) { console.warn('全文提取失败:', e) }
  finally { fullTextLoading.value = false }
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- 文章内容区 -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl px-8 pt-12 pb-32">
        <!-- 标题 -->
        <h1 class="select-text break-words text-[1.7rem] font-bold leading-normal text-foreground">
          {{ article.title }}
        </h1>

        <!-- 元信息 -->
        <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div class="flex items-center gap-2">
            <div class="size-5 rounded bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
              {{ article.sourceTitle.charAt(0) }}
            </div>
            <span class="text-xs font-medium text-muted-foreground">{{ article.sourceTitle }}</span>
          </div>
          <div v-if="article.author" class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <i class="i-mgc-user-3-cute-re text-sm" />
            <span>{{ article.author }}</span>
          </div>
          <span class="text-xs text-muted-foreground">{{ formatDate(article.publishedAt) }}</span>
          <Star
            v-if="article.starred"
            class="size-4 text-amber-500 fill-amber-500"
          />
        </div>

        <!-- 操作栏 -->
        <div class="mt-6 flex items-center gap-1 border-b pb-4">
          <button
            class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :disabled="aiLoading"
            @click="handleSummarize"
          >
            <Sparkles class="h-3.5 w-3.5" />
            {{ t('reading.summary') }}
          </button>

          <div class="flex items-center">
            <button
              class="flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :class="translationActive ? 'bg-primary/10 text-primary' : ''"
              :disabled="translating"
              @click="handleTranslate"
            >
              <Languages class="h-3.5 w-3.5" />
              {{ translating ? t('reading.translating') : translationActive ? t('reading.cancelTranslate') : t('reading.translate') }}
            </button>
            <select
              v-model="translateTarget"
              class="h-[30px] rounded-r-md border-l border bg-transparent px-1.5 text-[10px] text-muted-foreground"
              :disabled="translating"
            >
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

          <button
            class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :disabled="fullTextLoading || !article.link"
            @click="handleFetchFullText"
          >
            <BookOpen class="h-3.5 w-3.5" />
            {{ fullTextLoading ? t('reading.extracting') : t('reading.fullText') }}
          </button>

          <div class="flex-1" />

          <button
            class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="readingStore.toggleStar(article.id)"
          >
            <Star
              class="h-4 w-4"
              :class="article.starred ? 'text-amber-500 fill-amber-500' : ''"
            />
          </button>
          <a
            v-if="article.link"
            :href="article.link"
            target="_blank"
            class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink class="h-4 w-4" />
          </a>
        </div>

        <!-- 文章正文 -->
        <div v-if="translationActive" class="mt-8">
          <div
            v-for="(block, i) in bilingualBlocks"
            :key="i"
          >
            <div v-html="block.html" />
            <div
              v-if="translatedParagraphs[i] !== undefined"
              class="my-1 rounded bg-primary/5 px-3 py-1.5 text-xs text-primary/80 italic border-l-2 border-primary/20"
            >
              {{ translatedParagraphs[i] || '...' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批注/AI 摘要模式 -->
    <ArticleAnnotator
      v-if="!translationActive"
      class="flex-1"
      :article="article"
      :content="fullTextContent || article.content || article.summary"
      :ai-result="aiResult"
      :ai-loading="aiLoading"
      :ai-error="aiError"
      :ai-panel-tab="aiPanelTab"
      @close-ai="aiPanelTab = null"
    />
  </div>
</template>

<style scoped>
.article-content :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: hsl(var(--foreground));
}
.article-content :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
  color: hsl(var(--foreground));
}
.article-content :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: hsl(var(--foreground));
}
.article-content :deep(p) {
  font-size: 0.94rem;
  line-height: 1.85;
  margin-bottom: 1rem;
  color: hsl(var(--foreground) / 0.87);
}
.article-content :deep(li) {
  font-size: 0.94rem;
  line-height: 1.75;
  margin-bottom: 0.35rem;
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
  max-width: 100%;
  border-radius: 0.75rem;
  margin: 1.5rem 0;
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
</style>
