// @workspace coach

export interface UserProfile {
  identity: string // 职业/背景
  currentLevel: string // 当前阶层
  targetLevel: string // 目标阶层
  strengths: string[] // 优势
  weaknesses: string[] // 短板
  timeWindow: string // 时间窗口
}

export interface Goal {
  id: string
  title: string
  description: string
  deadline: string
  tasks: Task[]
  createdAt: number
}

export interface Task {
  id: string
  title: string
  goalId: string
  type: 'input' | 'output' // 输入型还是输出型
  completed: boolean
  dueDate: string
}

export interface DiagnosisStep {
  key: string
  question: string
  placeholder: string
}
