import { NextResponse } from 'next/server';
import { getModelConfig } from '@/lib/model-config';
import { handleAIAPIError, type ErrorResponse } from '@/lib/error-mapper';
import {
  validateDiagramResponse,
  buildDiagramRetryPrompt,
  convertDiagramsToMarkdown,
  extractMermaidBlocksFromText,
  type ValidatedDiagramsResponse,
} from '@/lib/diagram-validator';

// AI分析类型
type AnalysisType = 'optimize' | 'score' | 'competitor' | 'diagram';

interface AnalyzeRequest {
  type: AnalysisType;
  prdContent: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
  customModelName?: string;
}

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
  qwen: 'qwen-turbo',  // 统一使用基础版
  doubao: 'doubao-pro-4k',  // 统一使用基础版
};

// 分析提示词
const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  optimize: `你是一位资深产品经理，请对以下PRD文档进行专业分析和优化建议。

请从以下维度进行分析：
1. **功能完整性**：是否覆盖了核心功能？有无遗漏的重要场景？
2. **需求清晰度**：需求描述是否足够清晰？开发人员能否直接实现？
3. **用户体验**：用户流程是否顺畅？有无体验优化空间？
4. **技术可行性**：技术方案是否合理？有无潜在的技术风险？
5. **数据模型**：数据结构设计是否完善？字段定义是否完整？
6. **安全隐私**：是否考虑了安全和隐私保护？
7. **扩展性**：架构设计是否支持未来扩展？

请给出具体、可执行的优化建议，格式如下：
## 分析摘要
[一段话总结PRD的整体质量]

## 优势亮点
- [列出做得好的地方]

## 改进建议
### 高优先级
1. [问题描述]：[具体建议]

### 中优先级
1. [问题描述]：[具体建议]

### 低优先级
1. [问题描述]：[具体建议]

## 补充建议
[其他有价值的建议]`,

  score: `你是一位PRD质量评审专家。请对以下PRD文档进行评分。

评分维度（每项满分20分，共100分）：
1. **完整性（20分）**：需求描述是否完整，功能点是否覆盖全面
2. **清晰度（20分）**：表述是否清晰，无歧义，易于理解
3. **可执行性（20分）**：需求是否具体到开发可直接实现
4. **逻辑性（20分）**：需求之间逻辑是否自洽，无矛盾
5. **专业性（20分）**：PRD结构是否规范，格式是否专业

请按以下格式输出：
## 总分：[分数]/100

## 评分明细
| 维度 | 得分 | 说明 |
|------|------|------|
| 完整性 | [分数]/20 | [简短说明] |
| 清晰度 | [分数]/20 | [简短说明] |
| 可执行性 | [分数]/20 | [简短说明] |
| 逻辑性 | [分数]/20 | [简短说明] |
| 专业性 | [分数]/20 | [简短说明] |

## 评价等级
[根据总分给出等级：A+(90-100)/A(80-89)/B+(70-79)/B(60-69)/C(60以下)]

## 主要问题
[列出扣分的主要原因]

## 改进方向
[给出提升评分的建议]`,

  competitor: `你是一位市场分析专家。请根据以下PRD描述的产品，分析其潜在竞争对手。

请提供：
1. **竞品列表**：列出3-5个最相关的竞争产品
2. **对比分析**：分析各竞品的优缺点
3. **差异化建议**：提出本产品可以差异化的方向

输出格式：
## 竞品识别
基于PRD描述，本产品属于 [产品类型] 领域。

## 主要竞品

### 1. [竞品名称]
- **简介**：[一句话介绍]
- **核心功能**：[主要功能列表]
- **优势**：[竞品优势]
- **劣势**：[竞品劣势]
- **可借鉴**：[值得学习的地方]

### 2. [竞品名称]
...

## 竞品对比表
| 功能/特性 | 本产品 | 竞品1 | 竞品2 | 竞品3 |
|-----------|--------|-------|-------|-------|
| [功能1] | [计划] | [有/无] | [有/无] | [有/无] |
...

## 差异化建议
1. [建议1]
2. [建议2]
3. [建议3]`,

  diagram: `你是一位系统架构师。请根据以下PRD内容生成Mermaid格式的图表。

【重要约束】
1. 仅输出有效的Mermaid代码块，禁止任何多余文字
2. 每个图表必须包含在 \`\`\`mermaid 和 \`\`\` 之间
3. 禁止使用任何样式定义（style、classDef、fill、color等）
4. 节点ID只能使用字母、数字和下划线，禁止使用特殊符号
5. 节点标签必须用方括号["标签"]或圆角括号("标签")包裹
6. 文字内容使用中文

【输出格式】严格按以下JSON格式输出：
\`\`\`json
{
  "diagrams": [
    {
      "title": "系统架构图",
      "type": "architecture",
      "code": "graph TB\\n    A[\"前端应用\"] --> B[\"API网关\"]\\n    B --> C[\"业务服务\"]\\n    C --> D[(\"数据库\")]"
    },
    {
      "title": "用户流程图", 
      "type": "flowchart",
      "code": "graph LR\\n    Start([\"开始\"]) --> Step1[\"步骤1\"]\\n    Step1 --> Step2[\"步骤2\"]\\n    Step2 --> End([\"结束\"])"
    },
    {
      "title": "数据模型ER图",
      "type": "er",
      "code": "erDiagram\\n    USER ||--o{ ORDER : places\\n    ORDER ||--|{ ITEM : contains"
    }
  ]
}
\`\`\`

【图表类型说明】
- architecture: 系统架构图，使用 graph TB/LR，展示系统组件关系
- flowchart: 用户流程图，使用 graph LR/TD，展示操作步骤
- er: 数据模型图，使用 erDiagram，展示实体关系

【Mermaid语法规范】
- graph节点: A["文字"]（方形）、B("文字")（圆角）、C(["文字"])（体育场形）、D{"文字"}（菱形）、E[("文字")]（圆柱）
- 连接符: --> 或 --- 或 -.-> 或 ==>
- erDiagram关系: ||--o{ 一对多、||--|| 一对一、}|--|{ 多对多`,
};

