// @workspace coach
export default {
  coach: {
    title: 'Coach',
    diagnosis: {
      title: 'AI Self-Diagnosis',
      stepIndicator: '{current} / {total}',
      step1: {
        question: 'Who are you?',
        placeholder: 'Your profession, education, core skills... (e.g., 3 years as PM, CS degree, skilled in data analysis & user research)',
      },
      step2: {
        question: 'Where are you now?',
        placeholder: 'Your current income level, sphere of influence, social class...',
      },
      step3: {
        question: 'Where do you want to go?',
        placeholder: 'Your target class, desired income/influence, the timeline you\'ve set for yourself...',
      },
      step4: {
        question: 'What are your strengths?',
        placeholder: 'Your biggest competitive advantages, rare skills, unique resources... (comma-separated)',
      },
      step5: {
        question: 'What are your weaknesses?',
        placeholder: 'Key weaknesses holding you back, bottlenecks to break through... (comma-separated)',
      },
      prev: 'Previous',
      next: 'Next',
      submit: 'Generate Diagnosis',
      restart: 'Start Over',
      hint: 'Press ⌘+Enter for next step',
    },
    goal: {
      title: '3-Month Goal',
      newGoal: 'New Goal',
      goalName: 'Goal Name',
      goalNamePlaceholder: 'e.g., Build a personal tech brand',
      goalDesc: 'Description (optional)',
      goalDescPlaceholder: 'Describe the state you want to achieve...',
      deadline: 'Deadline',
      createAndBreak: 'Create & AI Breakdown',
      breaking: 'AI breaking down...',
      inputTasks: 'Input Tasks (Learn / Accumulate)',
      outputTasks: 'Output Tasks (Create / Deliver)',
      noTasks: 'No tasks yet — AI will generate them after breakdown',
      noGoal: 'No goal set yet. Create one to get started.',
    },
    chat: {
      welcome: 'Hi, I\'m your life coach',
      welcomeDesc: 'I\'ll help you assess your situation, find breakthroughs, and build actionable plans. Chat with me or complete the self-diagnosis first.',
      quickStart1: 'Analyze my career bottlenecks',
      quickStart2: 'How to level up in 3 months',
      quickStart3: 'Create an actionable growth plan',
      placeholder: 'Chat with your coach...',
      send: 'Send',
    },
    todayTasks: {
      title: 'Today\'s Tasks',
      pending: '{count} pending',
      empty: 'No tasks for today — they\'ll appear after setting a goal',
    },
  },
}
