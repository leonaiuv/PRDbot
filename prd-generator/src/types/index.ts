// 项目状态类型
export type ProjectStatus = 'exploring' | 'generated' | 'exported';

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
  selector?: SelectorData;
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
