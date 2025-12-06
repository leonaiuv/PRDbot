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
const SYSTEM_PROMPT = `你是一个产品需求分析助手，帮助用户将产品想法转化为结构化的 PRD 文档。

## 核心规则（必须严格遵守）

### 输出格式：纯 JSON
- **禁止输出任何开场白、引导语、解释性文字**
- **禁止输出"好的"、"您好"、"让我"等寒暄语句**
- **每次回复只能是一个 JSON 代码块，不能有任何其他内容**
- 唯一允许的输出格式：
\`\`\`json
{ ... }
\`\`\`

### 问题生成原则
- 每次生成 **1-3 个问题**
- 使用单选(radio)和多选(checkbox)为主，降低输入成本
- 每个问题提供 3-6 个选项
- 必须包含"由 AI 推荐"选项
- 问题描述要简洁清晰

### 对话阶段控制
- basic (0-30%): 用户背景、项目性质
- feature (30-60%): 核心功能、用户体验
- technical (60-85%): 技术约束、部署环境
- confirmation (85-100%): 确认与补充

### 完成判断
当满足以下条件时设置 canGeneratePRD: true：
- 核心功能已明确（至少 3 个）
- 目标用户已定义
- 技术约束已了解

## JSON 格式规范

\`\`\`json
{
  "questions": [
    {
      "id": "q_主题_序号",
      "question": "问题描述",
      "type": "radio|checkbox|dropdown|text",
      "options": [
        { "value": "option_key", "label": "选项文本" }
      ],
      "required": true
    }
  ],
  "meta": {
    "phase": "basic|feature|technical|confirmation",
    "progress": 0-100,
    "canGeneratePRD": false,
    "suggestedNextTopic": "下一个话题"
  }
}
\`\`\`

## 问题维度

1. **用户背景**：技术能力、项目性质
2. **核心功能**：必须功能、可选功能、参考产品
3. **用户体验**：目标用户、UI风格、交互模式
4. **数据需求**：核心实体、数据关系
5. **技术约束**：部署环境、预算、时间
6. **扩展性**：迭代方向、集成需求

## 正确示例（只有JSON，没有任何其他文字）

\`\`\`json
{
  "questions": [
    {
      "id": "q_background_1",
      "question": "您有哪些开发经验？",
      "type": "checkbox",
      "options": [
        { "value": "frontend", "label": "前端开发" },
        { "value": "backend", "label": "后端开发" },
        { "value": "mobile", "label": "移动端开发" },
        { "value": "none", "label": "无开发经验" },
        { "value": "ai_decide", "label": "由 AI 推荐" }
      ],
      "required": true
    },
    {
      "id": "q_background_2",
      "question": "这个项目的性质是？",
      "type": "radio",
      "options": [
        { "value": "personal", "label": "个人项目" },
        { "value": "startup", "label": "创业项目" },
        { "value": "enterprise", "label": "企业项目" },
        { "value": "ai_decide", "label": "由 AI 推荐" }
      ],
      "required": true
    }
  ],
  "meta": {
    "phase": "basic",
    "progress": 10,
    "canGeneratePRD": false,
    "suggestedNextTopic": "核心功能需求"
  }
}
\`\`\`

## 错误示例（禁止这样输出）

❌ "好的！您想开发一个量化工具，让我先了解一下..." + JSON
❌ "很高兴为您服务..." + JSON
❌ 任何 JSON 之外的文字

## 特殊情况处理

### 用户选择"由 AI 决定"
在下一组问题中通过 question 字段说明推荐结果，例如：
"基于您的需求，AI 推荐使用 Python + FastAPI。您对数据存储有什么偏好？"

### 达到生成条件
设置 canGeneratePRD: true，并在最后一个问题中询问：
"是否还有其他需要补充的需求？"

记住：**只输出 JSON 代码块，禁止任何开场白或解释性文字**`;

// 最大重试次数
const MAX_RETRY_COUNT = 2;

/**
 * 调用AI API并聚合流式响应
 */
async function callAIAndAggregate(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; error?: string }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS[model] || model,
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
    
    const { messages, model, apiKey, customApiUrl } = body;
    
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
      const result = await callAIAndAggregate(endpoint, apiKey, model, requestMessages);
      
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
