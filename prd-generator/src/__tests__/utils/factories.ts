import type {
  Project,
  Settings,
  ConversationMessage,
  SelectorData,
  ChatDraft,
  PRDGenerationTaskPersisted,
  QuestionMeta,
  SelectorOption,
} from '@/types'

export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function createTestProject(overrides?: Partial<Project>): Project {
  const now = Date.now()
  return {
    id: generateTestId(),
    name: '测试项目',
    createdAt: now,
    updatedAt: now,
    status: 'exploring',
    initialInput: '开发一个待办应用',
    conversation: [],
    prdContent: '',
    metadata: {
      questionCount: 0,
      progress: 0,
      selectedModel: 'deepseek',
    },
    ...overrides,
  }
}

export function createTestSettings(overrides?: Partial<Settings>): Settings {
  return {
    id: 'global',
    apiKeys: {},
    defaultModel: 'deepseek',
    exportPreferences: {
      defaultFormat: 'md',
    },
    ...overrides,
  }
}

export function createTestSelector(overrides?: Partial<SelectorData>): SelectorData {
  const options: SelectorOption[] = [
    { value: 'option1', label: '选项1' },
    { value: 'option2', label: '选项2' },
    { value: 'ai_decide', label: '由AI决定' },
  ]

  return {
    id: `selector_${generateTestId()}`,
    type: 'radio',
    question: '测试问题？',
    options,
    required: true,
    ...overrides,
  }
}

export function createTestMessage(overrides?: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: generateTestId(),
    role: 'user',
    timestamp: Date.now(),
    content: '测试消息',
    ...overrides,
  }
}

export function createTestChatDraft(projectId: string, overrides?: Partial<ChatDraft>): ChatDraft {
  return {
    projectId,
    currentSelectors: [],
    selectionsMap: {},
    questionMeta: null,
    generationPhase: 'idle',
    inputDraft: '',
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createTestPRDTask(
  projectId: string,
  overrides?: Partial<PRDGenerationTaskPersisted>
): PRDGenerationTaskPersisted {
  return {
    projectId,
    phase: 'idle',
    startTime: Date.now(),
    elapsedTime: 0,
    streamContent: '',
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createTestQuestionMeta(overrides?: Partial<QuestionMeta>): QuestionMeta {
  return {
    phase: 'basic',
    progress: 10,
    canGeneratePRD: false,
    suggestedNextTopic: '核心功能需求',
    ...overrides,
  }
}

export function createTestProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProject({
      name: `测试项目${i + 1}`,
      updatedAt: Date.now() - i * 1000,
    })
  )
}

export function createTestConversation(rounds: number): ConversationMessage[] {
  const messages: ConversationMessage[] = []

  for (let i = 0; i < rounds; i++) {
    messages.push(
      createTestMessage({
        role: 'user',
        content: `用户消息 ${i + 1}`,
        timestamp: Date.now() - (rounds - i) * 2000,
      })
    )

    const selectors = i < rounds - 1 ? [createTestSelector()] : []
    messages.push(
      createTestMessage({
        role: 'assistant',
        content: `AI回复 ${i + 1}`,
        timestamp: Date.now() - (rounds - i) * 2000 + 1000,
        selectors,
      })
    )
  }

  return messages
}
