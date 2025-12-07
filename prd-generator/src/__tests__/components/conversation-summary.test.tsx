/**
 * ConversationSummary 组件单元测试
 * 测试折叠卡片的渲染、交互和样式
 */

import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationSummary, QuickSummary } from '@/components/conversation-summary';
import type { ConversationMessage } from '@/types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="chevron-up">ChevronUp</span>,
  CheckCircle2: () => <span data-testid="check-circle">CheckCircle2</span>,
  MessageSquare: () => <span data-testid="message-square">MessageSquare</span>,
}));

// Mock Collapsible components from Radix UI
jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => {
    return (
      <div data-testid="collapsible" data-state={open ? 'open' : 'closed'}>
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<{ onOpenChange?: (open: boolean) => void; open?: boolean }>, { onOpenChange, open });
          }
          return child;
        })}
      </div>
    );
  },
  CollapsibleTrigger: ({ children, onOpenChange, open }: { children: React.ReactNode; asChild?: boolean; onOpenChange?: (open: boolean) => void; open?: boolean }) => (
    <div 
      data-testid="collapsible-trigger" 
      onClick={() => onOpenChange && onOpenChange(!open)}
    >
      {children}
    </div>
  ),
  CollapsibleContent: ({ children, className, open }: { children: React.ReactNode; className?: string; open?: boolean }) => (
    // Always render content for testing purposes, but mark the state
    <div data-testid="collapsible-content" className={className} data-open={open}>{children}</div>
  ),
}));

