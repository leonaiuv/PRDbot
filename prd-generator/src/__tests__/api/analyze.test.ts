/**
 * @jest-environment node
 */

import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';

// Mock fetch全局函数
global.fetch = jest.fn();

describe('/api/analyze', () => {
  const mockPRD = `# 产品名称
## 功能需求
1. 用户登录
2. 数据管理
3. 报表生成`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数校验', () => {
    it('应拒绝空PRD内容', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: '',
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('PRD内容不能为空');
    });

    it('应拒绝缺少API Key', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: '',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('API Key');
    });

    it('应拒绝无效的分析类型', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'invalid_type',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('无效的分析类型');
    });
  });

  describe.each(['optimize', 'score', 'competitor', 'diagram'] as const)(
    '%s 分析类型',
    (type) => {
      it(`应成功返回 ${type} 分析结果`, async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: `${type} analysis result`,
              },
            },
          ],
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const request = new NextRequest('http://localhost/api/analyze', {
          method: 'POST',
          body: JSON.stringify({
            type,
            prdContent: mockPRD,
            model: 'deepseek',
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.content).toBe(`${type} analysis result`);

        // 验证fetch调用参数
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.deepseek.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-key',
            }),
          })
        );
      });
    }
  );

  describe('模型配置一致性', () => {
    it('qwen应使用qwen-turbo模型', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'qwen',
          apiKey: 'test-key',
        }),
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.model).toBe('qwen-turbo');
    });

    it('doubao应使用doubao-pro-4k模型', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'doubao',
          apiKey: 'test-key',
        }),
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.model).toBe('doubao-pro-4k');
    });

    it('deepseek应使用deepseek-chat模型', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.model).toBe('deepseek-chat');
    });
  });

  describe('错误处理', () => {
    it('401错误应返回友好提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'invalid api key' },
        })),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'invalid-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toContain('API Key');
      expect(data.suggestion).toBeDefined();
      expect(data.code).toBe('AUTH_INVALID_KEY');
    });

    it('429错误应返回限流提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'rate limit exceeded' },
        })),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.error).toContain('频繁');
      expect(data.code).toBe('RATE_LIMITED');
    });

    it('404错误应返回模型不可用提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'model not found' },
        })),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain('模型');
      expect(data.code).toBe('MODEL_NOT_FOUND');
    });

    it('500错误应返回服务不可用提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'deepseek',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('SERVER_ERROR');
    });
  });

  describe('自定义API白名单', () => {
    it('应允许api.openai.com', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'custom',
          apiKey: 'test-key',
          customApiUrl: 'https://api.openai.com/v1/chat/completions',
          customModelName: 'gpt-4',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('应拒绝内网地址', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'custom',
          apiKey: 'test-key',
          customApiUrl: 'https://192.168.1.1/api',
          customModelName: 'test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('内网');
    });

    it('应拒绝HTTP协议', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'custom',
          apiKey: 'test-key',
          customApiUrl: 'http://api.openai.com/v1/chat/completions',
          customModelName: 'gpt-4',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('HTTPS');
    });

    it('应拒绝不在白名单的域名', async () => {
      const request = new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          type: 'optimize',
          prdContent: mockPRD,
          model: 'custom',
          apiKey: 'test-key',
          customApiUrl: 'https://evil.com/api',
          customModelName: 'test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('白名单');
    });
  });
});
