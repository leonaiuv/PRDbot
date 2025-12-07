import { NextResponse } from 'next/server';

interface TranslateRequest {
  content: string;
  targetLang: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
}

// API 端点配置
const API_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
};

const MODEL_NAMES: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  doubao: 'doubao-pro-32k',
};

export async function POST(request: Request) {
  try {
    const body: TranslateRequest = await request.json();
    const { content, targetLang, model, apiKey, customApiUrl } = body;

    if (!content) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
    }

    const apiUrl = customApiUrl || API_ENDPOINTS[model];
    const modelName = MODEL_NAMES[model] || model;

    if (!apiUrl) {
      return NextResponse.json({ error: '无效的模型配置' }, { status: 400 });
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
        model: modelName,
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
