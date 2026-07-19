<!-- @workspace reading -->
<script setup lang="ts">
import type { CollectorSelectors } from '@/stores/reading'
import { AlertCircle, CheckCircle2, FileUp, X } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useReadingStore } from '@/stores/reading'

interface CSSSourceEntry {
  url: string
  title?: string
  selectors: CollectorSelectors
}

const emit = defineEmits<{
  close: []
  imported: []
}>()

const { t } = useI18n()
const store = useReadingStore()

const jsonContent = ref('')
const importing = ref(false)
const importError = ref('')
const importResult = ref<{ count: number, titles: string[] } | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  importError.value = ''
  const reader = new FileReader()
  reader.onload = () => { jsonContent.value = reader.result as string }
  reader.readAsText(file)
}

async function handleImport() {
  importError.value = ''
  importResult.value = null

  if (!jsonContent.value) {
    importError.value = t('reading.importSelectFile')
    return
  }

  importing.value = true
  try {
    const entries: CSSSourceEntry[] = JSON.parse(jsonContent.value)
    if (!Array.isArray(entries) || entries.length === 0) {
      importError.value = t('reading.importInvalidFormat')
      return
    }

    let imported = 0
    const titles: string[] = []

    for (const entry of entries) {
      if (!entry.url || !entry.selectors?.item || !entry.selectors?.title) {
        console.warn('[CSSImport] 跳过无效条目:', entry)
        continue
      }
      store.addSource({
        url: entry.url,
        title: entry.title || entry.url,
        strategy: 'css-selector',
        view: 0,
        refreshInterval: 30,
        selectors: entry.selectors,
        rsshubPath: undefined,
      })
      titles.push(entry.title || entry.url)
      imported++
    }

    importResult.value = { count: imported, titles }
  }
  catch (e) {
    importError.value = e instanceof SyntaxError
      ? t('reading.importParseError')
      : e instanceof Error ? e.message : t('reading.importFailed')
  }
  finally {
    importing.value = false
  }
}

function handleClose() {
  if (importResult.value)
    emit('imported')
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="handleClose">
    <div class="flex h-auto w-[560px] max-w-[95vw] flex-col rounded-xl border bg-background shadow-2xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">
          {{ t('reading.importCSSTitle') }}
        </h2>
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleClose">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div v-if="!importResult" class="flex flex-col gap-3 p-4">
        <p class="text-xs text-muted-foreground">
          {{ t('reading.importCSSDesc') }}
        </p>

        <div class="rounded-lg border border-dashed p-3 text-center">
          <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFileSelected">
          <button class="flex w-full flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" @click="fileInput?.click()">
            <FileUp class="h-5 w-5" />
            <span>{{ jsonContent ? `${t('reading.importFileSelected')}: JSON` : t('reading.importSelectJSON') }}</span>
          </button>
        </div>

        <div class="rounded-lg bg-muted/50 p-3">
          <p class="text-[10px] font-medium text-muted-foreground mb-1">
            {{ t('reading.importCSSFormat') }}
          </p>
          <pre class="text-[10px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">[
  {
    "url": "https://example.com/blog",
    "title": "示例博客",
    "selectors": {
      "item": "article",
      "title": "h2 a",
      "link": "a[href]"
    }
  }
]</pre>
        </div>

        <p v-if="importError" class="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle class="h-3 w-3 shrink-0" />
          {{ importError }}
        </p>
      </div>

      <div v-else class="flex flex-col items-center gap-3 p-6 text-center">
        <CheckCircle2 class="h-10 w-10 text-green-500" />
        <div class="space-y-1">
          <p class="text-sm font-medium">
            {{ t('reading.importComplete') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.importStats', { sources: importResult.count, articles: 0 }) }}
          </p>
        </div>
        <div class="max-h-24 w-full overflow-y-auto text-left">
          <p v-for="title in importResult.titles" :key="title" class="text-xs text-muted-foreground truncate">
            {{ title }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between border-t px-4 py-3">
        <span class="text-xs text-muted-foreground" />
        <div class="flex gap-2">
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="handleClose">
            {{ importResult ? t('common.close') : t('common.cancel') }}
          </Button>
          <Button
            v-if="!importResult"
            size="sm"
            class="h-7 text-xs"
            :disabled="!jsonContent || importing"
            @click="handleImport"
          >
            <template v-if="importing">
              <svg class="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /></svg>
              {{ t('reading.importing') }}
            </template>
            <template v-else>
              {{ t('reading.import') }}
            </template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
