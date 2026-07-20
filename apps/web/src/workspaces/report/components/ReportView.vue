<!-- @workspace report -->
<script setup lang="ts">
import type { ReportMetric } from '../types'
import { BarChart3, DollarSign, Plus, Target, Trash2, TrendingUp } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import ViewNav from '@/shared/components/navigation/ViewNav.vue'
import { useReportStore } from '../stores'

const store = useReportStore()

const showAddForm = ref(false)
const newMetric = ref({
  category: 'reputation' as ReportMetric['category'],
  name: '',
  value: 0,
  unit: '',
  note: '',
})

const categoryConfig = {
  reputation: { label: '名（影响力）', icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  revenue: { label: '利（变现力）', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950' },
  ability: { label: '能力（成长力）', icon: Target, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
}

function submitMetric() {
  if (!newMetric.value.name.trim())
    return
  store.addMetric({
    category: newMetric.value.category,
    name: newMetric.value.name.trim(),
    value: newMetric.value.value,
    unit: newMetric.value.unit.trim(),
    date: new Date().toISOString().slice(0, 10),
    note: newMetric.value.note.trim() || undefined,
  })
  newMetric.value = { category: 'reputation', name: '', value: 0, unit: '', note: '' }
  showAddForm.value = false
}

const latestMetrics = computed(() => {
  const grouped: Record<string, ReportMetric[]> = { reputation: [], revenue: [], ability: [] }
  for (const m of store.metrics) {
    grouped[m.category]?.push(m)
  }
  return Object.entries(grouped).map(([cat, items]) => ({
    category: cat as ReportMetric['category'],
    config: categoryConfig[cat as ReportMetric['category']],
    latest: items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  }))
})
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b px-4 py-2 shrink-0">
      <ViewNav />
      <div class="flex-1" />
      <Button variant="outline" size="sm" class="gap-1.5 text-xs" @click="showAddForm = !showAddForm">
        <Plus class="h-3.5 w-3.5" />
        录入数据
      </Button>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-5xl px-6 py-8">
        <!-- 标题 -->
        <div class="mb-8">
          <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground mb-3">
            <BarChart3 class="h-3 w-3" />
            战报
          </div>
          <h1 class="text-2xl font-bold tracking-tight">
            📊 数据战报
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            追踪你的名、利、能力指标，让数据驱动成长飞轮
          </p>
        </div>

        <!-- 录入表单 -->
        <div v-if="showAddForm" class="mb-8 rounded-xl border bg-card p-5 shadow-sm">
          <h3 class="mb-4 text-sm font-medium">
            录入新数据
          </h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label class="mb-1.5 block text-xs">指标类别</Label>
              <Select v-model="newMetric.category">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reputation">
                    名（影响力）
                  </SelectItem>
                  <SelectItem value="revenue">
                    利（变现力）
                  </SelectItem>
                  <SelectItem value="ability">
                    能力（成长力）
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">指标名称</Label>
              <Input v-model="newMetric.name" placeholder="如：公众号粉丝数" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">数值</Label>
              <Input v-model.number="newMetric.value" type="number" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">单位</Label>
              <Input v-model="newMetric.unit" placeholder="如：人、元、篇" />
            </div>
            <div class="sm:col-span-2">
              <Label class="mb-1.5 block text-xs">备注（可选）</Label>
              <Textarea v-model="newMetric.note" rows="2" placeholder="补充说明" />
            </div>
          </div>
          <div class="mt-4 flex gap-2">
            <Button size="sm" @click="submitMetric">
              保存
            </Button>
            <Button size="sm" variant="ghost" @click="showAddForm = false">
              取消
            </Button>
          </div>
        </div>

        <!-- 三栏指标面板 -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div
            v-for="group in latestMetrics"
            :key="group.category"
            class="rounded-xl border bg-card shadow-sm overflow-hidden"
          >
            <div class="flex items-center gap-2 border-b px-4 py-3" :class="group.config.bg">
              <component :is="group.config.icon" class="h-4 w-4" :class="group.config.color" />
              <span class="text-sm font-medium" :class="group.config.color">{{ group.config.label }}</span>
            </div>
            <div class="p-4">
              <div v-if="group.latest.length === 0" class="py-6 text-center text-xs text-muted-foreground">
                暂无数据，点击「录入数据」添加
              </div>
              <div v-else class="space-y-2.5">
                <div
                  v-for="metric in group.latest"
                  :key="metric.id"
                  class="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">
                      {{ metric.name }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ metric.date }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold tabular-nums" :class="group.config.color">
                      {{ metric.value }}{{ metric.unit }}
                    </span>
                    <button
                      class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                      @click="store.deleteMetric(metric.id)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
