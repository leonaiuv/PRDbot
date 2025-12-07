// 项目状态类型
export type ProjectStatus = 'exploring' | 'generated' | 'exported';

// 项目标签预设
export const PROJECT_TAGS = [
  { id: 'in-progress', label: '进行中', color: 'bg-blue-500' },
  { id: 'completed', label: '已完成', color: 'bg-green-500' },
  { id: 'archived', label: '已归档', color: 'bg-gray-500' },
  { id: 'web', label: 'Web端', color: 'bg-purple-500' },
  { id: 'mobile', label: '移动端', color: 'bg-orange-500' },
  { id: 'desktop', label: '桌面端', color: 'bg-teal-500' },
  { id: 'saas', label: 'SaaS', color: 'bg-indigo-500' },
  { id: 'ai', label: 'AI', color: 'bg-pink-500' },
  { id: 'urgent', label: '紧急', color: 'bg-red-500' },
  { id: 'important', label: '重要', color: 'bg-amber-500' },
] as const;

export type ProjectTagId = typeof PROJECT_TAGS[number]['id'];

// 选择器类型
export type SelectorType = 'radio' | 'checkbox' | 'dropdown' | 'text';

// 消息角色
export type MessageRole = 'user' | 'assistant';

// 选择器选项
export interface SelectorOption {
  value: string;
  label: string;
}

// 选择器数据
export interface SelectorData {
  id: string;
  type: SelectorType;
  question: string;
  options: SelectorOption[];
  required: boolean;
}

// AI问题数据
export interface AIQuestion {
  id: string;
  question: string;
  type: SelectorType;
  options: SelectorOption[];
  required: boolean;
}

// AI响应中的问题列表
export interface AIQuestionsResponse {
  questions: AIQuestion[];
}

// 用户选择
export interface UserChoice {
  selectorId: string;
  selectedValues: string[];
}

// 对话消息
export interface ConversationMessage {
  id: string;
  role: MessageRole;
  timestamp: number;
  content: string;
  selectors?: SelectorData[]; // 支持多个选择器
  userChoice?: UserChoice;
}

// 项目元数据
export interface ProjectMetadata {
  questionCount: number;
  progress: number;
  selectedModel: string;
}

// 项目数据
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectStatus;
  initialInput: string;
  conversation: ConversationMessage[];
  prdContent: string;
  metadata: ProjectMetadata;
  tags?: ProjectTagId[];  // 项目标签
}

// API密钥配置
export interface ApiKeyConfig {
  [provider: string]: string;
}

// 导出偏好设置
export interface ExportPreferences {
  defaultFormat: 'md' | 'pdf' | 'docx';
}

// 全局设置
export interface Settings {
  id: string;
  apiKeys: ApiKeyConfig;
  defaultModel: string;
  customApiUrl?: string;
  customModelName?: string; // 自定义模型名称（如 gpt-4, claude-3 等）
  exportPreferences: ExportPreferences;
}

// AI模型配置
export interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKeyRequired: boolean;
}

// 可用的AI模型列表
export const AI_MODELS: AIModelConfig[] = [
  { id: 'deepseek', name: 'DeepSeek', provider: 'deepseek', apiKeyRequired: true },
  { id: 'qwen', name: 'Qwen', provider: 'qwen', apiKeyRequired: true },
  { id: 'doubao', name: 'Doubao', provider: 'doubao', apiKeyRequired: true },
  { id: 'custom', name: '自定义API', provider: 'custom', apiKeyRequired: true },
];

// 聊天请求参数
export interface ChatRequest {
  messages: { role: string; content: string }[];
  model: string;
  apiKey: string;
  customApiUrl?: string;
}

// 聊天响应
export interface ChatResponse {
  content: string;
  done: boolean;
}

// ========== 表单生成优化相关类型 ==========

// 生成阶段
export type GenerationPhase = 
  | 'idle'           // 空闲
  | 'generating'     // 生成中
  | 'rendering'      // 渲染结果
  | 'interactive'    // 可交互
  | 'error'          // 错误
  | 'timeout';       // 超时

// 生成步骤
export type GenerationStep = 
  | 'understanding'  // 理解需求
  | 'generating'     // 生成问题
  | 'building'       // 构建表单
  | 'validating';    // 校验完成

// 步骤配置
export interface StepConfig {
  key: GenerationStep;
  label: string;
  percent: number;
  duration: number; // 毫秒
}

// 生成步骤配置
export const GENERATION_STEPS: StepConfig[] = [
  { key: 'understanding', label: '理解需求', percent: 25, duration: 3000 },
  { key: 'generating', label: '生成问题', percent: 50, duration: 5000 },
  { key: 'building', label: '构建表单', percent: 75, duration: 4000 },
  { key: 'validating', label: '校验完成', percent: 95, duration: 2000 },
];

