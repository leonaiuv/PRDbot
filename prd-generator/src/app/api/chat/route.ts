import { NextRequest, NextResponse } from 'next/server';
import { validateAIResponse, buildRetryPrompt, aggregateSSEStream } from '@/lib/validator';

// AI服务提供商的API端点
const AI_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  custom: '', // 自定义URL由请求提供
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

// 系统提示词 - 纯JSON输出模式，禁止任何开场白
const SYSTEM_PROMPT = `你是一名产品需求探索助手，负责把零散想法整理为可生成 PRD 的结构化 JSON。

【核心规则 - 必须严格遵守】
1. 禁止重复提问：仔细阅读对话历史，用户已回答过的问题绝对不能再次询问。
2. 基于已答内容推进：根据用户已提供的信息，提出新的、不同维度的问题。
3. 逐步深入：从基础信息→功能需求→技术实现→收尾确认，有序推进。

【输出格式】
- 仅输出一个 JSON 代码块，禁止任何开场白/致谢/解释文字。
- 使用 \`\`\`json 包裹；不能出现 JSON 之外的字符。
- 每个问题必须提供 3-6 个选项，且至少包含 1 个 value 为 "ai_decide" 的 AI 推荐选项。
- type 仅允许 radio / checkbox / dropdown / text；text 题目也需给出 2-4 个推荐填空提示选项。

【提问重点（按顺序探索，已问过的跳过）】
- 用户开发经验：熟悉的技术栈/框架、团队规模、交付节奏。
- 功能需求：核心功能与可选功能、优先级、成功标准。
- 功能实现方式：预期技术路线、集成方式、在线/离线/混合取舍。
- 交互方式：关键用户行为、自动化 vs 手动、流程深浅度。
- UI 布局：信息层级、导航/卡片/列表/仪表盘等布局偏好。
- UX 体验：反馈节奏、容错与引导、负担/效率取舍。
- 架构倾向：单体或微服务、前后端分层方式、第三方依赖；选项需附一句注解说明取舍理由。
- 不要向用户询问数据模型、字段、接口或代码实现；这些将在 PRD 阶段由 AI 自动补全。

【生成规则】
- 每轮生成 1-3 个新问题，描述简洁、避免双重否定。
- 优先使用 radio/checkbox/dropdown；文本题仅用于收集少量开放信息。
- 选项文案务必具体可执行（避免“提升效率”这类空泛描述），尽量 <30 字。
- meta.phase 按进度推进：basic(0-30%) 关注背景/目标；feature(30-60%) 关注功能/交互；technical(60-85%) 关注实现方式/架构倾向；confirmation(85-100%) 收尾确认。
- progress 根据完成度单调递增，每轮回答后应增加 5-15%。
- 当核心功能≥3、目标用户明确、技术/实现路径已有倾向时，设置 canGeneratePRD: true，并加入一个收尾确认问题（可用 radio/checkbox 形式的“还有补充吗”）。

【JSON 结构】
\`\`\`json
{
  "questions": [
    {
      "id": "q_topic_1",
      "question": "问题描述",
      "type": "radio|checkbox|dropdown|text",
      "options": [
        { "value": "opt_key", "label": "选项文本/填空提示" },
        { "value": "ai_decide", "label": "由 AI 推荐（含简短说明）" }
      ],
      "required": true
    }
  ],
  "meta": {
    "phase": "basic|feature|technical|confirmation",
    "progress": 0-100,
    "canGeneratePRD": false,
    "suggestedNextTopic": "下一步要探讨的主题"
  }
}
\`\`\`

记住：严格按上述 JSON 输出，禁止任何额外文字，禁止重复已问过的问题。`;

// 最大重试次数
const MAX_RETRY_COUNT = 2;

/**
 * 调用AI API并聚合流式响应
 */
async function callAIAndAggregate(
  endpoint: string,
  apiKey: string,
  modelName: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; error?: string }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API Error:', errorText);
    return { content: '', error: `AI 服务调用失败: ${response.status}` };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { content: '', error: '无法读取响应' };
  }

  const content = await aggregateSSEStream(reader);
  return { content };
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 }
      );
    }
    
    const { messages, model, apiKey, customApiUrl, customModelName } = body;
    
    console.log('Chat API Request:', { model, hasApiKey: !!apiKey, messagesCount: messages?.length });

    if (!apiKey) {
      return NextResponse.json(
        { error: '请先配置 API Key' },
        { status: 400 }
      );
    }
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '消息格式错误' },
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

    // 确定实际使用的模型名称
    let actualModelName: string;
    if (model === 'custom') {
      if (!customModelName) {
        return NextResponse.json(
          { error: '使用自定义 API 时需要指定模型名称' },
          { status: 400 }
        );
      }
      actualModelName = customModelName;
    } else {
      actualModelName = DEFAULT_MODELS[model] || model;
    }

    // 构建请求消息
    let requestMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    let retryCount = 0;
    let lastContent = '';
    let lastErrors: string[] = [];

    // 循环调用，支持校验失败后自动重试
    while (retryCount <= MAX_RETRY_COUNT) {
      // 调用AI API并聚合流式响应
      const result = await callAIAndAggregate(endpoint, apiKey, actualModelName, requestMessages);
      
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      lastContent = result.content;

      // 校验AI响应
      const validationResult = validateAIResponse(lastContent);

      if (validationResult.valid && validationResult.data) {
        // 校验通过，返回结构化的数据
        console.log(`Chat API: Validation passed${retryCount > 0 ? ` after ${retryCount} retries` : ''}`);
        
        // 返回校验后的结构化响应
        const encoder = new TextEncoder();
        const validatedResponse = {
          validated: true,
          data: validationResult.data,
          textContent: validationResult.rawContent || '',
          retryCount,
        };
        
        const stream = new ReadableStream({
          start(controller) {
            // 发送完整的校验后数据
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(validatedResponse)}\n\n`)
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // 校验失败
      lastErrors = validationResult.errors || ['未知校验错误'];
      console.warn(`Chat API: Validation failed (attempt ${retryCount + 1}/${MAX_RETRY_COUNT + 1}):`, lastErrors);

      if (retryCount >= MAX_RETRY_COUNT) {
        // 达到最大重试次数，返回原始内容和错误信息
        break;
      }

      // 构建重试提示词并添加到消息历史
      const retryPrompt = buildRetryPrompt(lastErrors);
      requestMessages = [
        ...requestMessages,
        { role: 'assistant', content: lastContent },
        { role: 'user', content: retryPrompt }
      ];

      retryCount++;
    }

    // 所有重试都失败，返回原始内容和校验失败信息
    console.error('Chat API: All retries failed, returning raw content with validation errors');
    
    const encoder = new TextEncoder();
    const fallbackResponse = {
      validated: false,
      rawContent: lastContent,
      validationErrors: lastErrors,
      retryCount,
    };
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(fallbackResponse)}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
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
    console.error('Chat API Error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { error: `服务器内部错误: ${errorMessage}` },
      { status: 500 }
    );
  }
}
