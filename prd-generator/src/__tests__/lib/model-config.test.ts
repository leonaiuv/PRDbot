/**
 * model-config.ts 单元测试
 */

import {
  getModelConfig,
  getEndpoint,
  getDefaultModel,
  getSupportedModels,
  isModelSupported,
} from '@/lib/model-config';

describe('model-config', () => {
  describe('getModelConfig', () => {
    it('应返回deepseek配置', () => {
      const config = getModelConfig('deepseek');
      expect(config).not.toBeNull();
      expect(config?.endpoint).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(config?.defaultModel).toBe('deepseek-chat');
      expect(config?.contextWindow).toBe(32768);
    });

    it('应返回qwen配置(使用qwen-turbo)', () => {
      const config = getModelConfig('qwen');
      expect(config).not.toBeNull();
      expect(config?.endpoint).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
      expect(config?.defaultModel).toBe('qwen-turbo');
      expect(config?.contextWindow).toBe(8192);
    });

    it('应返回doubao配置(使用doubao-pro-4k)', () => {
      const config = getModelConfig('doubao');
      expect(config).not.toBeNull();
      expect(config?.endpoint).toBe('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
      expect(config?.defaultModel).toBe('doubao-pro-4k');
      expect(config?.contextWindow).toBe(4096);
    });

    it('custom模型应返回null', () => {
      const config = getModelConfig('custom');
      expect(config).toBeNull();
    });

    it('未知模型应返回null', () => {
      const config = getModelConfig('unknown-model');
      expect(config).toBeNull();
    });
  });

  describe('getEndpoint', () => {
    it('应返回正确的端点URL', () => {
      expect(getEndpoint('deepseek')).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(getEndpoint('qwen')).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
      expect(getEndpoint('doubao')).toBe('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
    });

    it('custom模型应返回空字符串', () => {
      expect(getEndpoint('custom')).toBe('');
    });

    it('未知模型应返回空字符串', () => {
      expect(getEndpoint('unknown')).toBe('');
    });
  });

  describe('getDefaultModel', () => {
    it('应返回正确的默认模型名称', () => {
      expect(getDefaultModel('deepseek')).toBe('deepseek-chat');
      expect(getDefaultModel('qwen')).toBe('qwen-turbo');
      expect(getDefaultModel('doubao')).toBe('doubao-pro-4k');
    });

    it('custom模型应返回custom', () => {
      expect(getDefaultModel('custom')).toBe('custom');
    });

    it('未知模型应返回原值', () => {
      expect(getDefaultModel('unknown-model')).toBe('unknown-model');
    });
  });

  describe('getSupportedModels', () => {
    it('应返回所有支持的模型', () => {
      const models = getSupportedModels();
      expect(models).toContain('deepseek');
      expect(models).toContain('qwen');
      expect(models).toContain('doubao');
      expect(models.length).toBe(3);
    });
  });

  describe('isModelSupported', () => {
    it('应识别支持的模型', () => {
      expect(isModelSupported('deepseek')).toBe(true);
      expect(isModelSupported('qwen')).toBe(true);
      expect(isModelSupported('doubao')).toBe(true);
      expect(isModelSupported('custom')).toBe(true);
    });

    it('应识别不支持的模型', () => {
      expect(isModelSupported('unknown')).toBe(false);
      expect(isModelSupported('gpt-4')).toBe(false);
    });
  });

  describe('模型配置一致性', () => {
    it('所有API应使用相同的qwen模型', () => {
      const config = getModelConfig('qwen');
      expect(config?.defaultModel).toBe('qwen-turbo');
    });

    it('所有API应使用相同的doubao模型', () => {
      const config = getModelConfig('doubao');
      expect(config?.defaultModel).toBe('doubao-pro-4k');
    });

    it('所有API应使用相同的deepseek模型', () => {
      const config = getModelConfig('deepseek');
      expect(config?.defaultModel).toBe('deepseek-chat');
    });
  });
});
