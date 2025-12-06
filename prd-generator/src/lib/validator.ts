import { z } from 'zod';

/**
 * AI响应校验器
 * 用于校验AI输出的JSON结构是否符合预期格式
 */

// 选项Schema
const OptionSchema = z.object({
  value: z.string().min(1, '选项value不能为空'),
  label: z.string().min(1, '选项label不能为空'),
});

// 问题Schema
const QuestionSchema = z.object({
  id: z.string().min(1, '问题id不能为空'),
  question: z.string().min(1, '问题描述不能为空'),
  type: z.enum(['radio', 'checkbox', 'dropdown', 'text'], {
    message: 'type必须是radio/checkbox/dropdown/text之一',
  }),
  options: z.array(OptionSchema).min(2, '至少需要2个选项').max(8, '最多8个选项'),
  required: z.boolean().optional().default(true),
});

// 元信息Schema
const MetaSchema = z.object({
  phase: z.enum(['basic', 'feature', 'technical', 'confirmation'], {
    message: 'phase必须是basic/feature/technical/confirmation之一',
  }),
  progress: z.number().min(0).max(100),
  canGeneratePRD: z.boolean(),
  suggestedNextTopic: z.string().optional(),
});

// 完整AI响应Schema
const AIResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(1, '至少需要1个问题').max(5, '最多5个问题'),
  meta: MetaSchema,
});

// 校验结果类型
export type ValidationResult = {
  valid: boolean;
  data?: z.infer<typeof AIResponseSchema>;
  errors?: string[];
  rawContent?: string;
};

// 问题数据类型
export type ValidatedQuestion = z.infer<typeof QuestionSchema>;
export type ValidatedMeta = z.infer<typeof MetaSchema>;
export type ValidatedAIResponse = z.infer<typeof AIResponseSchema>;

/**
 * 从文本中提取JSON内容
 * 支持多种格式：代码块包裹、裸JSON、行内JSON
 */
export function extractJSON(text: string): { json: string | null; textContent: string } {
  const trimmedText = text.trim();
  
  // 1. 尝试匹配 ```json ... ``` 代码块（宽松匹配）
  const codeBlockMatch = trimmedText.match(/```\s*(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/i);
  if (codeBlockMatch) {
    const jsonContent = codeBlockMatch[1].trim();
    const textContent = trimmedText.replace(/```\s*(?:json)?\s*\r?\n?[\s\S]*?\r?\n?```/i, '').trim();
    return { json: jsonContent, textContent };
  }
  
  // 2. 尝试匹配裸JSON对象 { ... }
  const bareJsonMatch = trimmedText.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (bareJsonMatch) {
    return { json: bareJsonMatch[1], textContent: '' };
  }
  
  // 3. 尝试从文本中提取内嵌的JSON对象（文本前后可能有其他内容）
  const embeddedMatch = trimmedText.match(/(\{[\s\S]*"questions"[\s\S]*"meta"[\s\S]*\})/);
  if (embeddedMatch) {
    // 找到JSON的起始和结束位置
    const jsonStr = embeddedMatch[1];
    const startIdx = trimmedText.indexOf(jsonStr);
    const beforeText = trimmedText.substring(0, startIdx).trim();
    const afterText = trimmedText.substring(startIdx + jsonStr.length).trim();
    const textContent = [beforeText, afterText].filter(Boolean).join(' ');
    return { json: jsonStr, textContent };
  }
  
  // 4. 没有找到JSON
  return { json: null, textContent: trimmedText };
}

/**
 * 校验AI响应的JSON结构
 */
export function validateAIResponse(text: string): ValidationResult {
  const { json, textContent } = extractJSON(text);
  
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
  const result = AIResponseSchema.safeParse(parsed);
  
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
  
  // 额外校验：检查是否包含ai_decide选项（至少部分问题应该有）
  const hasAIDecideOption = result.data.questions.some(q => 
    q.options.some(opt => opt.value === 'ai_decide' || opt.label.includes('AI'))
  );
  
  if (!hasAIDecideOption) {
    // 这是一个警告，不阻止通过，但记录下来
    console.warn('校验警告: 建议至少一个问题包含"由AI推荐"选项');
  }
  
  return {
    valid: true,
    data: result.data,
    rawContent: textContent || undefined,
  };
}

/**
 * 检查问题完整性
 * 返回详细的完整性报告
 */
export function checkCompleteness(data: ValidatedAIResponse): {
  complete: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // 检查问题数量
  if (data.questions.length === 0) {
    warnings.push('没有问题');
  }
  
  // 检查每个问题的选项数量
  data.questions.forEach((q, idx) => {
    if (q.options.length < 3) {
      warnings.push(`问题${idx + 1}的选项少于3个`);
    }
    if (q.options.length > 6) {
      warnings.push(`问题${idx + 1}的选项多于6个`);
    }
  });
  
  // 检查meta信息
  if (data.meta.progress < 0 || data.meta.progress > 100) {
    warnings.push('进度值超出有效范围');
  }
  
  return {
    complete: warnings.length === 0,
    warnings,
  };
}

/**
 * 构建重试提示词
 * 用于当校验失败时，生成压缩的重试提示
 */
export function buildRetryPrompt(errors: string[]): string {
  return `你上次的回复格式不正确，请严格按以下JSON格式重新输出（禁止任何其他文字）：
\`\`\`json
{
  "questions": [
    {
      "id": "q_xxx_1",
      "question": "问题描述",
      "type": "radio",
      "options": [
        { "value": "opt1", "label": "选项1" },
        { "value": "ai_decide", "label": "由AI推荐" }
      ],
      "required": true
    }
  ],
  "meta": {
    "phase": "basic",
    "progress": 10,
    "canGeneratePRD": false,
    "suggestedNextTopic": "下一话题"
  }
}
\`\`\`

错误原因: ${errors.slice(0, 3).join('; ')}`;
}

/**
 * 聚合SSE流内容
 * 将流式响应聚合为完整文本
 */
export async function aggregateSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // 使用stream模式解码，正确处理多字节UTF-8字符
    buffer += decoder.decode(value, { stream: true });
    
    // 按换行符分割，保留最后一个可能不完整的行
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  // 处理buffer中可能残留的最后一行
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6);
    if (data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  return fullContent;
}