// 问题元数据
export interface QuestionMeta {
  phase: 'basic' | 'feature' | 'technical' | 'confirmation';
  progress: number;
  canGeneratePRD: boolean;
  suggestedNextTopic?: string;
}

// 扩展的AI响应
export interface AIQuestionsResponseV2 {
  questions: AIQuestion[];
  meta?: QuestionMeta;
}

// 扩展选项，支持描述
export interface SelectorOptionV2 extends SelectorOption {
  description?: string;
}

// 扩展选择器数据
export interface SelectorDataV2 extends Omit<SelectorData, 'options'> {
  options: SelectorOptionV2[];
  helpText?: string;
  placeholder?: string;
}

// 生成状态
export interface GenerationState {
  phase: GenerationPhase;
  step: GenerationStep;
  stepIndex: number;
  startTime: number;
  error?: string;
  retryCount: number;
}

// ========== PRD生成状态管理 ==========

// PRD生成阶段
export type PRDGenerationPhase = 
  | 'idle'           // 空闲
  | 'generating'     // 生成中
  | 'completed'      // 已完成
  | 'error';         // 错误

// PRD生成任务状态（内存版，包含 AbortController）
export interface PRDGenerationTask {
  projectId: string;
  phase: PRDGenerationPhase;
  startTime: number;
  elapsedTime: number;
  streamContent: string;
  error?: string;
  abortController?: AbortController;
}

// PRD生成任务状态（持久化版，不含 AbortController）
export interface PRDGenerationTaskPersisted {
  projectId: string;
  phase: PRDGenerationPhase;
  startTime: number;
  elapsedTime: number;
  streamContent: string;
  error?: string;
  updatedAt: number;
}

// ========== 聊天草稿状态持久化 ==========

// 聊天草稿（用于持久化未提交的表单选择）
export interface ChatDraft {
  projectId: string;
  // 当前待交互的选择器
  currentSelectors: SelectorData[];
  // 用户已选择但未提交的值: { selectorId: selectedValues[] }
  selectionsMap: Record<string, string[]>;
  // 问题元数据
  questionMeta: QuestionMeta | null;
  // 生成阶段
  generationPhase: GenerationPhase;
  // 输入框暂存内容
  inputDraft: string;
  // 更新时间
  updatedAt: number;
}

// ========== PRD版本历史 ==========

// PRD版本快照
export interface PRDVersion {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  description?: string;  // 版本说明
  isAuto: boolean;       // 是否自动保存
}

// ========== 翻译功能状态管理 ==========

// 翻译任务阶段
export type TranslationPhase = 
  | 'idle'           // 空闲
  | 'translating'    // 翻译中
  | 'completed'      // 已完成
  | 'error';         // 错误

// 支持的语言配置
export interface LanguageConfig {
  code: string;        // 语言代码 (en, ja, ko 等)
  name: string;        // 中文名称
  nativeName: string;  // 原生名称
  flag: string;        // 表情符号国旗
}

// 翻译任务（内存版，包含 AbortController）
export interface TranslationTask {
  id: string;              // 任务唯一ID: projectId_langCode
  projectId: string;
  langCode: string;
  langName: string;
  phase: TranslationPhase;
  startTime: number;
  progress?: number;       // 翻译进度（百分比）
  error?: string;
  abortController?: AbortController;
}

// 翻译任务（持久化版，不含 AbortController）
export interface TranslationTaskPersisted {
  id: string;              // 任务唯一ID: projectId_langCode
  projectId: string;
  langCode: string;
  langName: string;
  phase: TranslationPhase;
  startTime: number;
  progress?: number;
  error?: string;
  updatedAt: number;
}

// 翻译缓存记录
export interface TranslationCache {
  id: string;              // 缓存ID: hash(prdContent)_langCode
  projectId: string;
  langCode: string;
  langName: string;
  contentHash: string;     // PRD内容的hash值
  translatedContent: string;
  createdAt: number;
  updatedAt: number;
}

// ========== AI分析结果持久化 ==========

// AI分析类型
export type AnalysisType = 'optimize' | 'score' | 'competitor' | 'diagram';

// AI分析结果记录
export interface AnalysisResult {
  id: string;              // 唯一ID: projectId_type
  projectId: string;
  type: AnalysisType;
  content: string;         // 分析结果内容
  prdContentHash: string;  // 生成时PRD内容的hash值
  createdAt: number;
  updatedAt: number;
}
