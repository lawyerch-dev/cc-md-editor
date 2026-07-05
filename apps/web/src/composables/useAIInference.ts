/**
 * AI 推断 composable
 * 基于行为数据用 AI 生成用户画像推断
 */

import { computed, ref } from 'vue'
import { useBehaviorAnalysis } from './useBehaviorAnalysis'

interface AIInference {
  timestamp: number
  personality: {
    depthPreference: string
    decisionStyle: string
    learningMode: string
  }
  expertise: {
    coreDomains: string[]
    weakAreas: string[]
    blindSpots: string[]
  }
  growth: {
    trend: string
    bottlenecks: string[]
    recommendations: string[]
  }
  benchmarks: string
}

const STORAGE_KEY = 'reading_ai_inference'

export function useAIInference() {
  const { analysis } = useBehaviorAnalysis(30)
  const inference = ref<AIInference | null>(null)
  const generating = ref(false)
  const error = ref('')

  // 从 localStorage 加载已有推断
  function loadInference() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw)
        inference.value = JSON.parse(raw)
    }
    catch { /* ignore */ }
  }

  loadInference()

  const hasData = computed(() => analysis.value.totalReads > 0)
  const lastUpdated = computed(() => {
    if (!inference.value?.timestamp)
      return null
    return new Date(inference.value.timestamp).toLocaleDateString()
  })

  async function generate() {
    if (!hasData.value) {
      error.value = '需要先阅读一些文章才能生成洞察'
      return
    }
    generating.value = true
    error.value = ''

    try {
      const data = analysis.value
      const prompt = `你是一个职业发展分析师。基于以下用户阅读行为数据，推断用户的特征。

行为数据：
- 总阅读量：${data.totalReads} 篇（近 30 天）
- 平均阅读时长：${data.avgReadDuration} 秒
- 批注率：${data.readToAnnotateRate}%
- 想法转化率：${data.annotateToIdeaRate}%
- 内容偏好：${JSON.stringify(data.contentPreference)}
- 高峰阅读时段：${data.peakHours.join('、')}

请用 JSON 格式返回：
{
  "personality": { "depthPreference": "深度/广度/混合", "decisionStyle": "描述", "learningMode": "描述" },
  "expertise": { "coreDomains": ["领域1"], "weakAreas": ["领域2"], "blindSpots": ["领域3"] },
  "growth": { "trend": "改善/稳定/退步", "bottlenecks": ["瓶颈1"], "recommendations": ["建议1", "建议2", "建议3"] },
  "benchmarks": "一段文字描述和同领域从业者的对比"
}`

      // 读取 AI 配置
      const aiConfigRaw = localStorage.getItem('ai-config')
      if (!aiConfigRaw) {
        error.value = '请先配置 AI 服务'
        return
      }
      const aiConfig = JSON.parse(aiConfigRaw)
      const endpoint = aiConfig.textEndpoint || aiConfig.endpoint
      const apiKey = aiConfig.textApiKey || aiConfig.apiKey

      if (!endpoint || !apiKey) {
        error.value = '请先配置 AI 服务的 API 地址和密钥'
        return
      }

      const res = await window.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: aiConfig.textModel || aiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        error.value = `AI 请求失败：${res.status}`
        return
      }

      const result = await res.json()
      const content = result.choices?.[0]?.message?.content || ''
      // 提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        error.value = 'AI 返回格式异常'
        return
      }

      const parsed = JSON.parse(jsonMatch[0])
      inference.value = {
        timestamp: Date.now(),
        ...parsed,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inference.value))
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : '生成失败'
    }
    finally {
      generating.value = false
    }
  }

  return { inference, generating, error, hasData, lastUpdated, generate }
}
