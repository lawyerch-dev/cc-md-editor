// @workspace coach
export default {
  coach: {
    title: '知己',
    diagnosis: {
      title: 'AI 自我诊断',
      stepIndicator: '{current} / {total}',
      step1: {
        question: '你是谁？',
        placeholder: '你的职业、教育背景、核心技能...（例：3年产品经理，计算机本科，擅长数据分析和用户研究）',
      },
      step2: {
        question: '你在哪？',
        placeholder: '你当前的收入水平、影响力范围、所处的社会阶层...',
      },
      step3: {
        question: '你要去哪？',
        placeholder: '你的目标阶层、期望达到的收入/影响力、你给自己设定的时间窗口...',
      },
      step4: {
        question: '你的优势是什么？',
        placeholder: '你最大的竞争优势、稀缺技能、独特资源...（用逗号分隔）',
      },
      step5: {
        question: '你的短板是什么？',
        placeholder: '制约你发展的关键短板、需要突破的瓶颈...（用逗号分隔）',
      },
      prev: '上一步',
      next: '下一步',
      submit: '生成诊断报告',
      restart: '重新诊断',
      hint: '按 ⌘+Enter 快速下一步',
    },
    goal: {
      title: '3 个月目标',
      newGoal: '新建目标',
      goalName: '目标名称',
      goalNamePlaceholder: '例：建立个人技术品牌',
      goalDesc: '目标描述（选填）',
      goalDescPlaceholder: '具体描述你想达成的状态...',
      deadline: '截止日期',
      createAndBreak: '创建并 AI 拆解',
      breaking: 'AI 拆解中...',
      inputTasks: '输入型任务（学习/积累）',
      outputTasks: '输出型任务（创作/交付）',
      noTasks: '暂无任务，AI 拆解后将自动生成',
      noGoal: '还没有设定目标，创建一个开始吧',
    },
    chat: {
      welcome: '你好，我是你的生涯教练',
      welcomeDesc: '我会帮你梳理现状、找到突破口、制定可执行的行动计划。你可以直接和我对话，也可以先完成右侧的自我诊断。',
      quickStart1: '帮我分析当前的职业瓶颈',
      quickStart2: '如何用3个月实现阶层跃迁',
      quickStart3: '制定一个可执行的成长计划',
      placeholder: '和你的教练对话...',
      send: '发送',
    },
    todayTasks: {
      title: '今日任务',
      pending: '{count} 项待完成',
      empty: '今日暂无任务，设定目标后自动生成',
    },
  },
}
