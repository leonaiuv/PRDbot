/**
 * error-mapper.ts 单元测试
 */

import {
  extractUpstreamError,
  buildErrorResponse,
  logError,
  handleAIAPIError,
} from '@/lib/error-mapper';

describe('error-mapper', () => {
  // Mock console.log
  const originalLog = console.log;
  beforeEach(() => {
    console.log = jest.fn();
  });

  afterAll(() => {
    console.log = originalLog;
  });

  describe('extractUpstreamError', () => {
    it('应从JSON错误中提取error.message', () => {
      const errorText = JSON.stringify({
        error: { message: 'invalid api key' },
      });
      expect(extractUpstreamError(errorText)).toBe('invalid api key');
    });

    it('应从JSON错误中提取message', () => {
      const errorText = JSON.stringify({
        message: 'quota exceeded',
      });
      expect(extractUpstreamError(errorText)).toBe('quota exceeded');
    });

    it('应从JSON错误中提取error字符串', () => {
      const errorText = JSON.stringify({
        error: 'model not found',
      });
      expect(extractUpstreamError(errorText)).toBe('model not found');
    });

    it('非JSON响应应截取前200字符', () => {
      const errorText = 'A'.repeat(300);
      const result = extractUpstreamError(errorText);
      expect(result.length).toBe(200);
    });

    it('空字符串应返回空', () => {
      expect(extractUpstreamError('')).toBe('');
    });
  });

  describe('buildErrorResponse', () => {
    it('401错误应返回认证失败提示', () => {
      const response = buildErrorResponse(401, 'invalid api key');
      expect(response.error).toContain('API Key');
      expect(response.code).toBe('AUTH_INVALID_KEY');
      expect(response.suggestion).toContain('设置');
      expect(response.detail).toBe('invalid api key');
    });

    it('429错误应返回限流提示', () => {
      const response = buildErrorResponse(429, 'rate limit');
      expect(response.error).toContain('频繁');
      expect(response.code).toBe('RATE_LIMITED');
      expect(response.suggestion).toContain('60秒');
    });

    it('404错误应返回模型不可用提示', () => {
      const response = buildErrorResponse(404, 'model not found');
      expect(response.error).toContain('模型');
      expect(response.code).toBe('MODEL_NOT_FOUND');
      expect(response.suggestion).toContain('配置');
    });

    it('500错误应返回服务不可用提示', () => {
      const response = buildErrorResponse(500);
      expect(response.error).toContain('不可用');
      expect(response.code).toBe('SERVER_ERROR');
      expect(response.suggestion).toContain('稍后');
    });

    it('未知状态码应返回通用错误', () => {
      const response = buildErrorResponse(999);
      expect(response.error).toContain('服务异常');
      expect(response.code).toBe('UNKNOWN_ERROR');
    });

    it('应包含上游详细错误信息', () => {
      const detail = 'Detailed error from upstream';
      const response = buildErrorResponse(400, detail);
      expect(response.detail).toBe(detail);
    });
  });

  describe('logError', () => {
    it('5xx错误应记录ERROR级别', () => {
      logError('test-api', 500, 'server error');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'server error'
      );
    });

    it('4xx错误应记录WARN级别', () => {
      logError('test-api', 401, 'auth error');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'auth error'
      );
    });

    it('日志应包含上下文信息', () => {
      logError('analyze', 404, 'not found');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[analyze]'),
        'not found'
      );
    });

    it('日志应包含时间戳', () => {
      logError('test', 500, 'error');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
        'error'
      );
    });
  });

  describe('handleAIAPIError', () => {
    it('应正确处理401错误响应', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'invalid token' },
        })),
      } as Response;

      const result = await handleAIAPIError('test', mockResponse);
      
      expect(result.status).toBe(401);
      expect(result.errorResponse.error).toContain('API Key');
      expect(result.errorResponse.code).toBe('AUTH_INVALID_KEY');
      expect(result.errorResponse.detail).toBe('invalid token');
    });

    it('应记录错误日志', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as Response;

      await handleAIAPIError('analyze', mockResponse);
      
      expect(console.log).toHaveBeenCalled();
    });

    it('应处理非JSON错误响应', async () => {
      const mockResponse = {
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      } as Response;

      const result = await handleAIAPIError('test', mockResponse);
      
      expect(result.status).toBe(502);
      expect(result.errorResponse.code).toBe('BAD_GATEWAY');
    });
  });

  describe('完整错误处理流程', () => {
    it('应从原始响应到结构化错误', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({
          error: {
            message: 'Rate limit exceeded. Please retry after 60 seconds.',
          },
        })),
      } as Response;

      const result = await handleAIAPIError('analyze', mockResponse);
      
      expect(result.status).toBe(429);
      expect(result.errorResponse).toEqual({
        error: '请求过于频繁',
        code: 'RATE_LIMITED',
        suggestion: '请等待60秒后重试',
        detail: 'Rate limit exceeded. Please retry after 60 seconds.',
      });
    });
  });
});