// 最大重试次数
const MAX_RETRY_COUNT = 2;

/**
 * 调用AI API获取响应
 */
async function callAIAPI(
  apiUrl: string,
  apiKey: string,
  modelName: string,
  messages: { role: string; content: string }[]
): Promise<{ content: string; error?: string; errorResponse?: ErrorResponse; status?: number }> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const { errorResponse, status } = await handleAIAPIError('analyze', response);
    return { content: '', error: errorResponse.error, errorResponse, status };
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || '' };
}

/**
 * 处理图表生成请求，包含校验和重试逻辑
 */
async function handleDiagramGeneration(
  apiUrl: string,
  apiKey: string,
  modelName: string,
  prompt: string,
  prdContent: string
): Promise<{ content: string; retryCount: number; diagramsData?: ValidatedDiagramsResponse }> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: `以下是需要分析的PRD文档：\n\n${prdContent}` },
  ];

  let retryCount = 0;
  let lastContent = '';
  let lastErrors: string[] = [];

  while (retryCount <= MAX_RETRY_COUNT) {
    console.log(`[图表生成] 尝试第 ${retryCount + 1} 次请求...`);

    const result = await callAIAPI(apiUrl, apiKey, modelName, messages);
    
    if (result.error) {
      throw new Error(result.error);
    }

    lastContent = result.content;

    // 校验图表响应
    const validation = validateDiagramResponse(result.content);

    if (validation.valid && validation.data) {
      console.log(`[图表生成] 校验通过，共生成 ${validation.data.diagrams.length} 个图表`);
      // 转换为Markdown格式返回
      const markdownContent = convertDiagramsToMarkdown(validation.data);
      return { content: markdownContent, retryCount, diagramsData: validation.data };
    }

    // 校验失败，记录错误
    lastErrors = validation.errors || ['未知校验错误'];
    console.warn(`[图表生成] 校验失败 (${retryCount + 1}/${MAX_RETRY_COUNT + 1}):`, lastErrors);

    // 如果还可以重试，构建重试提示词
    if (retryCount < MAX_RETRY_COUNT) {
      const retryPrompt = buildDiagramRetryPrompt(lastErrors);
      messages.push(
        { role: 'assistant', content: result.content },
        { role: 'user', content: retryPrompt }
      );
      retryCount++;
    } else {
      break;
    }
  }

  // 所有重试均失败，尝试从原始内容提取mermaid代码块（降级处理）
  console.warn(`[图表生成] 所有重试均失败，尝试降级提取...`);
  const fallbackDiagrams = extractMermaidBlocksFromText(lastContent);
  
  if (fallbackDiagrams.length > 0) {
    console.log(`[图表生成] 降级提取成功，共提取 ${fallbackDiagrams.length} 个图表`);
    const fallbackData: ValidatedDiagramsResponse = { diagrams: fallbackDiagrams };
    const markdownContent = convertDiagramsToMarkdown(fallbackData);
    return { content: markdownContent, retryCount, diagramsData: fallbackData };
  }

  // 完全失败，返回原始内容和错误信息
  console.error(`[图表生成] 完全失败，返回原始内容`);
  return { content: lastContent, retryCount };
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { type, prdContent, model, apiKey, customApiUrl, customModelName } = body;

    if (!prdContent) {
      return NextResponse.json({ error: 'PRD内容不能为空' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
    }

    const prompt = ANALYSIS_PROMPTS[type];
    if (!prompt) {
      return NextResponse.json({ error: '无效的分析类型' }, { status: 400 });
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
      const config = getModelConfig(model);
      if (!config) {
        return NextResponse.json({ error: '无效的模型配置' }, { status: 400 });
      }
      apiUrl = config.endpoint;
    }

    // 确定实际使用的模型名称
    let actualModelName: string;
    if (model === 'custom') {
      if (!customModelName) {
        return NextResponse.json({ error: '使用自定义 API 时需要指定模型名称' }, { status: 400 });
      }
      actualModelName = customModelName;
    } else {
      const config = getModelConfig(model);
      actualModelName = config?.defaultModel || MODEL_NAMES[model] || model;
    }

    // 图表生成使用特殊处理逻辑（包含校验和重试）
    if (type === 'diagram') {
      const result = await handleDiagramGeneration(
        apiUrl,
        apiKey,
        actualModelName,
        prompt,
        prdContent
      );

      return NextResponse.json({
        content: result.content,
        retryCount: result.retryCount,
        diagramsData: result.diagramsData,
      });
    }

    // 其他分析类型使用普通处理逻辑
    const result = await callAIAPI(
      apiUrl,
      apiKey,
      actualModelName,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: `以下是需要分析的PRD文档：\n\n${prdContent}` },
      ]
    );

    if (result.error) {
      return NextResponse.json(
        result.errorResponse || { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ content: result.content });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    );
  }
}
