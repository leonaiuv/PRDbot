import { NextResponse } from 'next/server';

interface TranslateRequest {
  content: string;
  targetLang: string;
  model: string;
  apiKey?: string; // 可选，如果服务端配置了环境变量则可省略
  customApiUrl?: string;
  customModelName?: string;
}

// 服务端 API Key 环境变量映射（用于多用户部署场景）
const SERVER_API_KEY_ENV: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'QWEN_API_KEY',
  doubao: 'DOUBAO_API_KEY',
  custom: 'CUSTOM_API_KEY',
};

/**
 * 获取有效的 API Key
 * 优先级：服务端环境变量 > 客户端传递
 * 这样可以在多用户部署时避免密钥暴露
 */
function getEffectiveApiKey(model: string, clientApiKey?: string): string | null {
  // 优先使用服务端环境变量
  const envKey = SERVER_API_KEY_ENV[model];
  if (envKey) {
    const serverKey = process.env[envKey];
    if (serverKey) {
      return serverKey;
    }
  }
  
  // 回退到客户端传递的 Key
  return clientApiKey || null;
}

// API 端点配置
const API_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
};

// 允许的自定义 API 域名白名单（支持精确匹配和后缀匹配）
const ALLOWED_CUSTOM_DOMAINS = [
  // OpenAI 系列
  'api.openai.com',
  'openai.azure.com',        // Azure OpenAI
  // Anthropic
  'api.anthropic.com',
  // 其他国际 AI 服务
  'api.cohere.ai',
  'api.mistral.ai',
  'generativelanguage.googleapis.com', // Google AI
  // 国内 AI 服务
  'api.moonshot.cn',
  'api.baichuan-ai.com',
  'api.minimax.chat',
  'api.zhipuai.cn',
  'open.bigmodel.cn',
  'aip.baidubce.com',
  'api.siliconflow.cn',
  // 企业代理网关常见模式
  'openrouter.ai',
  'api.together.xyz',
  'api.groq.com',
  'api.fireworks.ai',
  'api.perplexity.ai',
  'api.replicate.com',
];

// Azure OpenAI 的特殊域名模式（支持自定义资源名）
const AZURE_OPENAI_PATTERN = /^[a-z0-9-]+\.openai\.azure\.com$/i;
// 常见企业内网代理的安全模式
const ENTERPRISE_PROXY_PATTERNS = [
  /^api\.[a-z0-9-]+\.corp\.[a-z]+$/i,  // 企业内部 API 网关
  /^llm\.[a-z0-9-]+\.[a-z]+$/i,        // LLM 服务网关
];

/**
 * 校验自定义 API URL 的安全性
 * 防止 SSRF 攻击
 */
function validateCustomApiUrl(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: '自定义 API URL 不能为空' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: '无效的 URL 格式' };
  }

  // 只允许 HTTPS 协议
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: '只允许 HTTPS 协议' };
  }

  // 禁止内网地址
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

  // 检查静态白名单
  const isInWhitelist = ALLOWED_CUSTOM_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  if (isInWhitelist) {
    return { valid: true };
  }

  // 检查 Azure OpenAI 动态模式
  if (AZURE_OPENAI_PATTERN.test(hostname)) {
    return { valid: true };
  }

  // 检查企业代理模式（警告模式，仍允许通过）
  const isEnterpriseProxy = ENTERPRISE_PROXY_PATTERNS.some(pattern => pattern.test(hostname));
  if (isEnterpriseProxy) {
    console.warn(`Enterprise proxy domain detected: ${hostname}`);
    return { valid: true };
  }

  return { 
    valid: false, 
    error: `域名不在允许列表中: ${hostname}。支持的域名模式包括: OpenAI, Azure OpenAI (*.openai.azure.com), Anthropic, Google AI 及主流国内 AI 服务商。` 
  };
}

const MODEL_NAMES: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  doubao: 'doubao-pro-32k',
};

// 内容长度限制配置（字符数）
const MAX_CONTENT_LENGTH = 30000; // 最大内容长度
const CHUNK_SIZE = 6000;           // 分段大小（考虑中英文token比例）
const MAX_TOKENS_PER_CHUNK = 4000; // 每段输出的max_tokens