describe('ConversationSummary 组件', () => {
  // 创建测试用的对话数据
  const createConversation = (count: number): ConversationMessage[] => {
    const messages: ConversationMessage[] = [];
    for (let i = 0; i < count; i++) {
      // AI 提问
      messages.push({
        id: `ai-${i}`,
        role: 'assistant',
        content: `这是AI提出的问题 ${i + 1}？请选择您的偏好。`,
        timestamp: Date.now() - (count - i) * 1000,
      });
      // 用户回答
      messages.push({
        id: `user-${i}`,
        role: 'user',
        content: `这是用户的回答 ${i + 1}`,
        timestamp: Date.now() - (count - i) * 1000 + 500,
      });
    }
    return messages;
  };

  beforeEach(() => {
    // Reset mock state if needed
  });

  describe('渲染逻辑', () => {
    it('当没有问答对时应该返回 null', () => {
      const emptyConversation: ConversationMessage[] = [];
      const { container } = render(<ConversationSummary conversation={emptyConversation} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('当只有用户消息时应该返回 null', () => {
      const userOnlyConversation: ConversationMessage[] = [
        { id: '1', role: 'user', content: '用户消息', timestamp: Date.now() },
      ];
      const { container } = render(<ConversationSummary conversation={userOnlyConversation} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('当只有AI消息时应该返回 null', () => {
      const aiOnlyConversation: ConversationMessage[] = [
        { id: '1', role: 'assistant', content: 'AI消息', timestamp: Date.now() },
      ];
      const { container } = render(<ConversationSummary conversation={aiOnlyConversation} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('当有有效问答对时应该渲染卡片', () => {
      const conversation = createConversation(3);
      render(<ConversationSummary conversation={conversation} />);
      
      expect(screen.getByText('已确认信息')).toBeTruthy();
      expect(screen.getByText('3 项')).toBeTruthy();
    });

    it('应该正确应用 className 属性', () => {
      const conversation = createConversation(2);
      const { container } = render(
        <ConversationSummary conversation={conversation} className="custom-class" />
      );
      
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-class');
    });
  });

  describe('样式和布局（防止重叠问题）', () => {
    it('卡片应该有相对定位和 z-index 防止重叠', () => {
      const conversation = createConversation(2);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const card = container.firstChild as HTMLElement;
      // 检查关键的防重叠样式
      expect(card.className).toContain('relative');
      expect(card.className).toContain('z-10');
    });

    it('卡片应该有不透明背景色', () => {
      const conversation = createConversation(2);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-card');
    });

    it('卡片不应该有 overflow-hidden（以允许滚动条显示）', () => {
      const conversation = createConversation(2);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const card = container.firstChild as HTMLElement;
      // 卡片不应该有 overflow-hidden，否则会切断滚动条
      expect(card.className).not.toContain('overflow-hidden');
    });

    it('卡片应该有阴影效果', () => {
      const conversation = createConversation(2);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('shadow-sm');
    });

    it('CardHeader 应该有不透明背景', () => {
      const conversation = createConversation(2);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      // Find the CardHeader element by its data-slot attribute or class
      const header = container.querySelector('[data-slot="card-header"]');
      expect(header).toBeTruthy();
      expect(header?.className).toContain('bg-card');
    });
  });

  describe('滚动容器（防止内容截断）', () => {
    it('应该有滚动容器包裹内容', () => {
      const conversation = createConversation(5);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      // 查找原生滚动容器
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeTruthy();
    });

    it('滚动容器应该有最大高度限制', () => {
      const conversation = createConversation(10);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer?.className).toContain('max-h-[250px]');
    });

    it('滚动容器应该有自定义滚动条样式', () => {
      const conversation = createConversation(5);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer?.className).toContain('custom-scrollbar');
    });

    it('滚动容器应该有右侧内边距', () => {
      const conversation = createConversation(5);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer?.className).toContain('pr-2');
    });

    it('应该渲染所有问答项', () => {
      const conversation = createConversation(10);
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      // 检查所有问答项都被渲染
      const items = container.querySelectorAll('.border-l-2');
      expect(items.length).toBe(10);
    });
  });

  describe('交互功能', () => {
    it('初始状态应该是折叠的', () => {
      const conversation = createConversation(2);
      render(<ConversationSummary conversation={conversation} />);
      
      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible.getAttribute('data-state')).toBe('closed');
    });

    it('点击标题应该展开/折叠内容', () => {
      const conversation = createConversation(2);
      render(<ConversationSummary conversation={conversation} />);
      
      const trigger = screen.getByTestId('collapsible-trigger');
      
      // 点击展开
      fireEvent.click(trigger);
      expect(screen.getByTestId('collapsible').getAttribute('data-state')).toBe('open');
      
      // 再次点击折叠
      fireEvent.click(trigger);
      expect(screen.getByTestId('collapsible').getAttribute('data-state')).toBe('closed');
    });

    it('应该显示正确的展开/折叠图标', () => {
      const conversation = createConversation(2);
      render(<ConversationSummary conversation={conversation} />);
      
      // 初始折叠状态显示向下箭头
      expect(screen.getByTestId('chevron-down')).toBeTruthy();
    });
  });

  describe('内容提取', () => {
    it('应该正确提取问答对', () => {
      const conversation: ConversationMessage[] = [
        { id: '1', role: 'assistant', content: '您的产品名称是什么？', timestamp: 1000 },
        { id: '2', role: 'user', content: 'PRD Generator', timestamp: 2000 },
        { id: '3', role: 'assistant', content: '目标用户是谁？', timestamp: 3000 },
        { id: '4', role: 'user', content: '产品经理和开发者', timestamp: 4000 },
      ];
      
      render(<ConversationSummary conversation={conversation} />);
      
      expect(screen.getByText('2 项')).toBeTruthy();
    });

    it('应该截断过长的问题内容', () => {
      const longQuestion = 'A'.repeat(150); // 超过100字符
      const conversation: ConversationMessage[] = [
        { id: '1', role: 'assistant', content: longQuestion, timestamp: 1000 },
        { id: '2', role: 'user', content: '回答', timestamp: 2000 },
      ];
      
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      // 问题应该被截断到100字符 - 检查文本是否存在
      const textElements = container.querySelectorAll('.text-muted-foreground');
      let found = false;
      textElements.forEach(el => {
        if (el.textContent && el.textContent.length === 100) {
          found = true;
        }
      });
      expect(found).toBe(true);
    });

    it('应该截断过长的答案内容', () => {
      const longAnswer = 'B'.repeat(250); // 超过200字符
      const conversation: ConversationMessage[] = [
        { id: '1', role: 'assistant', content: '问题？', timestamp: 1000 },
        { id: '2', role: 'user', content: longAnswer, timestamp: 2000 },
      ];
      
      const { container } = render(<ConversationSummary conversation={conversation} />);
      
      // 答案应该被截断到200字符
      const textElements = container.querySelectorAll('.font-medium');
      let found = false;
      textElements.forEach(el => {
        if (el.textContent && el.textContent.length === 200) {
          found = true;
        }
      });
      expect(found).toBe(true);
    });
  });
});

describe('QuickSummary 组件', () => {
  it('当没有关键信息时应该返回 null', () => {
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'assistant', content: 'AI消息', timestamp: Date.now() },
    ];
    const { container } = render(<QuickSummary conversation={conversation} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('应该显示产品想法', () => {
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'user', content: '我想做一个AI产品需求文档生成器', timestamp: Date.now() },
    ];
    render(<QuickSummary conversation={conversation} />);
    
    expect(screen.getByText('产品想法：')).toBeTruthy();
  });

  it('应该截断过长的产品想法', () => {
    const longContent = 'A'.repeat(100);
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'user', content: longContent, timestamp: Date.now() },
    ];
    render(<QuickSummary conversation={conversation} />);
    
    // 应该截断到80字符并添加省略号
    const truncatedText = 'A'.repeat(80) + '...';
    expect(screen.getByText(truncatedText)).toBeTruthy();
  });

  it('应该匹配并显示关键词', () => {
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'user', content: '初始输入', timestamp: Date.now() },
      { id: '2', role: 'user', content: '产品名称是 PRDBot', timestamp: Date.now() },
    ];
    render(<QuickSummary conversation={conversation} />);
    
    expect(screen.getByText('产品名称：')).toBeTruthy();
  });

  it('应该最多显示3个关键信息', () => {
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'user', content: '初始输入', timestamp: Date.now() },
      { id: '2', role: 'user', content: '产品名称是 PRDBot', timestamp: Date.now() },
      { id: '3', role: 'user', content: '目标用户是开发者', timestamp: Date.now() },
      { id: '4', role: 'user', content: '核心功能是AI生成', timestamp: Date.now() },
      { id: '5', role: 'user', content: '技术栈是 Next.js', timestamp: Date.now() },
      { id: '6', role: 'user', content: '平台是 Web', timestamp: Date.now() },
    ];
    render(<QuickSummary conversation={conversation} />);
    
    // 产品想法 + 前2个匹配的关键词 = 最多3个
    const allItems = screen.getAllByText(/：$/);
    expect(allItems.length).toBeLessThanOrEqual(3);
  });

  it('应该显示快速摘要标题', () => {
    const conversation: ConversationMessage[] = [
      { id: '1', role: 'user', content: '产品想法', timestamp: Date.now() },
    ];
    render(<QuickSummary conversation={conversation} />);
    
    expect(screen.getByText('快速摘要')).toBeTruthy();
  });
});
