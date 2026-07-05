<script setup lang="ts">
import { ArrowLeft, BarChart3, Brain, Globe, Loader2, Settings } from '@lucide/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useAIInference } from '@/composables/useAIInference'
import { useBehaviorAnalysis } from '@/composables/useBehaviorAnalysis'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const { t } = useI18n()

const STORAGE_KEY = 'reading_user_profile'

const activeTab = ref<'behavior' | 'insights' | 'config' | 'visibility'>('behavior')

const tabs = computed(() => [
  { key: 'behavior' as const, label: t('reading.tabBehavior'), icon: BarChart3 },
  { key: 'insights' as const, label: t('reading.tabInsights'), icon: Brain },
  { key: 'config' as const, label: t('reading.tabConfig'), icon: Settings },
  { key: 'visibility' as const, label: t('reading.tabVisibility'), icon: Globe },
])

// ── 行为数据 ──────────────────────────────────────

const { analysis } = useBehaviorAnalysis(30)
const { inference, generating, error: inferError, hasData, lastUpdated, generate: generateInference } = useAIInference()

// ── 用户配置 ──────────────────────────────────────

interface UserProfile {
  goals: { shortTerm: string, midTerm: string, longTerm: string, successCriteria: string }
  constraints: { weeklyHours: number, bottleneck: string, cannotDo: string }
  trustStrategy: { targetAudience: string, visibility: string, uniqueValue: string, differentiation: string }
  topics: Array<{ name: string, priority: 'high' | 'medium' | 'low' }>
  ikigai: { love: string[], goodAt: string[], worldNeeds: string[], paidFor: string[] }
  wheelOfLife: Record<string, number>
  values: string[]
  abilities: Array<{ name: string, current: number, target: number }>
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return {
        goals: d.goals || { shortTerm: '', midTerm: '', longTerm: '', successCriteria: '' },
        constraints: d.constraints || { weeklyHours: 10, bottleneck: '', cannotDo: '' },
        trustStrategy: d.trustStrategy || { targetAudience: '', visibility: '', uniqueValue: '', differentiation: '' },
        topics: d.topics || [],
        ikigai: d.ikigai || { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
        wheelOfLife: d.wheelOfLife || {},
        values: d.values || [],
        abilities: d.abilities || [],
      }
    }
  }
  catch { /* ignore */ }
  return {
    goals: { shortTerm: '', midTerm: '', longTerm: '', successCriteria: '' },
    constraints: { weeklyHours: 10, bottleneck: '', cannotDo: '' },
    trustStrategy: { targetAudience: '', visibility: '', uniqueValue: '', differentiation: '' },
    topics: [],
    ikigai: { love: [], goodAt: [], worldNeeds: [], paidFor: [] },
    wheelOfLife: {},
    values: [],
    abilities: [],
  }
}

const profile = ref<UserProfile>(loadProfile())
const saved = ref(false)

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.value))
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}

function addTopic() {
  profile.value.topics.push({ name: '', priority: 'medium' })
}

function removeTopic(i: number) {
  profile.value.topics.splice(i, 1)
}

// ── 外部可见性 ────────────────────────────────────

interface VisibilityAudit {
  baidu: string
  wechat: string
  zhihu: string
  aiChatgpt: string
  aiKimi: string
  courtRecords: number
  papers: number
  notes: string
}

function loadVisibility(): VisibilityAudit {
  try {
    const raw = localStorage.getItem('reading_visibility_audit')
    if (raw)
      return JSON.parse(raw)
  }
  catch { /* ignore */ }
  return { baidu: '', wechat: '', zhihu: '', aiChatgpt: '', aiKimi: '', courtRecords: 0, papers: 0, notes: '' }
}

const visibility = ref<VisibilityAudit>(loadVisibility())

function saveVisibility() {
  localStorage.setItem('reading_visibility_audit', JSON.stringify(visibility.value))
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}

// ── 工具函数 ──────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60)
    return `${seconds}秒`
  return `${Math.round(seconds / 60)}分钟`
}

function trendIcon(change: number): string {
  if (change > 0)
    return '↑'
  if (change < 0)
    return '↓'
  return '→'
}

