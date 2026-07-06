import type { ProviderTemplate } from '../types/ai-provider-types'

export const providerTemplates: ProviderTemplate[] = [
  {
    id: 'xiaomi-token-plan',
    name: 'Xiaomi Token Plan',
    endpoint: 'https://token-plan-cn.xiaomimimo.com/v1',
    defaultModels: [
      'mimo-v2.5-pro',
      'mimo-v2.5',
      'mimo-v2.5-asr',
      'mimo-v2.5-tts-voiceclone',
      'mimo-v2.5-tts-voicedesign',
      'mimo-v2.5-tts',
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1',
    defaultModels: [
      'deepseek-ai/DeepSeek-V4-Flash',
      'Qwen/Qwen3-VL-32B-Instruct',
      'Qwen/Qwen-Image',
    ],
    supportsImage: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3', 'dall-e-3'],
    supportsImage: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    supportsImage: true,
  },
  {
    id: 'qwen',
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    defaultModels: [],
  },
  {
    id: '302ai',
    name: '302.AI',
    endpoint: 'https://api.302.ai/v1',
    defaultModels: [],
    supportsImage: true,
  },
  {
    id: 'custom',
    name: '自定义',
    endpoint: '',
    defaultModels: [],
    supportsImage: true,
  },
]

export function getProviderTemplate(id: string): ProviderTemplate | undefined {
  return providerTemplates.find(t => t.id === id)
}
