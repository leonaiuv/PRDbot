import type {
  Project,
  Settings,
  ConversationMessage,
  SelectorData,
  ChatDraft,
  PRDGenerationTaskPersisted,
  QuestionMeta,
  SelectorOption,
  TranslationTaskPersisted,
  TranslationCache,
  LanguageConfig,
  AnalysisResult,
  AnalysisType,
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

// ========== 翻译功能测试工厂函数 ==========

export function createTestTranslationTask(
  projectId: string,
  langCode: string = 'en',
  overrides?: Partial<TranslationTaskPersisted>
): TranslationTaskPersisted {
  return {
    id: `${projectId}_${langCode}`,
    projectId,
    langCode,
    langName: '英语',
    phase: 'idle',
    startTime: Date.now(),
    progress: 0,
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createTestTranslationCache(
  projectId: string,
  langCode: string = 'en',
  overrides?: Partial<TranslationCache>
): TranslationCache {
  const contentHash = `hash_${Date.now()}`
  return {
    id: `${contentHash}_${langCode}`,
    projectId,
    langCode,
    langName: '英语',
    contentHash,
    translatedContent: '# Translated PRD\n\nThis is translated content.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createTestLanguageConfig(overrides?: Partial<LanguageConfig>): LanguageConfig {
  return {
    code: 'en',
    name: '英语',
    nativeName: 'English',
    flag: '🇺🇸',
    ...overrides,
  }
}

export const TEST_LANGUAGES: LanguageConfig[] = [
  { code: 'en', name: '英语', flag: '🇺🇸', nativeName: 'English' },
  { code: 'ja', name: '日语', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: '韩语', flag: '🇰🇷', nativeName: '한국어' },
]

// ========== AI分析结果测试工厂函数 ==========

export function createTestAnalysisResult(
  projectId: string,
  type: AnalysisType = 'optimize',
  overrides?: Partial<AnalysisResult>
): AnalysisResult {
  const now = Date.now()
  return {
    id: `${projectId}_${type}`,
    projectId,
    type,
    content: `# ${type === 'optimize' ? 'AI优化建议' : type === 'score' ? '质量评分' : type === 'competitor' ? '竞品分析' : '图表生成'}\n\n这是测试内容。`,
    prdContentHash: `hash_${now}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export const TEST_ANALYSIS_TYPES: AnalysisType[] = ['optimize', 'score', 'competitor', 'diagram']
