<script setup lang="ts">
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload, X } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useReadingStore } from '@/stores/reading'
import { applyImport, importFoloClientSide, importFromOpml } from '@/stores/reading/folo-import'

const emit = defineEmits<{
  close: []
  imported: []
}>()

const { t } = useI18n()
const store = useReadingStore()

// ── 状态 ──────────────────────────────────────────────

const opmlContent = ref('')
const dbFile = ref<File | null>(null)
const importing = ref(false)
const importError = ref('')
const importResult = ref<{
  sources: number
  articles: number
  sourceTitles: string[]
} | null>(null)

const opmlFileInput = ref<HTMLInputElement | null>(null)
const dbFileInput = ref<HTMLInputElement | null>(null)

// ── 文件选择 ──────────────────────────────────────────

function onOpmlFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  importError.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    opmlContent.value = reader.result as string
  }
  reader.readAsText(file)
}

function onDbFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  dbFile.value = file
  importError.value = ''
}

// ── 导入 ──────────────────────────────────────────────

async function handleImport() {
  importError.value = ''
  importResult.value = null

  if (!opmlContent.value) {
    importError.value = t('reading.importSelectFile')
    return
  }

  importing.value = true
  try {
    let sources: any[]
    let articles: any[]

    if (dbFile.value) {
      // 有 follow.db → 客户端直接解析 SQLite
      const result = await importFoloClientSide(opmlContent.value, dbFile.value)
      sources = result.sources
      articles = result.articles
      if (sources.length === 0) {
        importError.value = t('reading.importNoSources')
        return
      }
      importResult.value = {
        sources: sources.length,
        articles: articles.length,
        sourceTitles: sources.map(s => s.title),
      }
    }
    else {
      // 仅有 OPML → 纯浏览器端解析
      const opmlResult = importFromOpml(opmlContent.value)
      if (opmlResult.sources.length === 0) {
        importError.value = t('reading.importNoSources')
        return
      }
      sources = opmlResult.sources
      articles = []
      importResult.value = {
        sources: sources.length,
        articles: 0,
        sourceTitles: sources.map(s => s.title),
      }
    }

    await applyImport(sources, articles)
    await store.reloadFromStorage()
  }
  catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      importError.value = t('reading.importTimeout')
    }
    else {
      importError.value = e instanceof Error ? e.message : t('reading.importFailed')
    }
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
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">
          {{ t('reading.importTitle') }}
        </h2>
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleClose">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- 导入说明 -->
      <div v-if="!importResult" class="flex flex-col gap-3 p-4">
        <p class="text-xs text-muted-foreground">
          {{ t('reading.importDesc') }}
        </p>

        <!-- OPML 文件（必选） -->
        <div class="rounded-lg border border-dashed p-3 text-center">
          <input
            ref="opmlFileInput"
            type="file"
            accept=".opml,.xml"
            class="hidden"
            @change="onOpmlFileSelected"
          >
          <button class="flex w-full flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" @click="opmlFileInput?.click()">
            <FileUp class="h-5 w-5" />
            <span>{{ opmlContent ? `${t('reading.importFileSelected')}: OPML` : t('reading.importSelectOpml') }}</span>
          </button>
        </div>

        <!-- follow.db（可选，导入后包括文章） -->
        <div class="rounded-lg border border-dashed p-3 text-center">
          <input
            ref="dbFileInput"
            type="file"
            accept=".db,.sqlite,.sqlite3"
            class="hidden"
            @change="onDbFileSelected"
          >
          <button class="flex w-full flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" @click="dbFileInput?.click()">
            <Upload class="h-5 w-5" />
            <span>{{ dbFile ? `${dbFile.name} ✓` : t('reading.importSelectDb') }}</span>
            <span v-if="!dbFile" class="text-[10px] text-muted-foreground/60">{{ t('reading.importDbOptional') }}</span>
          </button>
        </div>

        <!-- 错误提示 -->
        <p v-if="importError" class="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle class="h-3 w-3 shrink-0" />
          {{ importError }}
        </p>
      </div>

      <!-- 结果 -->
      <div v-else class="flex flex-col items-center gap-3 p-6 text-center">
        <CheckCircle2 class="h-10 w-10 text-green-500" />
        <div class="space-y-1">
          <p class="text-sm font-semibold">
            {{ t('reading.importComplete') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('reading.importStats', { sources: importResult.sources, articles: importResult.articles }) }}
          </p>
        </div>
        <div class="max-h-24 w-full overflow-y-auto text-left">
          <p v-for="title in importResult.sourceTitles" :key="title" class="truncate text-[11px] text-muted-foreground">
            · {{ title }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-4 py-3">
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="handleClose">
          {{ importResult ? t('common.confirm') : t('common.cancel') }}
        </Button>
        <Button
          v-if="!importResult"
          size="sm"
          class="h-7 gap-1 text-xs"
          :disabled="importing || !opmlContent"
          @click="handleImport"
        >
          <Loader2 v-if="importing" class="h-3.5 w-3.5 animate-spin" />
          <Upload v-else class="h-3.5 w-3.5" />
          {{ importing ? t('reading.importing') : t('reading.importConfirm') }}
        </Button>
      </div>
    </div>
  </div>
</template>
