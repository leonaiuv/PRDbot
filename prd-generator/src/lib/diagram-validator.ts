import { z } from 'zod';

/**
 * Mermaid图表校验器
 * 用于校验AI输出的图表JSON结构是否符合预期格式
 */

// 图表类型
export type DiagramType = 'architecture' | 'flowchart' | 'er' | 'sequence' | 'class';

// 单个图表Schema
const DiagramSchema = z.object({
  title: z.string().min(1, '图表标题不能为空'),
  type: z.enum(['architecture', 'flowchart', 'er', 'sequence', 'class'], {
    message: 'type必须是architecture/flowchart/er/sequence/class之一',
  }),
  code: z.string().min(10, 'Mermaid代码不能少于10个字符'),
});

// 图表集合Schema
const DiagramsResponseSchema = z.object({
  diagrams: z.array(DiagramSchema).min(1, '至少需要1个图表').max(5, '最多5个图表'),
});

// 校验结果类型
export interface DiagramValidationResult {
  valid: boolean;
  data?: z.infer<typeof DiagramsResponseSchema>;
  errors?: string[];
  rawContent?: string;
  renderErrors?: { title: string; error: string }[];
}

// 单个图表数据类型
export type ValidatedDiagram = z.infer<typeof DiagramSchema>;
export type ValidatedDiagramsResponse = z.infer<typeof DiagramsResponseSchema>;

/**
 * 从文本中提取JSON内容
 * 支持多种格式：代码块包裹、裸JSON、行内JSON
 */
export function extractDiagramJSON(text: string): { json: string | null; textContent: string } {
  const trimmedText = text.trim();
  
  // 1. 尝试匹配 ```json ... ``` 代码块
  const codeBlockMatch = trimmedText.match(/```\s*(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/i);
  if (codeBlockMatch) {
    const jsonContent = codeBlockMatch[1].trim();
    return { json: jsonContent, textContent: '' };
  }
  
  // 2. 尝试匹配裸JSON对象 { ... }
  const bareJsonMatch = trimmedText.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (bareJsonMatch) {
    return { json: bareJsonMatch[1], textContent: '' };
  }
  
  // 3. 尝试从文本中提取内嵌的JSON对象
  const embeddedMatch = trimmedText.match(/(\{[\s\S]*"diagrams"[\s\S]*\})/);
  if (embeddedMatch) {
    return { json: embeddedMatch[1], textContent: '' };
  }
  
  // 4. 没有找到JSON
  return { json: null, textContent: trimmedText };
}

/**
 * 验证单个Mermaid代码的语法基础有效性
 * 注意: 这是基础校验，完整校验需要在前端用mermaid库
 */
export function validateMermaidSyntax(code: string): { valid: boolean; error?: string } {
  const trimmedCode = code.trim();
  
  // 检查是否为空
  if (!trimmedCode) {
    return { valid: false, error: '代码为空' };
  }
  
  // 检查是否有有效的图表类型声明
  const validTypes = [
    /^graph\s+(TB|BT|LR|RL|TD)/i,
    /^flowchart\s+(TB|BT|LR|RL|TD)/i,
    /^erDiagram/i,
    /^sequenceDiagram/i,
    /^classDiagram/i,
    /^stateDiagram/i,
    /^pie/i,
    /^gantt/i,
  ];
  
  const hasValidType = validTypes.some(pattern => pattern.test(trimmedCode));
  if (!hasValidType) {
    return { valid: false, error: '未找到有效的图表类型声明（如graph TB、erDiagram等）' };
  }
  
  // 检查是否包含禁止的样式定义
  const forbiddenPatterns = [
    /\bstyle\s+\w+\s+/i,
    /\bclassDef\s+/i,
    /\bfill:/i,
    /\bcolor:/i,
    /\bstroke:/i,
  ];
  
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(trimmedCode)) {
      return { valid: false, error: '包含禁止的样式定义（style/classDef/fill等）' };
    }
  }
  
  // 检查是否有节点定义（针对graph/flowchart类型）
  if (/^(graph|flowchart)/i.test(trimmedCode)) {
    // 应该至少有一个节点和一个连接
    const hasNode = /\w+\s*[\[\(\{]/.test(trimmedCode) || /\w+\s*-->/.test(trimmedCode);
    if (!hasNode) {
      return { valid: false, error: '未找到有效的节点定义' };
    }
  }
  
  // 检查erDiagram是否有实体定义
  if (/^erDiagram/i.test(trimmedCode)) {
    const hasEntity = /\w+\s*\|\|/.test(trimmedCode) || /\w+\s*\{/.test(trimmedCode);
    if (!hasEntity) {
      return { valid: false, error: '未找到有效的实体关系定义' };
    }
  }
  
  return { valid: true };
}

/**
 * 校验AI响应的图表JSON结构
 */
export function validateDiagramResponse(text: string): DiagramValidationResult {
  const { json, textContent } = extractDiagramJSON(text);
  
  if (!json) {
    return {
      valid: false,
      errors: ['未能从响应中提取到有效的JSON结构'],
      rawContent: textContent || text,
    };
  }
  
  // 尝试解析JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON解析失败: ${e instanceof Error ? e.message : '未知错误'}`],
      rawContent: textContent || text,
    };
  }
  
  // 使用zod校验结构
  const result = DiagramsResponseSchema.safeParse(parsed);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return {
      valid: false,
      errors,
      rawContent: textContent || text,
    };
  }
  
  // 对每个图表进行语法校验
  const renderErrors: { title: string; error: string }[] = [];
  
  for (const diagram of result.data.diagrams) {
    const syntaxResult = validateMermaidSyntax(diagram.code);
    if (!syntaxResult.valid) {
      renderErrors.push({
        title: diagram.title,
        error: syntaxResult.error || '语法错误',
      });
    }
  }
  
  // 如果有语法错误，返回错误信息
  if (renderErrors.length > 0) {
    return {
      valid: false,
      errors: renderErrors.map(e => `图表"${e.title}": ${e.error}`),
      renderErrors,
      rawContent: textContent || text,
    };
  }
  
  return {
    valid: true,
    data: result.data,
    rawContent: textContent || undefined,
  };
}

