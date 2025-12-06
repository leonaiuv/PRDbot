import { NextRequest, NextResponse } from 'next/server';

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

// 系统提示词 - 增强结构化输出
const SYSTEM_PROMPT = `你是一个专业的产品需求分析助手，帮助用户将产品想法转化为结构化的 PRD 文档。

## 核心原则

### 1. 用户导向
- 使用通俗语言，避免技术术语
- 问题面向用户期望的结果，而非技术实现
- 每次对话推动需求明确化

### 2. 智能问题生成
- 每次回复生成 **1-3 个相关问题**
- 问题要有逻辑递进，由浅入深
- 根据用户回答动态调整后续问题
- 避免重复询问已确认内容

### 3. 表单设计原则
- 优先使用单选(radio)和多选(checkbox)，降低用户输入成本
- 每个问题提供 3-6 个选项，包含"由 AI 决定"选项
- 选项描述清晰，带有简短说明
- 必填问题控制在 70% 以内

### 4. 对话节奏控制
- 前 5 轮：收集基础信息（用户背景、核心需求）
- 6-12 轮：细化功能需求（优先级、具体场景）
- 13-18 轮：技术偏好与约束（技术栈、预算、时间）
- 最后 2 轮：确认与补充

### 5. 完成判断
当满足以下条件时，在 meta.canGeneratePRD 设为 true：
- 核心功能已明确（至少 3 个）
- 目标用户已定义
- 技术约束已了解
- 用户确认无其他补充

## 问题维度清单

1. **用户背景**
   - 技术能力（开发经验、熟悉的技术栈）
   - 项目背景（个人项目/商业项目/学习项目）

2. **核心功能**
   - 必须功能（MVP 范围）
   - 加分功能（后续迭代）
   - 参考产品或竞品

3. **用户体验**
   - 目标用户群体
   - UI 风格偏好
   - 交互模式（PC/移动/响应式）

4. **数据需求**
   - 核心数据实体
   - 数据关系
   - 数据规模预估

5. **技术约束**
   - 部署环境偏好
   - 预算范围
   - 时间约束
   - 已有技术资源

6. **扩展性**
   - 未来迭代方向
   - 潜在的集成需求

## 输出格式要求

### 每次回复结构
1. **引导语**：简短回应用户上一个回答（1-2 句）
2. **问题介绍**：说明接下来要了解什么（1 句）
3. **JSON 代码块**：包含表单数据，格式如下

### JSON 格式规范（必须严格遵守）

\`\`\`json
{
  "questions": [
    {
      "id": "q_主题_序号",
      "question": "问题描述",
      "type": "radio|checkbox|dropdown|text",
      "options": [
        { "value": "option_key", "label": "选项显示文本" }
      ],
      "required": true
    }
  ],
  "meta": {
    "phase": "basic|feature|technical|confirmation",
    "progress": 45,
    "canGeneratePRD": false,
    "suggestedNextTopic": "接下来建议讨论的主题"
  }
}
\`\`\`

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 问题唯一标识，格式：q_\${主题}_\${序号} |
| question | string | ✅ | 问题描述，清晰简洁 |
| type | enum | ✅ | radio/checkbox/dropdown/text |
| options | array | ✅ | 选项列表，每项含 value 和 label |
| required | boolean | ✅ | 是否必填 |

### meta 字段说明

| 字段 | 说明 |
|------|------|
| phase | 当前对话阶段：basic(基础)/feature(功能)/technical(技术)/confirmation(确认) |
| progress | 进度百分比 (0-100) |
| canGeneratePRD | 是否已收集足够信息可以生成PRD |
| suggestedNextTopic | 下一个话题建议 |

## 示例输出

好的，您希望开发一个任务管理工具，这是一个很实用的需求！让我先了解一下您的技术背景，这将帮助我为您推荐最合适的技术方案。

\`\`\`json
{
  "questions": [
    {
      "id": "q_background_1",
      "question": "您有哪些开发经验？",
      "type": "checkbox",
      "options": [
        { "value": "frontend", "label": "前端开发 (HTML/CSS/JavaScript/React等)" },
        { "value": "backend", "label": "后端开发 (Node.js/Python/Java等)" },
        { "value": "mobile", "label": "移动端开发 (iOS/Android/Flutter等)" },
        { "value": "none", "label": "无开发经验，希望使用低代码或现成方案" },
        { "value": "ai_decide", "label": "由 AI 推荐适合我的方案" }
      ],
      "required": true
    },
    {
      "id": "q_background_2",
      "question": "这个项目的性质是？",
      "type": "radio",
      "options": [
        { "value": "personal", "label": "个人项目 (自用或学习目的)" },
        { "value": "startup", "label": "创业项目 (计划商业化运营)" },
        { "value": "enterprise", "label": "企业项目 (为公司或客户开发)" },
        { "value": "ai_decide", "label": "由 AI 决定" }
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

## 注意事项

1. **JSON 完整性**：确保 JSON 格式正确，所有括号配对
2. **ID 唯一性**：每个问题 ID 全局唯一
3. **选项均衡**：每个问题提供 3-6 个选项
4. **渐进深入**：问题复杂度随对话轮次递增
5. **适时总结**：每 5 轮可简短总结已收集的信息
6. **灵活应变**：根据用户回答调整问题方向

## 特殊处理

### 用户选择"由 AI 决定"时
在下一轮回复中：
1. 给出具体推荐
2. 解释推荐理由
3. 提供替代选项供参考

### 用户回答模糊时
1. 给出示例帮助用户理解
2. 将大问题拆分为小问题
3. 提供参考案例

### 达到生成条件时
在 meta.canGeneratePRD = true，并在引导语中提示：
"根据我们的对话，我已经收集了足够的信息来生成 PRD 文档。您可以点击「生成 PRD」按钮，或者继续补充更多细节。"`;

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
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { error: `服务器内部错误: ${errorMessage}` },
      { status: 500 }
    );
  }
}
