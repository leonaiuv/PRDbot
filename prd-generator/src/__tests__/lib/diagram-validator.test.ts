/**
 * diagram-validator.ts 边界测试
 * 测试图表校验逻辑的各种边界场景
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractDiagramJSON,
  validateMermaidSyntax,
  validateDiagramResponse,
  buildDiagramRetryPrompt,
  convertDiagramsToMarkdown,
  extractMermaidBlocksFromText,
  type ValidatedDiagramsResponse,
} from '@/lib/diagram-validator';

describe('diagram-validator.ts - 图表校验边界测试', () => {
  describe('extractDiagramJSON - JSON提取边界', () => {
    it('应该从代码块中提取JSON', () => {
      // 数据边界：标准JSON代码块
      const text = '```json\n{"diagrams": []}\n```';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toBe('{"diagrams": []}');
      expect(result.textContent).toBe('');
    });

    it('应该从裸JSON中提取', () => {
      // 数据边界：无代码块包裹
      const text = '{"diagrams": []}';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toBe('{"diagrams": []}');
    });

    it('应该从混合格式中提取JSON', () => {
      // 数据边界：JSON+文本混合
      const text = '这是前言\n```json\n{"diagrams": []}\n```\n这是后续';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toBe('{"diagrams": []}');
    });

    it('应该提取嵌入的JSON对象', () => {
      // 数据边界：嵌套JSON
      const text = '{"meta": {"diagrams": [{"title": "test"}]}}';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toContain('"diagrams"');
    });

    it('应该在多个代码块时提取第一个', () => {
      // 数据边界：多个代码块
      const text = '```json\n{"diagrams": [1]}\n```\n```json\n{"diagrams": [2]}\n```';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toContain('[1]');
    });

    it('应该处理空输入', () => {
      // 数据边界：空字符串
      const result = extractDiagramJSON('');
      
      expect(result.json).toBeNull();
      expect(result.textContent).toBe('');
    });

    it('应该处理仅空白字符', () => {
      // 数据边界：只有空白
      const result = extractDiagramJSON('   \n\t  ');
      
      expect(result.json).toBeNull();
    });

    it('应该处理无JSON的文本', () => {
      // 数据边界：纯文本
      const text = '这是一段没有JSON的普通文本';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toBeNull();
      expect(result.textContent).toBe(text);
    });

    it('应该处理不带json标记的代码块', () => {
      // 数据边界：代码块无语言标记
      const text = '```\n{"diagrams": []}\n```';
      const result = extractDiagramJSON(text);
      
      expect(result.json).toBe('{"diagrams": []}');
    });
  });

  describe('validateMermaidSyntax - 语法校验边界', () => {
    it('应该接受有效的graph声明', () => {
      // 功能验证：标准graph语法
      const code = 'graph TB\n    A[Start] --> B[End]';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(true);
    });

    it('应该接受有效的flowchart声明', () => {
      // 功能验证：flowchart语法
      const code = 'flowchart LR\n    A --> B';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(true);
    });

    it('应该接受有效的erDiagram', () => {
      // 功能验证：ER图语法
      const code = 'erDiagram\n    USER ||--o{ ORDER : places';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(true);
    });

    it('应该接受有效的sequenceDiagram', () => {
      // 功能验证：时序图语法
      const code = 'sequenceDiagram\n    Alice->>Bob: Hello';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空代码', () => {
      // 数据边界：空字符串
      const result = validateMermaidSyntax('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('空');
    });

    it('应该拒绝无效的图表类型', () => {
      // 业务边界：缺少类型声明
      const code = 'A --> B';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未找到有效的图表类型');
    });

    it('应该拒绝包含style定义的代码', () => {
      // 业务边界：禁止样式
      const code = 'graph TB\n    A --> B\n    style A fill:#f9f';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('禁止的样式定义');
    });

    it('应该拒绝包含classDef的代码', () => {
      // 业务边界：禁止类定义
      const code = 'graph TB\n    A --> B\n    classDef myClass fill:#f96';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('禁止的样式定义');
    });

    it('应该拒绝包含fill颜色的代码', () => {
      // 业务边界：禁止fill
      const code = 'graph TB\n    A[Node]:::fill:red';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
    });

    it('应该拒绝graph类型但无节点定义', () => {
      // 业务边界：缺少节点
      const code = 'graph TB\n';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未找到有效的节点');
    });

    it('应该拒绝erDiagram但无实体定义', () => {
      // 业务边界：缺少实体
      const code = 'erDiagram\n';
      const result = validateMermaidSyntax(code);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未找到有效的实体');
    });
  });

  describe('validateDiagramResponse - 端到端校验边界', () => {
    it('应该校验通过有效的图表响应', () => {
      // 功能验证：标准格式
      const text = `\`\`\`json
{
  "diagrams": [
    {
      "title": "系统架构图",
      "type": "architecture",
      "code": "graph TB\\n    A[用户] --> B[前端]"
    }
  ]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.diagrams).toHaveLength(1);
    });

    it('应该拒绝空输入', () => {
      // 数据边界：空字符串
      const result = validateDiagramResponse('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('未能从响应中提取到有效的JSON结构');
    });

    it('应该拒绝无效JSON格式', () => {
      // 数据边界：畸形JSON
      const text = '```json\n{ invalid }\n```';
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('JSON解析失败');
    });

    it('应该拒绝缺少diagrams字段', () => {
      // 业务边界：缺少必填字段
      const text = '```json\n{}\n```';
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('diagrams'))).toBe(true);
    });

    it('应该拒绝diagrams为空数组', () => {
      // 业务边界：数组长度限制
      const text = '```json\n{"diagrams": []}\n```';
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('至少需要1个图表'))).toBe(true);
    });

    it('应该拒绝diagrams超过5个', () => {
      // 业务边界：数组长度上限
      const diagrams = Array(6).fill({
        title: "图表",
        type: "architecture",
        code: "graph TB\\n    A --> B"
      });
      const text = `\`\`\`json\n${JSON.stringify({ diagrams })}\n\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('最多5个图表'))).toBe(true);
    });

    it('应该拒绝图表title为空字符串', () => {
      // 数据边界：空标题
      const text = `\`\`\`json
{
  "diagrams": [{
    "title": "",
    "type": "architecture",
    "code": "graph TB\\n    A --> B"
  }]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('标题不能为空'))).toBe(true);
    });

    it('应该拒绝非法的type值', () => {
      // 业务边界：枚举校验
      const text = `\`\`\`json
{
  "diagrams": [{
    "title": "测试",
    "type": "invalid-type",
    "code": "graph TB\\n    A --> B"
  }]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('type必须是'))).toBe(true);
    });

    it('应该拒绝code长度小于10字符', () => {
      // 业务边界：最小长度
      const text = `\`\`\`json
{
  "diagrams": [{
    "title": "测试",
    "type": "architecture",
    "code": "graph TB"
  }]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('不能少于10个字符'))).toBe(true);
    });

    it('应该拒绝包含禁止样式的code', () => {
      // 业务边界：样式禁用规则
      const text = `\`\`\`json
{
  "diagrams": [{
    "title": "测试",
    "type": "architecture",
    "code": "graph TB\\n    A --> B\\n    style A fill:#f9f"
  }]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      
      expect(result.valid).toBe(false);
      expect(result.renderErrors).toBeDefined();
      expect(result.renderErrors?.[0]?.error).toContain('禁止的样式');
    });
  });

  describe('buildDiagramRetryPrompt - 重试提示边界', () => {
    it('应该生成包含错误信息的提示', () => {
      // 功能验证：错误信息包含
      const errors = ['错误1', '错误2'];
      const prompt = buildDiagramRetryPrompt(errors);
      
      expect(prompt).toContain('错误1');
      expect(prompt).toContain('错误2');
    });

    it('应该只显示前3个错误', () => {
      // 数据边界：错误数量限制
      const errors = ['错误1', '错误2', '错误3', '错误4', '错误5'];
      const prompt = buildDiagramRetryPrompt(errors);
      
      expect(prompt).toContain('错误1');
      expect(prompt).toContain('错误2');
      expect(prompt).toContain('错误3');
      expect(prompt).not.toContain('错误4');
    });

    it('应该包含正确格式示例', () => {
      // 功能验证：示例包含
      const prompt = buildDiagramRetryPrompt(['测试错误']);
      
      expect(prompt).toContain('正确格式示例');
      expect(prompt).toContain('```json');
      expect(prompt).toContain('diagrams');
    });
  });

  describe('convertDiagramsToMarkdown - 格式转换边界', () => {
    it('应该正确转换单个图表', () => {
      // 功能验证：单图表转换
      const data: ValidatedDiagramsResponse = {
        diagrams: [{
          title: '系统架构',
          type: 'architecture',
          code: 'graph TB\n    A --> B'
        }]
      };
      
      const markdown = convertDiagramsToMarkdown(data);
      
      expect(markdown).toContain('## 系统架构');
      expect(markdown).toContain('```mermaid');
      expect(markdown).toContain('graph TB');
    });

    it('应该正确转换多个图表', () => {
      // 功能验证：多图表转换
      const data: ValidatedDiagramsResponse = {
        diagrams: [
          { title: '图表1', type: 'architecture', code: 'graph TB\n    A --> B' },
          { title: '图表2', type: 'flowchart', code: 'flowchart LR\n    X --> Y' }
        ]
      };
      
      const markdown = convertDiagramsToMarkdown(data);
      
      expect(markdown).toContain('## 图表1');
      expect(markdown).toContain('## 图表2');
      expect(markdown.split('```mermaid')).toHaveLength(3); // 空字符串 + 2个图表
    });
  });

  describe('extractMermaidBlocksFromText - 降级提取边界', () => {
    it('应该提取单个mermaid代码块', () => {
      // 功能验证：标准提取
      const text = '## 架构图\n```mermaid\ngraph TB\n    A --> B\n```';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams).toHaveLength(1);
      expect(diagrams[0].title).toBe('架构图');
      expect(diagrams[0].code).toContain('graph TB');
    });

    it('应该为无标题的块生成默认标题', () => {
      // 数据边界：缺少标题
      const text = '```mermaid\ngraph TB\n    A --> B\n```';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams).toHaveLength(1);
      expect(diagrams[0].title).toBe('图表1');
    });

    it('应该提取多个mermaid代码块', () => {
      // 功能验证：多块提取
      const text = `
## 图1
\`\`\`mermaid
graph TB
    A --> B
\`\`\`

## 图2
\`\`\`mermaid
erDiagram
    USER ||--o{ ORDER : places
\`\`\`
`;
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams).toHaveLength(2);
      expect(diagrams[0].title).toBe('图1');
      expect(diagrams[1].title).toBe('图2');
    });

    it('应该根据代码推断图表类型', () => {
      // 功能验证：类型推断
      const text = `
\`\`\`mermaid
erDiagram
    USER {}
\`\`\`
`;
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams[0].type).toBe('er');
    });

    it('应该推断sequenceDiagram类型', () => {
      // 功能验证：时序图推断
      const text = '```mermaid\nsequenceDiagram\n    A->>B: msg\n```';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams[0].type).toBe('sequence');
    });

    it('应该推断classDiagram类型', () => {
      // 功能验证：类图推断
      const text = '```mermaid\nclassDiagram\n    class User\n```';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams[0].type).toBe('class');
    });

    it('应该从标题推断flowchart类型', () => {
      // 功能验证：标题推断
      const text = '## 用户流程图\n```mermaid\ngraph LR\n    A --> B\n```';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams[0].type).toBe('flowchart');
    });

    it('应该处理无mermaid块的文本', () => {
      // 数据边界：无匹配
      const text = '这是一段普通文本，没有mermaid代码块';
      const diagrams = extractMermaidBlocksFromText(text);
      
      expect(diagrams).toHaveLength(0);
    });
  });

  describe('安全边界测试', () => {
    it('应该处理超大JSON输入（100KB）', () => {
      // 安全边界：大数据量
      const largeCode = 'graph TB\n' + '    A --> B\n'.repeat(5000);
      const text = `\`\`\`json
{
  "diagrams": [{
    "title": "大图表",
    "type": "architecture",
    "code": "${largeCode.replace(/\n/g, '\\n')}"
  }]
}
\`\`\``;
      
      const result = validateDiagramResponse(text);
      // 应该不崩溃，可能校验失败但不应该抛异常
      expect(result).toBeDefined();
    });

    it('应该处理深度嵌套的JSON', () => {
      // 安全边界：深度嵌套
      const nested: Record<string, unknown> = { diagrams: [] };
      let current: Record<string, unknown> = nested;
      for (let i = 0; i < 10; i++) {
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }
      
      const text = `\`\`\`json\n${JSON.stringify(nested)}\n\`\`\``;
      const result = validateDiagramResponse(text);
      
      // 应该能处理，不崩溃
      expect(result).toBeDefined();
    });

    it('应该处理Unicode零宽字符', () => {
      // 安全边界：特殊字符
      const text = '```json\n{"diagrams":\u200B []}\n```'; // 零宽空格
      const result = validateDiagramResponse(text);
      
      // 可能解析失败，但不应崩溃
      expect(result).toBeDefined();
    });
  });
});
