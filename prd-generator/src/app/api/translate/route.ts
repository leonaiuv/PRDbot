import { NextResponse } from 'next/server';

interface TranslateRequest {
  content: string;
  targetLang: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
  customModelName?: string;
}

// API 端点配置
const API_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
};

// 允许的自定义 API 域名白名单
const ALLOWED_CUSTOM_DOMAINS = [
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

  // 检查白名单
  const isAllowed = ALLOWED_CUSTOM_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return { 
      valid: false, 
      error: `不在允许的 API 域名白名单中。允许的域名: ${ALLOWED_CUSTOM_DOMAINS.join(', ')}` 
    };
  }

  return { valid: true };
}

const MODEL_NAMES: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  doubao: 'doubao-pro-32k',
};

export async function POST(request: Request) {
  try {
    const body: TranslateRequest = await request.json();
    const { content, targetLang, model, apiKey, customApiUrl, customModelName } = body;

    if (!content) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
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

    const prompt = `你是一位专业的技术文档翻译专家。请将以下PRD文档翻译成${targetLang}。

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
        model: actualModelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      return NextResponse.json(
        { error: `API请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedContent = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ content: translatedContent });
  } catch (error) {
    console.error('Translate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '翻译失败' },
      { status: 500 }
    );
  }
}
