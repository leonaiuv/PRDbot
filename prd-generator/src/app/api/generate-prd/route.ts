import { NextRequest, NextResponse } from 'next/server';

// AI服务提供商的API端点
const AI_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  custom: '',
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

// 默认模型名称
const DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  doubao: 'doubao-pro-4k',
};

// PRD生成系统提示词
const PRD_SYSTEM_PROMPT = `你是一个专业的产品经理，请根据以下对话历史，生成一份完整的 PRD 文档。

**PRD 结构要求：**
1. 产品概述（产品名称、定位、核心价值、目标用户）
2. 功能需求（核心功能列表，按优先级排序，每个功能详细说明）
3. UI/UX 设计（页面结构、布局风格、交互流程、参考设计）
4. 技术架构建议（前端、后端、数据库、第三方服务，每个建议说明理由）
5. 数据模型（核心数据实体、字段定义、关系说明）
6. 技术实现要点（关键技术难点、推荐方案、注意事项）
7. 竞品分析（如果有，包含功能对比、技术栈对比、优缺点）
8. 优化建议（自动生成的优化建议、潜在风险、后续迭代方向）

**注意：**
- 文档面向 AI 工程师，不需要时间规划和人力安排
- 技术建议要具体，说明为什么选择这个技术栈
- 数据模型要清晰，包含字段类型和关系
- 使用 Markdown 格式输出`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationHistory, model, apiKey, customApiUrl } = body;

    console.log('[generate-prd] Request received:', { model, hasApiKey: !!apiKey, hasConversation: !!conversationHistory });

    if (!apiKey) {
      return NextResponse.json(
        { error: '请先配置 API Key' },
        { status: 400 }
      );
    }

    if (!conversationHistory) {
      return NextResponse.json(
        { error: '缺少对话历史数据' },
        { status: 400 }
      );
    }

    // 确定API端点
    let endpoint: string;
    if (model === 'custom') {
      const validation = validateCustomApiUrl(customApiUrl);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      endpoint = customApiUrl;
    } else {
      endpoint = AI_ENDPOINTS[model];
      if (!endpoint) {
        return NextResponse.json(
          { error: '无效的模型配置' },
          { status: 400 }
        );
      }
    }

    // 构建请求消息
    const requestMessages = [
      { role: 'system', content: PRD_SYSTEM_PROMPT },
      { role: 'user', content: `以下是用户的对话历史：

${conversationHistory}

请根据以上信息生成完整的 PRD 文档。` }
    ];

    // 调用AI API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODELS[model] || model,
        messages: requestMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error:', errorText);
      return NextResponse.json(
        { error: `AI 服务调用失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 返回流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generate PRD API Error:', error);
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: `PRD生成失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}
