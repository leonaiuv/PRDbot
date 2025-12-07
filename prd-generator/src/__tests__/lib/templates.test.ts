/**
 * templates.ts 边界测试
 * 测试模板系统的各种边界场景
 */

import { describe, it, expect } from '@jest/globals';
import {
  PRD_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateInitialInput,
  filterTemplatesByCategory,
  type PRDTemplate,
} from '@/lib/templates';

describe('templates.ts - 模板系统边界测试', () => {
  describe('PRD_TEMPLATES数据完整性', () => {
    it('应该包含预设的模板', () => {
      // 功能验证：模板存在
      expect(PRD_TEMPLATES).toBeDefined();
      expect(PRD_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('应该包含空白项目模板', () => {
      // 功能验证：必备模板
      const blankTemplate = PRD_TEMPLATES.find(t => t.id === 'blank');
      expect(blankTemplate).toBeDefined();
      expect(blankTemplate?.category).toBe('custom');
    });

    it('所有模板应该有唯一的ID', () => {
      // 业务边界：ID唯一性
      const ids = PRD_TEMPLATES.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('所有模板应该有有效的分类', () => {
      // 业务边界：分类有效性
      // custom是允许的分类，但不在TEMPLATE_CATEGORIES中显示
      const validCategories = ['all', 'saas', 'ecommerce', 'social', 'tool', 'mobile', 'ai', 'custom'];
      
      PRD_TEMPLATES.forEach(template => {
        expect(validCategories).toContain(template.category);
      });
    });

    it('所有模板应该有非空的name和description', () => {
      // 数据边界：必填字段
      PRD_TEMPLATES.forEach(template => {
        expect(template.name).toBeTruthy();
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.description).toBeTruthy();
        expect(template.description.length).toBeGreaterThan(0);
      });
    });

    it('所有模板应该有icon', () => {
      // 数据边界：UI必备
      PRD_TEMPLATES.forEach(template => {
        expect(template.icon).toBeTruthy();
        expect(typeof template.icon).toBe('string');
      });
    });

    it('所有模板的prompts应该是数组', () => {
      // 类型边界：数据结构
      PRD_TEMPLATES.forEach(template => {
        expect(Array.isArray(template.prompts)).toBe(true);
      });
    });

    it('所有模板的tags应该是数组', () => {
      // 类型边界：数据结构
      PRD_TEMPLATES.forEach(template => {
        expect(Array.isArray(template.tags)).toBe(true);
      });
    });
  });

  describe('TEMPLATE_CATEGORIES数据完整性', () => {
    it('应该包含all分类', () => {
      // 功能验证：必备分类
      const allCategory = TEMPLATE_CATEGORIES.find(c => c.id === 'all');
      expect(allCategory).toBeDefined();
      expect(allCategory?.name).toBe('全部');
    });

    it('所有分类应该有唯一的ID', () => {
      // 业务边界：ID唯一性
      const ids = TEMPLATE_CATEGORIES.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('所有分类应该有icon', () => {
      // 数据边界：UI必备
      TEMPLATE_CATEGORIES.forEach(category => {
        expect(category.icon).toBeTruthy();
        expect(typeof category.icon).toBe('string');
      });
    });
  });

  describe('getTemplateInitialInput - 边界场景', () => {
    it('应该返回空字符串当prompts为空数组', () => {
      // 数据边界：空数组
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: [],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toBe('');
    });

    it('应该返回单个prompt', () => {
      // 功能验证：单prompt
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: ['单条需求'],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toBe('单条需求');
    });

    it('应该用换行符连接多个prompts', () => {
      // 功能验证：多prompt
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: ['需求1', '需求2', '需求3'],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toBe('需求1\n需求2\n需求3');
    });

    it('应该保留prompts中的换行符', () => {
      // 数据边界：内容包含换行
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: ['需求1\n子需求', '需求2'],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toBe('需求1\n子需求\n需求2');
      expect(result.split('\n')).toHaveLength(3);
    });

    it('应该处理空白项目模板', () => {
      // 功能验证：实际模板测试
      const blankTemplate = PRD_TEMPLATES.find(t => t.id === 'blank');
      expect(blankTemplate).toBeDefined();
      
      const result = getTemplateInitialInput(blankTemplate!);
      expect(result).toBe('');
    });

    it('应该处理CRM模板', () => {
      // 功能验证：实际模板测试
      const crmTemplate = PRD_TEMPLATES.find(t => t.id === 'saas-crm');
      expect(crmTemplate).toBeDefined();
      
      const result = getTemplateInitialInput(crmTemplate!);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('CRM');
    });

    it('应该处理包含特殊字符的prompts', () => {
      // 数据边界：特殊字符
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: ['需求1: 包含冒号', '需求2 "引号"', '需求3 <标签>'],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toContain(':');
      expect(result).toContain('"');
      expect(result).toContain('<');
    });
  });

  describe('filterTemplatesByCategory - 过滤边界', () => {
    it('应该返回所有模板当category为all', () => {
      // 功能验证：all分类
      const result = filterTemplatesByCategory('all');
      
      expect(result.length).toBe(PRD_TEMPLATES.length);
    });

    it('应该过滤saas分类的模板', () => {
      // 功能验证：正常过滤
      const result = filterTemplatesByCategory('saas');
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(template => {
        expect(template.category).toBe('saas');
      });
    });

    it('应该过滤ecommerce分类的模板', () => {
      // 功能验证：正常过滤
      const result = filterTemplatesByCategory('ecommerce');
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(template => {
        expect(template.category).toBe('ecommerce');
      });
    });

    it('应该过滤ai分类的模板', () => {
      // 功能验证：正常过滤
      const result = filterTemplatesByCategory('ai');
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(template => {
        expect(template.category).toBe('ai');
      });
    });

    it('应该返回空数组当category不存在', () => {
      // 边界验证：不存在的分类
      const result = filterTemplatesByCategory('nonexistent');
      
      expect(result).toEqual([]);
    });

    it('应该处理custom分类', () => {
      // 功能验证：自定义分类
      const result = filterTemplatesByCategory('custom');
      
      const blankTemplate = result.find(t => t.id === 'blank');
      expect(blankTemplate).toBeDefined();
    });

    it('应该返回不可变的新数组', () => {
      // 数据边界：不修改原数据
      const originalLength = PRD_TEMPLATES.length;
      const result = filterTemplatesByCategory('saas');
      
      result.push({
        id: 'fake',
        name: 'Fake',
        description: 'Fake',
        category: 'saas',
        icon: '📝',
        prompts: [],
        tags: [],
      });
      
      // 原数组不应该被修改
      expect(PRD_TEMPLATES.length).toBe(originalLength);
    });

    it('应该处理大小写敏感性', () => {
      // 类型边界：大小写
      const upperResult = filterTemplatesByCategory('SAAS' as PRDTemplate['category']);
      expect(upperResult).toEqual([]);
      
      const lowerResult = filterTemplatesByCategory('saas');
      expect(lowerResult.length).toBeGreaterThan(0);
    });
  });

  describe('模板数据一致性验证', () => {
    it('每个分类至少应该有一个模板', () => {
      // 业务边界：分类完整性
      const categories = TEMPLATE_CATEGORIES.filter(c => c.id !== 'all');
      
      categories.forEach(category => {
        const templates = filterTemplatesByCategory(category.id);
        expect(templates.length).toBeGreaterThan(0);
      });
    });

    it('所有模板的tags不应该为空', () => {
      // 数据边界：标签存在
      PRD_TEMPLATES.forEach(template => {
        if (template.id !== 'blank') {
          // 空白模板可以没有标签
          expect(template.tags.length).toBeGreaterThan(0);
        }
      });
    });

    it('SaaS模板应该包含相关prompts', () => {
      // 业务边界：内容相关性
      const saasTemplates = filterTemplatesByCategory('saas');
      
      saasTemplates.forEach(template => {
        if (template.prompts.length > 0) {
          const promptText = template.prompts.join(' ');
          // SaaS相关关键词应该出现
          const hasSaasKeywords = /系统|平台|管理|工具/.test(promptText);
          expect(hasSaasKeywords).toBe(true);
        }
      });
    });

    it('AI模板应该包含AI相关内容', () => {
      // 业务边界：内容相关性
      const aiTemplates = filterTemplatesByCategory('ai');
      
      aiTemplates.forEach(template => {
        const allText = template.name + template.description + template.prompts.join(' ');
        expect(allText).toMatch(/AI|智能|助手|生成|分析/);
      });
    });

    it('所有非空白模板应该有至少一个prompt', () => {
      // 业务边界：内容完整性
      PRD_TEMPLATES.forEach(template => {
        if (template.id !== 'blank') {
          expect(template.prompts.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('模板边界情况', () => {
    it('应该处理prompts包含空字符串', () => {
      // 数据边界：空字符串元素
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: ['需求1', '', '需求2'],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      // 应该保留空字符串（作为空行）
      expect(result).toBe('需求1\n\n需求2');
    });

    it('应该处理tags包含空字符串', () => {
      // 数据边界：空标签
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: [],
        tags: ['标签1', '', '标签2'],
      };
      
      // 数据结构允许，但应该避免
      expect(template.tags).toHaveLength(3);
    });

    it('应该处理超长的prompt文本', () => {
      // 数据边界：长文本
      const longPrompt = 'A'.repeat(10000);
      const template: PRDTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        icon: '📝',
        prompts: [longPrompt],
        tags: [],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result.length).toBe(10000);
    });

    it('应该处理包含Unicode字符的template', () => {
      // 数据边界：Unicode
      const template: PRDTemplate = {
        id: 'test',
        name: '测试 🚀',
        description: 'Test with emoji 😀',
        category: 'custom',
        icon: '📝',
        prompts: ['需求 with emoji 🎯', '中文需求'],
        tags: ['标签1', 'tag2', '🏷️'],
      };
      
      const result = getTemplateInitialInput(template);
      expect(result).toContain('🎯');
      expect(result).toContain('中文');
    });

    it('应该处理所有可能的category值', () => {
      // 类型边界：枚举完整性
      const validCategories: Array<PRDTemplate['category']> = [
        'saas', 'ecommerce', 'social', 'tool', 'mobile', 'ai', 'custom'
      ];
      
      validCategories.forEach(category => {
        const template: PRDTemplate = {
          id: 'test',
          name: 'Test',
          description: 'Test',
          category,
          icon: '📝',
          prompts: [],
          tags: [],
        };
        
        // 应该不抛异常
        expect(template.category).toBe(category);
      });
    });
  });

  describe('实际模板内容验证', () => {
    it('CRM模板应该包含完整的业务描述', () => {
      // 功能验证：业务完整性
      const crm = PRD_TEMPLATES.find(t => t.id === 'saas-crm');
      expect(crm).toBeDefined();
      expect(crm?.prompts.length).toBeGreaterThanOrEqual(2);
      
      const promptText = crm!.prompts.join(' ');
      expect(promptText).toMatch(/CRM|客户/);
      expect(promptText).toMatch(/管理/);
    });

    it('项目管理模板应该包含协作相关内容', () => {
      // 功能验证：业务完整性
      const project = PRD_TEMPLATES.find(t => t.id === 'saas-project');
      expect(project).toBeDefined();
      
      const allText = project!.name + project!.description + project!.prompts.join(' ');
      expect(allText).toMatch(/项目|任务|协作|团队/);
    });

    it('电商模板应该区分B2C和B2B', () => {
      // 功能验证：业务区分
      const b2c = PRD_TEMPLATES.find(t => t.id === 'ecommerce-b2c');
      const b2b = PRD_TEMPLATES.find(t => t.id === 'ecommerce-b2b');
      
      expect(b2c).toBeDefined();
      expect(b2b).toBeDefined();
      
      expect(b2c!.prompts.join(' ')).toMatch(/消费者|购物|在线支付/);
      expect(b2b!.prompts.join(' ')).toMatch(/批发|采购|供应商/);
    });

    it('所有模板的icon应该是emoji或有效字符', () => {
      // 数据边界：icon格式
      PRD_TEMPLATES.forEach(template => {
        expect(template.icon.length).toBeGreaterThan(0);
        expect(template.icon.length).toBeLessThan(10); // emoji通常很短
      });
    });

    it('模板数量应该合理（不过多也不过少）', () => {
      // 业务边界：数量合理性
      expect(PRD_TEMPLATES.length).toBeGreaterThanOrEqual(10);
      expect(PRD_TEMPLATES.length).toBeLessThan(50); // 避免选择困难
    });

    it('每个分类的模板数量应该平衡', () => {
      // 业务边界：分类平衡性
      const categories = ['saas', 'ecommerce', 'social', 'tool', 'mobile', 'ai'];
      const counts = categories.map(cat => filterTemplatesByCategory(cat).length);
      
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      
      // 最大和最小差距不应该太大
      expect(maxCount - minCount).toBeLessThan(10);
    });
  });
});
