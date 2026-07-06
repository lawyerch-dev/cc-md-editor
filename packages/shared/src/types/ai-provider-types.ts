/** Model role — determines which model is used for which task type */
export type ModelRole = 'reasoning' | 'fast' | 'vision' | 'image'

/** All model roles as a constant array for iteration */
export const MODEL_ROLES: ModelRole[] = ['reasoning', 'fast', 'vision', 'image']

/** Provider — a configured AI service provider */
export interface Provider {
  id: string
  name: string
  templateId?: string
  endpoint: string
  apiKey: string
  models: string[] // auto-fetched model IDs
  manualModels: string[] // user-added model IDs
  fetchStatus: 'idle' | 'loading' | 'ok' | 'error'
  fetchError?: string
  isDefault?: boolean
}

/** Role assignment — which provider+model serves a role */
export interface RoleAssignment {
  providerId: string
  modelId: string
}

/** Map of role → assignment */
export type RoleMap = Record<ModelRole, RoleAssignment | null>

/** Trigger configuration with role binding */
export interface TriggerConfig {
  enabled: boolean
  role: ModelRole
  delayMs: number
}

/** Provider template for quick setup */
export interface ProviderTemplate {
  id: string
  name: string
  endpoint: string
  defaultModels: string[]
  supportsImage?: boolean
}
