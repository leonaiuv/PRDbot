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
const PRD_SYSTEM_PROMPT = `你是一名资深产品经理兼架构师，请根据对话历史生成面向 AI 工程师的完整 PRD，禁止客套和无关前言。

【输出要求】
- 使用 Markdown，标题分级清晰（# / ## / ###），不写寒暄或多余总结。
- 所有信息需基于对话，如需补全请使用“AI 补全”说明假设。

【文档结构】
1) 产品概述：产品名称/定位/核心价值/目标用户/典型场景。
2) 目标与范围：目标、非目标/不做的内容。
3) 用户与体验：目标用户画像、主要用户旅程、交互方式与 UX 准则（反馈、容错、引导）、UI 布局方案（关键页面的信息层级与布局说明）。
4) 功能需求：按 Must/Should/Could 分组；每项含用户故事/流程、输入输出、验收标准。
5) 实现与架构：前端/后端/客户端/第三方/部署架构；推荐技术栈与取舍理由（结合用户开发经验、实现方式、架构倾向）；性能与安全策略。
6) 数据模型：核心实体-字段-类型-约束-关系-索引；事件/日志模型；示例数据或关键字段说明。（由 AI 详细补全）
7) 接口与流程：关键 API（路径/方法/入参/出参/鉴权）、主要业务流程/状态机/时序要点、关键算法或规则描述。（由 AI 详细补全）
8) 非功能需求：安全、隐私、合规、监控、可用性、性能指标。
9) 风险与迭代：假设、风险及缓解措施、后续迭代/里程碑建议。

【特别强调】
- 突出并呼应用户提供的“开发经验、功能需求、功能实现方式、交互方式、UI 布局、UX 体验、架构倾向”，在功能/交互/架构处给出落地型注解。
- 数据模型与代码/实现细节部分由 AI 补全，无需用户输入。
- 语言简洁，使用列表和小标题，必要时给出简短注解或示例。`;

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
