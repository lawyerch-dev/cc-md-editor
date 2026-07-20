// @workspace shared
import type { Component } from 'vue'
import { BarChart3, FileText, Home, Lightbulb, Newspaper, Rocket, ShieldCheck, Sparkles, Trophy, User, Users, Wallet } from '@lucide/vue'

export type WorkspaceView = 'landing' | 'reading' | 'ideaBoard' | 'profile' | 'editor' | 'coach' | 'report'

export interface WorkspaceCard {
  key: string
  icon: Component
  iconClass: string
  borderClass: string
  view?: Exclude<WorkspaceView, 'landing'>
  status: 'available' | 'dev'
}

export interface WorkspaceLayer {
  key: 'input' | 'output' | 'mobility'
  cards: WorkspaceCard[]
}

export const workspaceLayers: WorkspaceLayer[] = [
  {
    key: 'input',
    cards: [
      { key: 'reading', icon: Newspaper, iconClass: 'text-blue-500', borderClass: 'hover:border-blue-500', view: 'reading', status: 'available' },
      { key: 'ideaBoard', icon: Lightbulb, iconClass: 'text-amber-500', borderClass: 'hover:border-amber-500', view: 'ideaBoard', status: 'available' },
      { key: 'profile', icon: User, iconClass: 'text-emerald-500', borderClass: 'hover:border-emerald-500', view: 'profile', status: 'available' },
    ],
  },
  {
    key: 'output',
    cards: [
      { key: 'editor', icon: FileText, iconClass: 'text-primary', borderClass: 'hover:border-primary', view: 'editor', status: 'available' },
      { key: 'outputHub', icon: Rocket, iconClass: 'text-rose-500', borderClass: 'hover:border-rose-500', status: 'dev' },
      { key: 'reputation', icon: Trophy, iconClass: 'text-violet-500', borderClass: 'hover:border-violet-500', status: 'dev' },
      { key: 'coach', icon: Sparkles, iconClass: 'text-cyan-500', borderClass: 'hover:border-cyan-500', view: 'coach', status: 'available' },
    ],
  },
  {
    key: 'mobility',
    cards: [
      { key: 'report', icon: BarChart3, iconClass: 'text-indigo-500', borderClass: 'hover:border-indigo-500', view: 'report', status: 'available' },
      { key: 'trustAccount', icon: ShieldCheck, iconClass: 'text-teal-500', borderClass: 'hover:border-teal-500', status: 'dev' },
      { key: 'network', icon: Users, iconClass: 'text-orange-500', borderClass: 'hover:border-orange-500', status: 'dev' },
      { key: 'monetize', icon: Wallet, iconClass: 'text-lime-600', borderClass: 'hover:border-lime-500', status: 'dev' },
    ],
  },
]

export const availableWorkspaceCards = workspaceLayers.flatMap(layer => layer.cards).filter((card): card is WorkspaceCard & { view: Exclude<WorkspaceView, 'landing'> } => card.status === 'available' && !!card.view)

export interface ViewNavItem {
  id: WorkspaceView
  labelKey: string
  icon: Component
  color: string
}

export const viewNavItems: ViewNavItem[] = [
  { id: 'landing', labelKey: 'landing.home', icon: Home, color: '' },
  ...availableWorkspaceCards.map(card => ({
    id: card.view,
    labelKey: `landing.workspaces.${card.key}.name`,
    icon: card.icon,
    color: card.iconClass,
  })),
]
