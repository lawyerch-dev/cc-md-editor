// @workspace coach
import type { Goal, Task, UserProfile } from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const PROFILE_KEY = 'coach-profile'
const GOALS_KEY = 'coach-goals'

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useCoachStore = defineStore('coach', () => {
  // ── 用户画像 ──────────────────────────────────────────────
  const raw = localStorage.getItem(PROFILE_KEY)
  const profile = ref<UserProfile | null>(raw ? JSON.parse(raw) : null)

  function persistProfile() {
    if (profile.value) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
    }
    else {
      localStorage.removeItem(PROFILE_KEY)
    }
  }

  function saveProfile(p: UserProfile) {
    profile.value = { ...p }
    persistProfile()
  }

  function updateProfileFields(fields: Partial<UserProfile>) {
    if (!profile.value) {
      profile.value = {
        identity: '',
        currentLevel: '',
        targetLevel: '',
        strengths: [],
        weaknesses: [],
        timeWindow: '',
      }
    }
    Object.assign(profile.value, fields)
    persistProfile()
  }

  // ── 目标 ──────────────────────────────────────────────────
  const rawGoals = localStorage.getItem(GOALS_KEY)
  const goals = ref<Goal[]>(rawGoals ? JSON.parse(rawGoals) : [])

  function persistGoals() {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals.value))
  }

  const activeGoal = computed(() => goals.value[0] ?? null)

  const allTasks = computed(() =>
    goals.value.flatMap(g => g.tasks),
  )

  const todayTasks = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return allTasks.value.filter(t => t.dueDate === today)
  })

  const pendingTasks = computed(() =>
    todayTasks.value.filter(t => !t.completed),
  )

  const completedTasks = computed(() =>
    todayTasks.value.filter(t => t.completed),
  )

  function addGoal(title: string, description: string, deadline: string): Goal {
    const goal: Goal = {
      id: generateId(),
      title,
      description,
      deadline,
      tasks: [],
      createdAt: Date.now(),
    }
    goals.value.push(goal)
    persistGoals()
    return goal
  }

  function removeGoal(goalId: string) {
    goals.value = goals.value.filter(g => g.id !== goalId)
    persistGoals()
  }

  function addTask(goalId: string, title: string, type: Task['type'], dueDate: string): Task | null {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal)
      return null
    const task: Task = {
      id: generateId(),
      title,
      goalId,
      type,
      completed: false,
      dueDate,
    }
    goal.tasks.push(task)
    persistGoals()
    return task
  }

  function addTasksToGoal(goalId: string, tasks: Array<{ title: string, type: Task['type'], dueDate: string }>) {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal)
      return
    for (const t of tasks) {
      goal.tasks.push({
        id: generateId(),
        title: t.title,
        goalId,
        type: t.type,
        completed: false,
        dueDate: t.dueDate,
      })
    }
    persistGoals()
  }

  function toggleTask(goalId: string, taskId: string) {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal)
      return
    const task = goal.tasks.find(t => t.id === taskId)
    if (task) {
      task.completed = !task.completed
      persistGoals()
    }
  }

  function removeTask(goalId: string, taskId: string) {
    const goal = goals.value.find(g => g.id === goalId)
    if (!goal)
      return
    goal.tasks = goal.tasks.filter(t => t.id !== taskId)
    persistGoals()
  }

  return {
    // Profile
    profile,
    saveProfile,
    updateProfileFields,

    // Goals
    goals,
    activeGoal,
    allTasks,
    todayTasks,
    pendingTasks,
    completedTasks,
    addGoal,
    removeGoal,
    addTask,
    addTasksToGoal,
    toggleTask,
    removeTask,
  }
})
