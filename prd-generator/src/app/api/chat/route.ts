import { NextRequest, NextResponse } from 'next/server';

// AI服务提供商的API端点
const AI_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  custom: '', // 自定义URL由请求提供
};

// 默认模型名称
const DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  doubao: 'doubao-pro-4k',
};

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的产品需求分析助手，你的任务是通过多轮对话，帮助用户将模糊的产品想法转化为结构化的 PRD 文档。

**核心原则：**
1. 你的问题应该面向用户期望的结果，而不是技术细节。用户可能不懂技术架构，所以要用通俗的语言。
2. 每次提问时，生成 1-3 个相关问题，并提供选择器（单选/多选/下拉/输入框）。
3. 根据用户的回答，动态调整后续问题，避免重复询问已确认的内容。
4. 当用户选择 "由 AI 决定" 时，你需要给出最佳建议和理由。
5. 最多 20 轮对话，或者当你判断信息足够完整时，提示用户生成 PRD。
6. 生成的 PRD 文档要面向 AI 工程师，包含技术实现建议，但不需要时间规划。

**问题维度：**
- 用户背景（技术能力、开发经验）
- 核心功能（必须有哪些功能）
- 用户体验（UI 风格、交互方式、参考案例）
- 数据结构（需要存储哪些数据）
- 技术建议（前端、后端、数据库、云服务等）
- 扩展性（未来可能的迭代方向）

**输出格式：**
每次回复必须包含 JSON 格式的选择器数据，放在代码块中，例如：
\`\`\`json
{
  "questions": [
    {
      "id": "q1",
      "question": "你是否有后端开发经验？",
      "type": "radio",
      "options": [
        { "value": "experienced", "label": "有，我熟悉后端开发" },
        { "value": "basic", "label": "了解基础，但需要指导" },
        { "value": "none", "label": "没有，希望使用无需后端的方案" },
        { "value": "ai_decide", "label": "由 AI 决定" }
      ],
      "required": true
    }
  ]
}
\`\`\`

type 可选值：radio（单选）、checkbox（多选）、dropdown（下拉）、text（文本输入）`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, apiKey, customApiUrl } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: '请先配置 API Key' },
        { status: 400 }
      );
    }

    // 确定API端点
    const endpoint = model === 'custom' ? customApiUrl : AI_ENDPOINTS[model];
    if (!endpoint) {
      return NextResponse.json(
        { error: '无效的模型配置' },
        { status: 400 }
      );
    }

    // 构建请求消息
    const requestMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
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
        max_tokens: 2000,
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
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
