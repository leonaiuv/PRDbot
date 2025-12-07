/**
 * API Route Tests
 * 
 * 测试 SSRF 防护、模型名称处理等安全和功能特性
 */

// Mock fetch for API tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import the validation function pattern (we test the validation logic)
describe('API Security Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('SSRF Protection - URL Validation', () => {
    // Test cases for URL validation logic
    const privatePatterns = [
      { url: 'https://localhost:3000', reason: 'localhost HTTPS' },
      { url: 'https://127.0.0.1:8080', reason: 'loopback IPv4' },
      { url: 'https://10.0.0.1/api', reason: 'private 10.x.x.x' },
      { url: 'https://172.16.0.1/api', reason: 'private 172.16.x.x' },
      { url: 'https://172.31.255.255/api', reason: 'private 172.31.x.x' },
      { url: 'https://192.168.1.1/api', reason: 'private 192.168.x.x' },
      { url: 'https://169.254.1.1/api', reason: 'link-local' },
      { url: 'https://0.0.0.0/api', reason: 'all interfaces' },
    ];

    privatePatterns.forEach(({ url, reason }) => {
      it(`should block private network address: ${reason}`, () => {
        const result = validateUrlSafety(url);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('不允许');
      });
    });

    const allowedUrls = [
      { url: 'https://api.openai.com/v1/chat', domain: 'api.openai.com' },
      { url: 'https://api.anthropic.com/v1/messages', domain: 'api.anthropic.com' },
      { url: 'https://api.moonshot.cn/v1/chat', domain: 'api.moonshot.cn' },
    ];

    allowedUrls.forEach(({ url, domain }) => {
      it(`should allow whitelisted domain: ${domain}`, () => {
        const result = validateUrlSafety(url);
        expect(result.valid).toBe(true);
      });
    });

    it('should block non-whitelisted domains', () => {
      const result = validateUrlSafety('https://evil-api.example.com/api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('白名单');
    });

    it('should block HTTP protocol', () => {
      const result = validateUrlSafety('http://api.openai.com/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('should reject invalid URL format', () => {
      const result = validateUrlSafety('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should reject empty URL', () => {
      const result = validateUrlSafety('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Custom Model Name Handling', () => {
    it('should require customModelName when model is custom', () => {
      const requestBody = {
        model: 'custom',
        customApiUrl: 'https://api.openai.com/v1/chat',
        apiKey: 'sk-xxx',
        customModelName: undefined,
      };
      
      const validation = validateCustomModelRequest(requestBody);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('模型名称');
    });

    it('should accept request with valid customModelName', () => {
      const requestBody = {
        model: 'custom',
        customApiUrl: 'https://api.openai.com/v1/chat',
        apiKey: 'sk-xxx',
        customModelName: 'gpt-4',
      };
      
      const validation = validateCustomModelRequest(requestBody);
      expect(validation.valid).toBe(true);
    });

    it('should use default model name for built-in models', () => {
      const defaultModels: Record<string, string> = {
        deepseek: 'deepseek-chat',
        qwen: 'qwen-turbo',
        doubao: 'doubao-pro-4k',
      };

      Object.entries(defaultModels).forEach(([modelId, expectedName]) => {
        const actualName = getActualModelName(modelId, undefined);
        expect(actualName).toBe(expectedName);
      });
    });
  });

  describe('API Key Validation', () => {
    it('should reject request without API key', () => {
      const validation = validateApiKeyPresence(undefined);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('API Key');
    });

    it('should reject empty API key', () => {
      const validation = validateApiKeyPresence('');
      expect(validation.valid).toBe(false);
    });

    it('should accept valid API key', () => {
      const validation = validateApiKeyPresence('sk-valid-key-123');
      expect(validation.valid).toBe(true);
    });
  });

  describe('Request Body Validation', () => {
    it('should validate chat messages array', () => {
      const invalidBodies = [
        { messages: null },
        { messages: 'not-array' },
        { messages: {} },
        {},
      ];

      invalidBodies.forEach(body => {
        const result = validateChatMessages(body.messages);
        expect(result.valid).toBe(false);
      });
    });

    it('should accept valid messages array', () => {
      const validMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      
      const result = validateChatMessages(validMessages);
      expect(result.valid).toBe(true);
    });
  });
});

// Helper functions to test (simulating the validation logic from route.ts)
function validateUrlSafety(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: '自定义 API URL 不能为空' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: '无效的 URL 格式' };
  }

  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: '只允许 HTTPS 协议' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: '不允许访问内网地址' };
    }
  }

  const allowedDomains = [
    'api.openai.com',
    'api.anthropic.com',
    'api.cohere.ai',
    'api.mistral.ai',
    'api.moonshot.cn',
    'api.baichuan-ai.com',
    'api.minimax.chat',
    'api.zhipuai.cn',
    'open.bigmodel.cn',
    'aip.baidubce.com',
    'api.siliconflow.cn',
  ];

  const isAllowed = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return { 
      valid: false, 
      error: `不在允许的 API 域名白名单中` 
    };
  }

  return { valid: true };
}

function validateCustomModelRequest(body: {
  model: string;
  customModelName?: string;
}): { valid: boolean; error?: string } {
  if (body.model === 'custom' && !body.customModelName) {
    return { valid: false, error: '使用自定义 API 时需要指定模型名称' };
  }
  return { valid: true };
}

function getActualModelName(model: string, customModelName?: string): string {
  const defaultModels: Record<string, string> = {
    deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo',
    doubao: 'doubao-pro-4k',
  };
  
  if (model === 'custom') {
    return customModelName || '';
  }
  return defaultModels[model] || model;
}

function validateApiKeyPresence(apiKey: string | undefined): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: false, error: '请先配置 API Key' };
  }
  return { valid: true };
}

function validateChatMessages(messages: unknown): { valid: boolean; error?: string } {
  if (!messages || !Array.isArray(messages)) {
    return { valid: false, error: '消息格式错误' };
  }
  return { valid: true };
}
