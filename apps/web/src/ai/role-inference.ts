import type { ModelRole } from '@md/shared/types'

/**
 * Excluded patterns — models matching these are NOT assigned any role.
 * ASR (speech recognition) and TTS (text-to-speech) models don't fit
 * into reasoning/fast/vision/image roles.
 */
const EXCLUDED_PATTERNS: RegExp[] = [
  /asr/i,
  /whisper/i,
  /stt/i, // speech-to-text
  /tts/i,
  /voiceclone/i,
  /voicedesign/i, // text-to-speech
]

/** Patterns for each role. Checked in order; first match wins. */
const ROLE_PATTERNS: Array<{ role: ModelRole, patterns: RegExp[] }> = [
  {
    role: 'image',
    patterns: [
      /image/i,
      /dall[-_]?e/i,
      /flux/i,
      /stable.?diffusion/i,
      /sd[-_]/i,
      /kolors/i,
      /wanx/i,
      /cogview/i,
      /midjourney/i,
      /mj[-_]/i,
      /recraft/i,
      /gpt.?image/i,
      /seedream/i,
      /kontext/i,
    ],
  },
  {
    role: 'vision',
    patterns: [
      /[-_]vl/i,
      /vision/i,
      /multimodal/i,
      /pixtral/i,
    ],
  },
  {
    role: 'reasoning',
    patterns: [
      /[-_]r1/i,
      /reasoning/i,
      /[-_]o[134]/i,
      /thinking/i,
      /qwq/i,
      /deepseek.?reasoner/i,
      /pro/i,
    ],
  },
  {
    role: 'fast',
    patterns: [
      /flash/i,
      /mini/i,
      /nano/i,
      /lite/i,
      /turbo/i,
      /instant/i,
      /small/i,
      /speed/i,
    ],
  },
]

/**
 * Check if a model should be excluded from role assignment.
 */
function isExcluded(modelId: string): boolean {
  return EXCLUDED_PATTERNS.some(p => p.test(modelId))
}

/**
 * Infer the role of a model from its name.
 * Returns the first matching role, 'fast' as default, or null if excluded.
 */
export function inferRole(modelId: string): ModelRole | null {
  if (isExcluded(modelId))
    return null
  for (const { role, patterns } of ROLE_PATTERNS) {
    if (patterns.some(p => p.test(modelId)))
      return role
  }
  return 'fast' // default fallback
}

/**
 * Infer all matching roles for a model (for UI display).
 * Returns empty array if excluded.
 */
export function inferAllRoles(modelId: string): ModelRole[] {
  if (isExcluded(modelId))
    return []
  const roles: ModelRole[] = []
  for (const { role, patterns } of ROLE_PATTERNS) {
    if (patterns.some(p => p.test(modelId)))
      roles.push(role)
  }
  return roles.length > 0 ? roles : ['fast']
}