function trendColor(change: number): string {
  if (change > 0)
    return 'text-green-600'
  if (change < 0)
    return 'text-red-500'
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <!-- 顶部导航 -->
    <div class="flex items-center gap-3 border-b px-6 py-3">
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="uiStore.setCurrentView('landing')">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-lg font-semibold">
        {{ t('reading.userProfileTitle') }}
      </h1>
      <span v-if="saved" class="text-xs text-green-600 ml-2">✓ 已保存</span>
    </div>

    <!-- Tab 导航 -->
    <div class="border-b px-6 py-2 flex justify-center">
      <div class="flex items-center gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all"
          :class="activeTab === tab.key
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted'"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-4xl px-8 py-6">
        <!-- Tab 1: 行为分析 -->
        <div v-if="activeTab === 'behavior'" class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <!-- 阅读统计 -->
            <div class="rounded-xl border p-5 space-y-3">
              <h3 class="text-sm font-semibold">
                📖 阅读统计（近 30 天）
              </h3>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.totalReads }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    总阅读量
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ formatDuration(analysis.avgReadDuration) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    平均阅读时长
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.readCompletionRate }}%
                  </div>
                  <div class="text-xs text-muted-foreground">
                    完成率
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.annotationCount }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    批注数
                  </div>
                </div>
              </div>
              <div v-if="analysis.peakHours.length" class="text-xs text-muted-foreground">
                高峰时段：{{ analysis.peakHours.join('、') }}
              </div>
            </div>

            <!-- 产出统计 -->
            <div class="rounded-xl border p-5 space-y-3">
              <h3 class="text-sm font-semibold">
                ✍️ 产出统计
              </h3>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.extractIdeaCount }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    提炼想法
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.favoriteCount }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    收藏文章
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.readToAnnotateRate }}%
                  </div>
                  <div class="text-xs text-muted-foreground">
                    批注率
                  </div>
                </div>
                <div>
                  <div class="text-2xl font-bold">
                    {{ analysis.annotateToIdeaRate }}%
                  </div>
                  <div class="text-xs text-muted-foreground">
                    想法转化率
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 趋势 -->
          <div class="rounded-xl border p-5 space-y-3">
            <h3 class="text-sm font-semibold">
              📈 本周趋势
            </h3>
            <div class="flex gap-8 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">阅读</span>
                <span class="font-mono">{{ analysis.trend.reads.current }}</span>
                <span :class="trendColor(analysis.trend.reads.change)" class="text-xs">
                  {{ trendIcon(analysis.trend.reads.change) }} {{ Math.abs(analysis.trend.reads.change) }}%
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">批注</span>
                <span class="font-mono">{{ analysis.trend.annotations.current }}</span>
                <span :class="trendColor(analysis.trend.annotations.change)" class="text-xs">
                  {{ trendIcon(analysis.trend.annotations.change) }} {{ Math.abs(analysis.trend.annotations.change) }}%
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">想法</span>
                <span class="font-mono">{{ analysis.trend.ideas.current }}</span>
                <span :class="trendColor(analysis.trend.ideas.change)" class="text-xs">
                  {{ trendIcon(analysis.trend.ideas.change) }} {{ Math.abs(analysis.trend.ideas.change) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- 内容偏好 -->
          <div v-if="Object.keys(analysis.contentPreference).length" class="rounded-xl border p-5 space-y-3">
            <h3 class="text-sm font-semibold">
              📊 内容偏好
            </h3>
            <div class="flex gap-4">
              <div v-for="(pct, type) in analysis.contentPreference" :key="type" class="flex items-center gap-2">
                <div class="h-2 rounded-full bg-primary/30" :style="{ width: `${pct * 2}px` }" />
                <span class="text-xs">{{ type }} {{ pct }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: AI 洞察 -->
        <div v-if="activeTab === 'insights'" class="space-y-6">
          <!-- 无数据提示 -->
          <div v-if="!hasData" class="rounded-xl border p-5 text-center text-muted-foreground">
            <Brain class="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p class="text-sm">
              需要先阅读一些文章才能生成洞察
            </p>
            <p class="text-xs mt-1">
              去资讯阅读模块阅读几篇文章，行为数据会自动积累
            </p>
          </div>

          <template v-else>
            <div class="flex items-center gap-3">
              <Button :disabled="generating" @click="generateInference">
                <Brain v-if="!generating" class="h-4 w-4 mr-1.5" />
                <Loader2 v-else class="h-4 w-4 mr-1.5 animate-spin" />
                {{ generating ? '分析中...' : '生成 AI 洞察' }}
              </Button>
              <span v-if="lastUpdated" class="text-xs text-muted-foreground">上次更新：{{ lastUpdated }}</span>
              <span v-if="inferError" class="text-xs text-destructive">{{ inferError }}</span>
            </div>

            <template v-if="inference">
              <div class="rounded-xl border p-5 space-y-3">
                <h3 class="text-sm font-semibold">
                  🧠 性格推断
                </h3>
                <div class="space-y-2 text-sm">
                  <div class="flex items-start gap-2">
                    <span class="text-muted-foreground w-20 shrink-0">深度偏好</span>
                    <span>{{ inference.personality.depthPreference }}</span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-muted-foreground w-20 shrink-0">决策风格</span>
                    <span>{{ inference.personality.decisionStyle }}</span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-muted-foreground w-20 shrink-0">学习模式</span>
                    <span>{{ inference.personality.learningMode }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-xl border p-5 space-y-3">
                <h3 class="text-sm font-semibold">
                  📊 专业画像
                </h3>
                <div class="space-y-2 text-sm">
                  <div>
                    <span class="text-muted-foreground">核心领域：</span>
                    <span v-for="(d, i) in inference.expertise.coreDomains" :key="i" class="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs mr-1">{{ d }}</span>
                  </div>
                  <div v-if="inference.expertise.weakAreas.length">
                    <span class="text-muted-foreground">待提升：</span>
                    <span v-for="(d, i) in inference.expertise.weakAreas" :key="i" class="inline-block rounded-full bg-orange-500/10 text-orange-600 px-2 py-0.5 text-xs mr-1">{{ d }}</span>
                  </div>
                  <div v-if="inference.expertise.blindSpots.length">
                    <span class="text-muted-foreground">知识盲区：</span>
                    <span v-for="(d, i) in inference.expertise.blindSpots" :key="i" class="inline-block rounded-full bg-red-500/10 text-red-500 px-2 py-0.5 text-xs mr-1">{{ d }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-xl border p-5 space-y-3">
                <h3 class="text-sm font-semibold">
                  📈 成长趋势
                </h3>
                <div class="space-y-2 text-sm">
                  <div>
                    <span class="text-muted-foreground">趋势：</span>
                    <span>{{ inference.growth.trend }}</span>
                  </div>
                  <div v-if="inference.growth.bottlenecks.length">
                    <span class="text-muted-foreground">瓶颈：</span>
                    <span v-for="(b, i) in inference.growth.bottlenecks" :key="i" class="text-destructive">{{ b }}{{ i < inference.growth.bottlenecks.length - 1 ? '、' : '' }}</span>
                  </div>
                  <div v-if="inference.growth.recommendations.length" class="mt-2 space-y-1">
                    <span class="text-muted-foreground font-medium">AI 建议：</span>
                    <div v-for="(r, i) in inference.growth.recommendations" :key="i" class="flex items-start gap-2 pl-2">
                      <span class="text-primary font-bold">{{ i + 1 }}.</span>
                      <span>{{ r }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="inference.benchmarks" class="rounded-xl border p-5 space-y-3">
                <h3 class="text-sm font-semibold">
                  🏁 标杆对比
                </h3>
                <p class="text-sm text-muted-foreground leading-relaxed">
                  {{ inference.benchmarks }}
                </p>
              </div>
            </template>
          </template>
        </div>

        <!-- Tab 3: 我的配置 -->
        <div v-if="activeTab === 'config'" class="space-y-6">
          <!-- 目标设定 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              🎯 目标设定
            </h3>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-muted-foreground">3 个月目标</label>
                <input v-model="profile.goals.shortTerm" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：完成 10 篇案例分析">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">1 年目标</label>
                <input v-model="profile.goals.midTerm" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：公众号粉丝达到 5000">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">3-5 年目标</label>
                <input v-model="profile.goals.longTerm" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：成为领域内被引用的专家">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">成功标准（怎么算达到？）</label>
                <input v-model="profile.goals.successCriteria" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：每月产出 4 篇，每篇至少 1 个真实案例">
              </div>
            </div>
          </div>

          <!-- 约束条件 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              ⚠️ 约束条件
            </h3>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-muted-foreground">每周可用于阅读写作的时间（小时）</label>
                <input v-model.number="profile.constraints.weeklyHours" type="number" class="w-32 mt-1 rounded border bg-background px-3 py-2 text-sm">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">当前最大瓶颈</label>
                <input v-model="profile.constraints.bottleneck" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：写作产出不够">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">不能做的事</label>
                <input v-model="profile.constraints.cannotDo" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：不能做免费咨询">
              </div>
            </div>
          </div>

          <!-- 信任战略 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              🤝 信任战略
            </h3>
            <p class="text-xs text-muted-foreground">
              信任 = 专业能力 × 持续输出 × 社交证明
            </p>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-muted-foreground">想被谁信任</label>
                <input v-model="profile.trustStrategy.targetAudience" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：科技公司法务、创业者">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">他们怎么知道我</label>
                <input v-model="profile.trustStrategy.visibility" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：公众号、知乎、行业会议">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">我的独特价值</label>
                <input v-model="profile.trustStrategy.uniqueValue" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：法律 + 技术双重背景">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">差异化定位</label>
                <input v-model="profile.trustStrategy.differentiation" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm" placeholder="例如：专注 AI 法律，不做泛法律">
              </div>
            </div>
          </div>

          <!-- 关注话题 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              🏷️ 关注话题
            </h3>
            <div class="space-y-2">
              <div v-for="(topic, i) in profile.topics" :key="i" class="flex items-center gap-2">
                <input v-model="topic.name" class="flex-1 rounded border bg-background px-3 py-1.5 text-sm" placeholder="话题名称">
                <select v-model="topic.priority" class="rounded border bg-background px-2 py-1.5 text-xs">
                  <option value="high">
                    高
                  </option>
                  <option value="medium">
                    中
                  </option>
                  <option value="low">
                    低
                  </option>
                </select>
                <button class="text-muted-foreground hover:text-destructive text-xs" @click="removeTopic(i)">
                  ×
                </button>
              </div>
            </div>
            <button class="text-xs text-muted-foreground hover:text-foreground" @click="addTopic">
              + 添加话题
            </button>
          </div>

          <!-- 保存 -->
          <div class="flex items-center gap-3">
            <Button @click="save">
              保存配置
            </Button>
            <span v-if="saved" class="text-sm text-green-600">✓ 已保存</span>
          </div>
        </div>

        <!-- Tab 4: 外部可见性 -->
        <div v-if="activeTab === 'visibility'" class="space-y-6">
          <!-- 搜索引擎 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              🔍 搜索引擎可见性
            </h3>
            <p class="text-xs text-muted-foreground">
              搜索你的名字，看看能找到什么
            </p>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-muted-foreground">百度搜索结果</label>
                <textarea v-model="visibility.baidu" rows="2" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="搜索结果描述，例如：找到 3 条，律所官网排第一" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground">微信搜索结果</label>
                <textarea v-model="visibility.wechat" rows="2" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="例如：公众号文章 2 篇" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground">知乎搜索结果</label>
                <textarea v-model="visibility.zhihu" rows="2" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="例如：回答 5 个，关注者 120" />
              </div>
            </div>
          </div>

          <!-- AI 平台 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              🤖 AI 平台可见性
            </h3>
            <p class="text-xs text-muted-foreground">
              问 AI 助手你的领域专家，看看会不会提到你
            </p>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-muted-foreground">ChatGPT / Claude</label>
                <textarea v-model="visibility.aiChatgpt" rows="2" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="例如：问'AI 法律专家推荐'未提及我" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground">Kimi / 通义</label>
                <textarea v-model="visibility.aiKimi" rows="2" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="例如：搜'数据隐私律师'找到 1 条相关" />
              </div>
            </div>
          </div>

          <!-- 行业平台 -->
          <div class="rounded-xl border p-5 space-y-4">
            <h3 class="text-sm font-semibold">
              📋 行业平台
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-xs text-muted-foreground">裁判文书网（案件数）</label>
                <input v-model.number="visibility.courtRecords" type="number" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm">
              </div>
              <div>
                <label class="text-xs text-muted-foreground">知网论文（篇数）</label>
                <input v-model.number="visibility.papers" type="number" class="w-full mt-1 rounded border bg-background px-3 py-2 text-sm">
              </div>
            </div>
            <div>
              <label class="text-xs text-muted-foreground">其他备注</label>
              <textarea v-model="visibility.notes" rows="3" class="w-full mt-1 rounded border bg-background px-3 py-2 text-xs resize-none" placeholder="其他可见性相关的信息" />
            </div>
          </div>

          <!-- 保存 -->
          <div class="flex items-center gap-3">
            <Button @click="saveVisibility">
              保存审计
            </Button>
            <span v-if="saved" class="text-sm text-green-600">✓ 已保存</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
