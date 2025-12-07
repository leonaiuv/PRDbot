/**
 * AI模型统一配置模块
 * - 提供所有AI服务提供商的端点和模型配置
 * - 统一管理模型名称,避免不一致
 * - 支持环境变量覆盖默认配置
 */

export interface ModelConfig {
  /** API端点URL */
  endpoint: string;
  /** 默认模型名称 */
  defaultModel: string;
  /** 上下文窗口大小 (tokens) */
  contextWindow: number;
  /** 千token计费价格(元) */
  costPer1kTokens: number;
  /** 支持的功能特性 */
  supportedFeatures: string[];
}

/**
 * AI服务提供商配置
 * 所有API路由(analyze/chat/generate-prd)使用相同的模型配置
 */
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    contextWindow: 32768,
    costPer1kTokens: 0.001,
    supportedFeatures: ['streaming', 'json_mode'],
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    // 统一使用qwen-turbo基础版,成本低、覆盖面广
    defaultModel: process.env.NEXT_PUBLIC_QWEN_MODEL || 'qwen-turbo',
    contextWindow: 8192,
    costPer1kTokens: 0.0008,
    supportedFeatures: ['streaming', 'json_mode'],
  },
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    // 统一使用doubao-pro-4k基础版,与chat/prd保持一致
    defaultModel: process.env.NEXT_PUBLIC_DOUBAO_MODEL || 'doubao-pro-4k',
    contextWindow: 4096,
    costPer1kTokens: 0.0005,
    supportedFeatures: ['streaming'],
  },
};

/**
 * 获取完整的模型配置
 * @param model 模型标识符 (deepseek/qwen/doubao/custom)
 * @returns 模型配置对象,如果是custom则返回null
 */
export function getModelConfig(model: string): ModelConfig | null {
  if (model === 'custom') {
    return null; // 自定义API由调用方提供URL和模型名
  }
  
  const config = MODEL_CONFIGS[model];
  if (!config) {
    console.warn(`Unknown model: ${model}, available models:`, Object.keys(MODEL_CONFIGS));
    return null;
  }
  
  return config;
}

/**
 * 获取API端点URL
 * @param model 模型标识符
 * @returns API端点URL,如果是custom或未找到则返回空字符串
 */
export function getEndpoint(model: string): string {
  const config = getModelConfig(model);
  return config?.endpoint || '';
}

/**
 * 获取默认模型名称
 * @param model 模型标识符
 * @returns 实际使用的模型名称,如果是custom或未找到则返回原值
 */
export function getDefaultModel(model: string): string {
  const config = getModelConfig(model);
  return config?.defaultModel || model;
}

/**
 * 获取所有支持的模型列表
 * @returns 模型标识符数组
 */
export function getSupportedModels(): string[] {
  return Object.keys(MODEL_CONFIGS);
}

/**
 * 验证模型是否支持
 * @param model 模型标识符
 * @returns 是否为支持的模型
 */
export function isModelSupported(model: string): boolean {
  return model === 'custom' || model in MODEL_CONFIGS;
}
