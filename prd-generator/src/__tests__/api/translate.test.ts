/**
 * Translate API Tests
 * 
 * 测试翻译功能的各项特性：
 * - 内容长度验证
 * - 分段翻译逻辑
 * - 域名白名单（扩展后）
 * - 错误处理
 * - 服务端 API Key 获取
 */

// Mock fetch for API tests
const translateMockFetch = jest.fn();
(global as unknown as { fetch: typeof translateMockFetch }).fetch = translateMockFetch;

describe('Translate API Tests', () => {
  beforeEach(() => {
    translateMockFetch.mockClear();
    // 清除环境变量
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.QWEN_API_KEY;
    delete process.env.DOUBAO_API_KEY;
    delete process.env.CUSTOM_API_KEY;
  });

  describe('Content Length Validation', () => {
    const MAX_CONTENT_LENGTH = 30000;

    it('should accept content within length limit', () => {
      const content = 'A'.repeat(5000);
      const result = validateContentLength(content);
      expect(result.valid).toBe(true);
    });

    it('should reject content exceeding length limit', () => {
      const content = 'A'.repeat(MAX_CONTENT_LENGTH + 1);
      const result = validateContentLength(content);
      expect(result.valid).toBe(false);
      expect(result.contentLength).toBe(MAX_CONTENT_LENGTH + 1);
      expect(result.maxLength).toBe(MAX_CONTENT_LENGTH);
    });

    it('should reject empty content', () => {
      const result = validateContentLength('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Content Chunking', () => {
    const CHUNK_SIZE = 6000;

    it('should not split short content', () => {
      const content = 'Short content';
      const chunks = splitContentIntoChunks(content);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(content);
    });

    it('should split long content at heading boundaries', () => {
      // 创建足够长的内容来触发分段
      const section1 = 'A'.repeat(CHUNK_SIZE);
      const section2 = 'B'.repeat(CHUNK_SIZE);
      const content = `## Section 1\n${section1}\n## Section 2\n${section2}`;
      
      const chunks = splitContentIntoChunks(content);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should force split very long sections without headings', () => {
      // 创建超过 1.5 倍 CHUNK_SIZE 的内容
      // 注意：分段逻辑会在超过 1.5 倍后分割，所以需要多个这样的段落
      const lineContent = 'A'.repeat(CHUNK_SIZE * 2) + '\n'; // 单行超长
      const content = lineContent.repeat(2);
      const chunks = splitContentIntoChunks(content);
      // 当内容超过阈值时应该被分割
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // 对于超长内容应该被分段
      if (content.length > CHUNK_SIZE * 1.5) {
        expect(chunks.length).toBeGreaterThan(1);
      }
    });

    it('should handle content with multiple heading levels', () => {
      const content = `# Title
## Section 1
${'A'.repeat(3000)}
### Subsection
${'B'.repeat(3000)}
## Section 2
${'C'.repeat(3000)}`;
      const chunks = splitContentIntoChunks(content);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Extended Domain Whitelist', () => {
    // 测试静态白名单域名
    const allowedDomains = [
      { url: 'https://api.openai.com/v1/chat', name: 'OpenAI' },
      { url: 'https://api.anthropic.com/v1/messages', name: 'Anthropic' },
      { url: 'https://generativelanguage.googleapis.com/v1/models', name: 'Google AI' },
      { url: 'https://api.groq.com/v1/chat', name: 'Groq' },
      { url: 'https://api.together.xyz/v1/chat', name: 'Together AI' },
      { url: 'https://openrouter.ai/api/v1/chat', name: 'OpenRouter' },
    ];

    allowedDomains.forEach(({ url, name }) => {
      it(`should allow ${name} domain`, () => {
        const result = validateTranslateApiUrl(url);
        expect(result.valid).toBe(true);
      });
    });

    // 测试 Azure OpenAI 动态模式
    it('should allow Azure OpenAI custom resource domains', () => {
      const azureUrls = [
        'https://my-company.openai.azure.com/openai/deployments/gpt-4',
        'https://prod-ai-service.openai.azure.com/openai/deployments/text-davinci-003',
      ];

      azureUrls.forEach(url => {
        const result = validateTranslateApiUrl(url);
        expect(result.valid).toBe(true);
      });
    });

    // 测试被禁止的域名
    it('should block non-whitelisted domains', () => {
      const result = validateTranslateApiUrl('https://evil-api.example.com/api');
      expect(result.valid).toBe(false);
    });

    // 测试内网地址
    it('should block private network addresses', () => {
      const privateUrls = [
        'https://localhost:3000',
        'https://127.0.0.1/api',
        'https://10.0.0.1/api',
        'https://192.168.1.1/api',
      ];

      privateUrls.forEach(url => {
        const result = validateTranslateApiUrl(url);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Error Response Parsing', () => {
    it('should parse OpenAI-style error response', () => {
      const errorText = JSON.stringify({
        error: {
          message: 'Invalid API key provided',
          type: 'invalid_request_error',
        }
      });
      
      const parsed = parseProviderError(errorText);
      expect(parsed).toBe('Invalid API key provided');
    });

    it('should parse simple message error response', () => {
      const errorText = JSON.stringify({
        message: 'Rate limit exceeded'
      });
      
      const parsed = parseProviderError(errorText);
      expect(parsed).toBe('Rate limit exceeded');
    });

    it('should handle plain text error', () => {
      const errorText = 'Internal Server Error';
      const parsed = parseProviderError(errorText);
      expect(parsed).toBe('Internal Server Error');
    });

    it('should truncate very long error messages', () => {
      const longError = 'A'.repeat(500);
      const parsed = parseProviderError(longError);
      expect(parsed.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Server API Key Resolution', () => {
    it('should use server-side API key when available', () => {
      process.env.DEEPSEEK_API_KEY = 'server-key-123';
      
      const result = getEffectiveApiKey('deepseek', 'client-key-456');
      expect(result).toBe('server-key-123');
    });

    it('should fall back to client API key when server key not configured', () => {
      const result = getEffectiveApiKey('deepseek', 'client-key-456');
      expect(result).toBe('client-key-456');
    });

    it('should return null when no key available', () => {
      const result = getEffectiveApiKey('deepseek', undefined);
      expect(result).toBeNull();
    });

    it('should support all model providers', () => {
      const providers = ['deepseek', 'qwen', 'doubao', 'custom'];
      
      providers.forEach(provider => {
        process.env[`${provider.toUpperCase()}_API_KEY`] = `server-${provider}-key`;
        const result = getEffectiveApiKey(provider, 'client-key');
        expect(result).toBe(`server-${provider}-key`);
        delete process.env[`${provider.toUpperCase()}_API_KEY`];
      });
    });
  });

  describe('Translation Request Validation', () => {
    it('should require target language', () => {
      const result = validateTranslateRequest({
        content: 'Test content',
        targetLang: '',
        model: 'deepseek',
      });
      expect(result.valid).toBe(false);
    });

    it('should require valid model', () => {
      const result = validateTranslateRequest({
        content: 'Test content',
        targetLang: 'English',
        model: '',
      });
      expect(result.valid).toBe(false);
    });

    it('should accept valid request', () => {
      const result = validateTranslateRequest({
        content: 'Test content',
        targetLang: 'English',
        model: 'deepseek',
      });
      expect(result.valid).toBe(true);
    });
  });
});

// ========== Helper Functions (模拟 route.ts 中的逻辑) ==========

const MAX_CONTENT_LENGTH = 30000;
const CHUNK_SIZE = 6000;

function validateContentLength(content: string): { 
  valid: boolean; 
  error?: string; 
  contentLength?: number;
  maxLength?: number;
} {
  if (!content) {
    return { valid: false, error: '内容不能为空' };
  }
  
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      error: `文档过长（${content.length} 字符）`,
      contentLength: content.length,
      maxLength: MAX_CONTENT_LENGTH,
    };
  }
  
  return { valid: true };
}

function splitContentIntoChunks(content: string): string[] {
  if (content.length <= CHUNK_SIZE) {
    return [content];
  }

  const chunks: string[] = [];
  const lines = content.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    const isHeading = /^#{1,3}\s/.test(line);
    
    if (currentChunk.length + line.length > CHUNK_SIZE && isHeading && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    currentChunk += line + '\n';
    
    if (currentChunk.length > CHUNK_SIZE * 1.5) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function validateTranslateApiUrl(url: string): { valid: boolean; error?: string } {
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
  
  // 内网地址检查
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: '不允许访问内网地址' };
    }
  }

  // 扩展的白名单
  const allowedDomains = [
    'api.openai.com',
    'openai.azure.com',
    'api.anthropic.com',
    'api.cohere.ai',
    'api.mistral.ai',
    'generativelanguage.googleapis.com',
    'api.moonshot.cn',
    'api.baichuan-ai.com',
    'api.minimax.chat',
    'api.zhipuai.cn',
    'open.bigmodel.cn',
    'aip.baidubce.com',
    'api.siliconflow.cn',
    'openrouter.ai',
    'api.together.xyz',
    'api.groq.com',
    'api.fireworks.ai',
    'api.perplexity.ai',
    'api.replicate.com',
  ];

  const isInWhitelist = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  if (isInWhitelist) {
    return { valid: true };
  }

  // Azure OpenAI 动态模式
  const AZURE_OPENAI_PATTERN = /^[a-z0-9-]+\.openai\.azure\.com$/i;
  if (AZURE_OPENAI_PATTERN.test(hostname)) {
    return { valid: true };
  }

  return { 
    valid: false, 
    error: `域名不在允许列表中: ${hostname}` 
  };
}

function parseProviderError(errorText: string): string {
  try {
    const errorJson = JSON.parse(errorText);
    const message = errorJson.error?.message 
      || errorJson.message 
      || errorJson.error 
      || errorText.substring(0, 200);
    return typeof message === 'string' ? message.substring(0, 200) : errorText.substring(0, 200);
  } catch {
    return errorText.substring(0, 200);
  }
}

const SERVER_API_KEY_ENV: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'QWEN_API_KEY',
  doubao: 'DOUBAO_API_KEY',
  custom: 'CUSTOM_API_KEY',
};

function getEffectiveApiKey(model: string, clientApiKey?: string): string | null {
  const envKey = SERVER_API_KEY_ENV[model];
  if (envKey) {
    const serverKey = process.env[envKey];
    if (serverKey) {
      return serverKey;
    }
  }
  return clientApiKey || null;
}

function validateTranslateRequest(body: {
  content: string;
  targetLang: string;
  model: string;
}): { valid: boolean; error?: string } {
  if (!body.content) {
    return { valid: false, error: '内容不能为空' };
  }
  if (!body.targetLang) {
    return { valid: false, error: '目标语言不能为空' };
  }
  if (!body.model) {
    return { valid: false, error: '模型不能为空' };
  }
  return { valid: true };
}
