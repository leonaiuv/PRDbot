/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidRenderer } from '@/components/mermaid-renderer';
import { useTheme } from 'next-themes';

// Mock dependencies
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// 导入 mock 后的模块
import mermaid from 'mermaid';

// 获取 mock 函数的引用
const mockInitialize = mermaid.initialize as jest.Mock;
const mockRender = mermaid.render as jest.Mock;

describe('MermaidRenderer', () => {
  const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      systemTheme: 'light',
      setTheme: jest.fn(),
      themes: ['light', 'dark'],
    });
  });

  describe('Mermaid代码块检测', () => {
    it('应正确提取Mermaid代码', async () => {
      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      
      mockRender.mockResolvedValue({
        svg: '<svg></svg>',
      });

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.stringContaining('mermaid-'),
          'graph TD;\n  A-->B;'
        );
      });
    });

    it('未找到Mermaid代码块应显示错误', async () => {
      const content = 'No mermaid code here';

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(screen.getByText(/未找到Mermaid代码块/i)).toBeInTheDocument();
      });
    });
  });

  describe('图表渲染', () => {
    it('成功渲染应显示SVG', async () => {
      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      const mockSvg = '<svg width="100" height="100"><text>Test</text></svg>';
      
      mockRender.mockResolvedValue({
        svg: mockSvg,
      });

      const { container } = render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        const svgContainer = container.querySelector('.mermaid-container');
        expect(svgContainer).toBeInTheDocument();
        expect(svgContainer?.innerHTML).toContain('svg');
      });
    });

    it('渲染失败应降级显示源代码', async () => {
      const content = '```mermaid\ninvalid mermaid syntax\n```';
      
      mockRender.mockRejectedValue(
        new Error('Parse error on line 1')
      );

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(screen.getByText(/图表渲染失败/i)).toBeInTheDocument();
        expect(screen.getByText(/invalid mermaid syntax/i)).toBeInTheDocument();
      });
    });
  });

  describe('主题适配', () => {
    it('浅色模式应使用default主题', async () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        systemTheme: 'light',
        setTheme: jest.fn(),
        themes: ['light', 'dark'],
      });

      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      
      mockRender.mockResolvedValue({
        svg: '<svg></svg>',
      });

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: 'default',
          })
        );
      });
    });

    it('深色模式应使用dark主题', async () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        systemTheme: 'dark',
        setTheme: jest.fn(),
        themes: ['light', 'dark'],
      });

      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      
      mockRender.mockResolvedValue({
        svg: '<svg></svg>',
      });

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: 'dark',
          })
        );
      });
    });

    it('system主题应使用systemTheme值', async () => {
      mockUseTheme.mockReturnValue({
        theme: 'system',
        systemTheme: 'dark',
        setTheme: jest.fn(),
        themes: ['light', 'dark', 'system'],
      });

      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      
      mockRender.mockResolvedValue({
        svg: '<svg></svg>',
      });

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: 'dark',
          })
        );
      });
    });
  });

  describe('错误降级UI', () => {
    it('渲染失败时应显示复制按钮', async () => {
      const content = '```mermaid\ninvalid syntax\n```';
      
      mockRender.mockRejectedValue(
        new Error('Parse error')
      );

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        const copyButton = screen.getByRole('button', { name: /复制代码/i });
        expect(copyButton).toBeInTheDocument();
      });
    });

    it('渲染失败时应显示错误提示', async () => {
      const content = '```mermaid\ninvalid syntax\n```';
      
      mockRender.mockRejectedValue(
        new Error('Syntax error on line 2')
      );

      render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        expect(screen.getByText(/图表渲染失败/i)).toBeInTheDocument();
        expect(screen.getByText(/Syntax error on line 2/i)).toBeInTheDocument();
      });
    });
  });

  describe('响应式布局', () => {
    it('SVG应设置自适应样式', async () => {
      const content = '```mermaid\ngraph TD;\n  A-->B;\n```';
      const mockSvg = '<svg width="1000" height="500"></svg>';
      
      mockRender.mockResolvedValue({
        svg: mockSvg,
      });

      const { container } = render(<MermaidRenderer content={content} />);

      await waitFor(() => {
        const svgElement = container.querySelector('svg');
        expect(svgElement).toBeInTheDocument();
        // 验证响应式样式设置(通过组件内联样式设置)
        if (svgElement) {
          expect(svgElement.style.maxWidth).toBe('100%');
          expect(svgElement.style.height).toBe('auto');
        }
      });
    });
  });

  describe('内容更新', () => {
    it('内容变化应重新渲染', async () => {
      const content1 = '```mermaid\ngraph TD;\n  A-->B;\n```';
      const content2 = '```mermaid\ngraph LR;\n  C-->D;\n```';
      
      mockRender.mockResolvedValue({
        svg: '<svg></svg>',
      });

      const { rerender } = render(<MermaidRenderer content={content1} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(String),
          'graph TD;\n  A-->B;'
        );
      });

      rerender(<MermaidRenderer content={content2} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(String),
          'graph LR;\n  C-->D;'
        );
      });
    });
  });
});
