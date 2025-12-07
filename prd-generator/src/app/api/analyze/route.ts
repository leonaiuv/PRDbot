import { NextResponse } from 'next/server';

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

请生成以下图表（使用Mermaid语法）：

## 1. 系统架构图
\`\`\`mermaid
graph TB
    [描述系统的主要组件和它们之间的关系]
\`\`\`

## 2. 用户流程图
\`\`\`mermaid
graph LR
    [描述用户的主要操作流程]
\`\`\`

## 3. 数据模型ER图
\`\`\`mermaid
erDiagram
    [描述主要的数据实体和关系]
\`\`\`

注意：
- 保持图表简洁清晰
- 使用中文标签
- 不要使用样式定义（no style, no classDef）
- 节点名称用方括号包裹`,
};

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
          { role: 'user', content: `以下是需要分析的PRD文档：\n\n${prdContent}` },
        ],
        temperature: 0.7,
        max_tokens: 4000,
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
    const content = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    );
  }
}
