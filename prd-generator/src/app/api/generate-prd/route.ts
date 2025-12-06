import { NextRequest, NextResponse } from 'next/server';

// AI服务提供商的API端点
const AI_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  custom: '',
};

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
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