/**
 * 构建图表重试提示词
 */
export function buildDiagramRetryPrompt(errors: string[]): string {
  return `你上次的图表输出格式不正确，请严格按以下JSON格式重新输出：

【正确格式示例】
\`\`\`json
{
  "diagrams": [
    {
      "title": "系统架构图",
      "type": "architecture",
      "code": "graph TB\\n    A[\\"用户\\"] --> B[\\"前端\\"]\\n    B --> C[\\"后端\\"]\\n    C --> D[(\\"数据库\\")]"
    },
    {
      "title": "用户流程图",
      "type": "flowchart", 
      "code": "graph LR\\n    Start([\\"开始\\"]) --> Login[\\"登录\\"]\\n    Login --> Dashboard[\\"仪表盘\\"]\\n    Dashboard --> End([\\"结束\\"])"
    }
  ]
}
\`\`\`

【错误原因】
${errors.slice(0, 3).join('\n')}

【关键要求】
1. 只输出JSON，不要任何其他文字
2. code字段中的换行符用\\n表示
3. 节点标签必须用引号包裹，如 A["用户"]
4. 禁止使用style、classDef等样式定义`;
}

/**
 * 将JSON格式的图表数据转换为Markdown格式（兼容旧版渲染器）
 */
export function convertDiagramsToMarkdown(data: ValidatedDiagramsResponse): string {
  return data.diagrams.map(diagram => {
    return `## ${diagram.title}

\`\`\`mermaid
${diagram.code}
\`\`\``;
  }).join('\n\n');
}

/**
 * 尝试从原始内容中提取mermaid代码块（降级处理）
 * 用于AI未按JSON格式输出时的兜底
 */
export function extractMermaidBlocksFromText(text: string): ValidatedDiagram[] {
  const diagrams: ValidatedDiagram[] = [];
  
  // 匹配所有mermaid代码块
  const mermaidRegex = /(?:##\s*\d*\.?\s*)?(.+?)?\n*```mermaid\s*\n([\s\S]*?)\n```/gi;
  let match;
  let index = 0;
  
  while ((match = mermaidRegex.exec(text)) !== null) {
    index++;
    const title = match[1]?.trim() || `图表${index}`;
    const code = match[2]?.trim() || '';
    
    // 根据代码内容推断类型
    let type: DiagramType = 'architecture';
    if (/^erDiagram/i.test(code)) {
      type = 'er';
    } else if (/^sequenceDiagram/i.test(code)) {
      type = 'sequence';
    } else if (/^classDiagram/i.test(code)) {
      type = 'class';
    } else if (/流程|步骤|flow/i.test(title)) {
      type = 'flowchart';
    }
    
    diagrams.push({ title, type, code });
  }
  
  return diagrams;
}