/**
 * 将内容按Markdown标题结构智能分段
 * 优先在二级标题处分割，保持文档结构完整性
 */
function splitContentIntoChunks(content: string): string[] {
  // 如果内容较短，不需要分段
  if (content.length <= CHUNK_SIZE) {
    return [content];
  }

  const chunks: string[] = [];
  const lines = content.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    // 检查是否为标题行（## 或 ### 级别）
    const isHeading = /^#{1,3}\s/.test(line);
    
    // 如果当前块加上新行会超过限制，且是在标题处，则分割
    if (currentChunk.length + line.length > CHUNK_SIZE && isHeading && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    currentChunk += line + '\n';
    
    // 如果当前块已经超过限制很多，强制分割
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

/**
 * 翻译单个内容块
 */
async function translateChunk(
  chunk: string,
  targetLang: string,
  apiUrl: string,
  apiKey: string,
  modelName: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const contextHint = totalChunks > 1 
    ? `（这是文档第 ${chunkIndex + 1}/${totalChunks} 部分，请保持翻译风格一致）` 
    : '';

  const prompt = `你是一位专业的技术文档翻译专家。请将以下PRD文档翻译成${targetLang}。${contextHint}

翻译要求：
1. 保持Markdown格式不变
2. 专业术语保持准确
3. 保留原有的标题层级结构
4. 代码块、变量名等技术内容保持原样
5. 保持专业、正式的语言风格

请只输出翻译结果，不要包含任何解释或说明。`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: chunk },
      ],
      temperature: 0.3,
      max_tokens: MAX_TOKENS_PER_CHUNK,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let providerError = '';
    try {
      const errorJson = JSON.parse(errorText);
      providerError = errorJson.error?.message || errorJson.message || errorJson.error || errorText.substring(0, 200);
    } catch {
      providerError = errorText.substring(0, 200);
    }
    throw new Error(`翻译第 ${chunkIndex + 1} 部分失败: ${providerError}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: Request) {
  try {
    const body: TranslateRequest = await request.json();
    const { content, targetLang, model, apiKey, customApiUrl, customModelName } = body;

    if (!content) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    // 检查内容长度
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { 
          error: `文档过长（${content.length} 字符），超过最大限制 ${MAX_CONTENT_LENGTH} 字符。建议分次翻译或简化文档。`,
          contentLength: content.length,
          maxLength: MAX_CONTENT_LENGTH
        }, 
        { status: 400 }
      );
    }

    // 获取有效的 API Key（优先服务端环境变量）
    const effectiveApiKey = getEffectiveApiKey(model, apiKey);
    if (!effectiveApiKey) {
      return NextResponse.json({ 
        error: '请先配置 API Key，或联系管理员配置服务端密钥' 
      }, { status: 400 });
    }

    // 确定 API URL 并校验
    let apiUrl: string;
    if (model === 'custom') {
      const validation = validateCustomApiUrl(customApiUrl || '');
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      apiUrl = customApiUrl!;
    } else {
      apiUrl = API_ENDPOINTS[model];
      if (!apiUrl) {
        return NextResponse.json({ error: '无效的模型配置' }, { status: 400 });
      }
    }

    // 确定实际使用的模型名称
    let actualModelName: string;
    if (model === 'custom') {
      if (!customModelName) {
        return NextResponse.json({ error: '使用自定义 API 时需要指定模型名称' }, { status: 400 });
      }
      actualModelName = customModelName;
    } else {
      actualModelName = MODEL_NAMES[model] || model;
    }

    // 分段翻译处理
    const chunks = splitContentIntoChunks(content);
    
    if (chunks.length > 1) {
      console.log(`Content split into ${chunks.length} chunks for translation`);
    }

    // 顺序翻译所有分段
    const translatedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const translatedChunk = await translateChunk(
        chunks[i],
        targetLang,
        apiUrl,
        effectiveApiKey,
        actualModelName,
        i,
        chunks.length
      );
      translatedChunks.push(translatedChunk);
    }

    // 合并翻译结果
    const translatedContent = translatedChunks.join('\n\n');

    return NextResponse.json({ 
      content: translatedContent,
      chunksUsed: chunks.length
    });
  } catch (error) {
    console.error('Translate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '翻译失败' },
      { status: 500 }
    );
  }
}
