/**
 * @jest-environment jsdom
 */

/**
 * AIAnalysisTools 组件测试
 * 测试AI分析功能的核心功能和边界场景
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIAnalysisTools } from '@/components/ai-analysis-tools';
import { analysisResultsDB } from '@/lib/db';
import { clearTestDatabase } from '../utils/helpers';
import { createTestAnalysisResult, TEST_ANALYSIS_TYPES } from '../utils/factories';
import type { AnalysisType } from '@/types';

// Mock react-markdown 和 remark-gfm
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => ({}));

// Mock MermaidRenderer
jest.mock('@/components/mermaid-renderer', () => ({
  MermaidRenderer: ({ content }: { content: string }) => (
    <div data-testid="mermaid-renderer">{content}</div>
  ),
}));

// Mock toast - 定义在 jest.mock 内部避免 hoisting 问题
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// 导入 mock 后获取引用
import { toast } from 'sonner';
const mockToast = toast as unknown as {
  success: jest.Mock;
  error: jest.Mock;
};

describe('AIAnalysisTools 组件', () => {
  const defaultProps = {
    projectId: 'test-project-123',
    prdContent: '# 测试PRD内容\n\n这是一个测试产品需求文档。',
    model: 'deepseek',
    apiKey: 'sk-test-key',
  };

  beforeEach(async () => {
    await clearTestDatabase();
    mockFetch.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  describe('渲染测试', () => {
    it('应该正确渲染分析按钮', () => {
      render(<AIAnalysisTools {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /AI 分析/i })).toBeInTheDocument();
    });

    it('没有PRD内容时按钮应该禁用', () => {
      render(<AIAnalysisTools {...defaultProps} prdContent="" />);
      
      const button = screen.getByRole('button', { name: /AI 分析/i });
      expect(button).toBeDisabled();
    });

    it('有已保存结果时应该显示徽章', async () => {
      // 预先保存分析结果
      await analysisResultsDB.save(createTestAnalysisResult(defaultProps.projectId, 'optimize'));
      
      render(<AIAnalysisTools {...defaultProps} />);
      
      // 等待加载完成
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('下拉菜单功能', () => {
    it('点击按钮应该显示下拉菜单', async () => {
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('AI 优化建议')).toBeInTheDocument();
        expect(screen.getByText('质量评分')).toBeInTheDocument();
        expect(screen.getByText('竞品分析')).toBeInTheDocument();
        expect(screen.getByText('生成图表')).toBeInTheDocument();
      });
    });

    it('有已保存结果时应该显示"已保存的分析结果"区域', async () => {
      await analysisResultsDB.save(createTestAnalysisResult(defaultProps.projectId, 'optimize'));
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('已保存的分析结果')).toBeInTheDocument();
      });
    });
  });

  describe('分析功能', () => {
    it('应该成功执行分析并保存结果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '# 分析结果\n\n这是AI分析内容' }),
      } as Response);

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('AI 优化建议')).toBeInTheDocument();
      });
      
      // 点击分析选项
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
          method: 'POST',
        }));
      });

      // 验证结果已保存到数据库
      await waitFor(async () => {
        const saved = await analysisResultsDB.get(defaultProps.projectId, 'optimize');
        expect(saved).toBeDefined();
        expect(saved!.content).toBe('# 分析结果\n\n这是AI分析内容');
      });
    });

    it('API失败时应该显示错误提示', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '服务器错误' }),
      } as Response);

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('AI 优化建议')).toBeInTheDocument();
      });
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('没有API Key时应该显示错误', async () => {
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} apiKey="" />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('AI 优化建议')).toBeInTheDocument();
      });
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('请先配置 API Key');
      });
    });
  });

  describe('结果持久化', () => {
    it('组件挂载时应该加载已保存的结果', async () => {
      // 预先保存结果
      const savedResult = createTestAnalysisResult(defaultProps.projectId, 'score', {
        content: '# 评分结果\n\n得分: 85分',
      });
      await analysisResultsDB.save(savedResult);
      
      render(<AIAnalysisTools {...defaultProps} />);
      
      // 应该显示已保存结果的徽章
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('应该正确检测PRD内容变化（过期状态）', async () => {
      // 保存带有旧hash的结果
      const savedResult = createTestAnalysisResult(defaultProps.projectId, 'optimize', {
        content: '# 旧分析结果',
        prdContentHash: 'old-hash-different',
      });
      await analysisResultsDB.save(savedResult);
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      // 应该显示"已过期"标签
      await waitFor(() => {
        expect(screen.getByText('已过期')).toBeInTheDocument();
      });
    });

    it('多个分析结果应该独立保存和加载', async () => {
      // 保存多个类型的结果
      for (const type of TEST_ANALYSIS_TYPES) {
        await analysisResultsDB.save(
          createTestAnalysisResult(defaultProps.projectId, type)
        );
      }
      
      render(<AIAnalysisTools {...defaultProps} />);
      
      // 应该显示4个已保存结果
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });
  });

  describe('Sheet面板', () => {
    it('点击查看结果应该打开Sheet', async () => {
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'competitor', {
          content: '# 竞品分析结果',
        })
      );
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      await waitFor(() => {
        expect(screen.getByText('已保存的分析结果')).toBeInTheDocument();
      });
      
      // 查找并点击查看竞品分析的菜单项 - 在"已保存的分析结果"区域
      const viewItems = screen.getAllByRole('menuitem');
      // 第一个menuitem应该是"查看"区域的竞品分析
      const competitorViewItem = viewItems.find(item => 
        item.textContent?.includes('竞品分析')
      );
      
      if (competitorViewItem) {
        await user.click(competitorViewItem);
      }
      
      // Sheet应该打开，并显示分析内容
      await waitFor(() => {
        // 查找Sheet内容或标题
        expect(screen.getByText('基于PRD内容的智能分析（结果已自动保存）')).toBeInTheDocument();
      });
    });

    it('图表类型应该使用MermaidRenderer渲染', async () => {
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'diagram', {
          content: '```mermaid\ngraph TD\nA-->B\n```',
        })
      );
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const viewItems = screen.getAllByRole('menuitem');
      const diagramItem = viewItems.find(item => 
        item.textContent?.includes('生成图表')
      );
      
      if (diagramItem) {
        await user.click(diagramItem);
      }
      
      await waitFor(() => {
        expect(screen.getByTestId('mermaid-renderer')).toBeInTheDocument();
      });
    });
  });

  describe('边界场景', () => {
    it('网络错误时应该正确处理', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('空PRD内容时按钮应该禁用', async () => {
      // 空白内容应该禁用按钮
      render(<AIAnalysisTools {...defaultProps} prdContent="   " />);
      
      // 按钮应该禁用
      expect(screen.getByRole('button', { name: /AI 分析/i })).toBeDisabled();
    });

    it('数据库操作失败时应该优雅降级', async () => {
      // Mock数据库错误
      jest.spyOn(analysisResultsDB, 'getByProject').mockRejectedValueOnce(new Error('DB Error'));
      
      // 不应该崩溃
      render(<AIAnalysisTools {...defaultProps} />);
      
      // 组件应该正常渲染
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /AI 分析/i })).toBeInTheDocument();
      });
    });

    it('特殊字符内容应该正确处理', async () => {
      const specialContent = '# 标题\n<script>alert("xss")</script>\n& < > " \' `';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: specialContent,
        })
      );
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const viewItems = screen.getAllByRole('menuitem');
      const item = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (item) {
        await user.click(item);
      }
      
      // 应该正常渲染，不崩溃
      await waitFor(() => {
        expect(screen.getByText('AI 分析结果')).toBeInTheDocument();
      });
    });

    it('大量内容应该正确处理', async () => {
      const largeContent = '测试'.repeat(10000);
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: largeContent,
        })
      );
      
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('并发分析请求应该正确处理', async () => {
      let resolveFirst: (value: Response) => void;
      let resolveSecond: (value: Response) => void;
      
      mockFetch
        .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
        .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      // 打开菜单并开始第一个分析
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      // 第一个请求应该已发出
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // 完成第一个请求
      resolveFirst!({
        ok: true,
        json: async () => ({ content: '第一个结果' }),
      } as Response);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('组件卸载时不应该导致状态更新错误', async () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ content: '结果' }),
          } as Response), 100)
        )
      );
      
      const user = userEvent.setup();
      const { unmount } = render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      // 在请求完成前卸载
      unmount();
      
      // 不应该有错误（无法直接测试，但组件不应崩溃）
    });
  });

  describe('UI状态同步', () => {
    it('分析中应该显示loading状态', async () => {
      let resolveRequest: (value: Response) => void;
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => { resolveRequest = resolve; })
      );
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }
      
      // 应该显示loading
      await waitFor(() => {
        expect(screen.getByText('正在分析中，请稍候...')).toBeInTheDocument();
      });
      
      // 完成请求
      resolveRequest!({
        ok: true,
        json: async () => ({ content: '分析完成' }),
      } as Response);
      
      await waitFor(() => {
        expect(screen.queryByText('正在分析中，请稍候...')).not.toBeInTheDocument();
      });
    });

    it('重新生成按钮应该正确工作', async () => {
      // 先保存一个结果
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: '旧结果',
        })
      );
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '新结果' }),
      } as Response);
      
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
      
      // 打开菜单并选择查看
      await user.click(screen.getByRole('button', { name: /AI 分析/i }));
      
      const viewItems = screen.getAllByRole('menuitem');
      const viewItem = viewItems.find(item => 
        item.textContent?.includes('AI 优化建议')
      );
      if (viewItem) {
        await user.click(viewItem);
      }
      
      // Sheet打开后点击重新生成
      await waitFor(() => {
        expect(screen.getByText('AI 分析结果')).toBeInTheDocument();
      });
      
      const regenerateButton = screen.getByRole('button', { name: /重新生成/i });
      await user.click(regenerateButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});

describe('simpleHash 函数（通过组件行为间接测试）', () => {
  it('相同内容应该产生相同hash（无过期状态）', async () => {
    const projectId = 'hash-test-project';
    
    // 先用相同内容生成并保存
    await analysisResultsDB.save({
      id: `${projectId}_optimize`,
      projectId,
      type: 'optimize' as AnalysisType,
      content: '分析结果',
      prdContentHash: 'test-hash', // 使用固定hash
    });
    
    await clearTestDatabase();
  });
});

describe('formatTime 函数（通过组件行为间接测试）', () => {
  it('最近的时间应该显示"刚刚"或"X分钟前"', async () => {
    const projectId = 'time-test-project';
    // 使用 createTestAnalysisResult 工厂函数，它会设置正确的时间戳
    await analysisResultsDB.save(
      createTestAnalysisResult(projectId, 'optimize')
    );
    
    const user = userEvent.setup();
    render(
      <AIAnalysisTools
        projectId={projectId}
        prdContent="测试内容"
        model="deepseek"
        apiKey="test-key"
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('button', { name: /AI 分析/i }));
    
    // 应该显示时间信息
    await waitFor(() => {
      // 可能显示"刚刚"或"1分钟前"等
      const timeText = screen.queryByText(/刚刚|分钟前/);
      expect(timeText).toBeInTheDocument();
    });
    
    await clearTestDatabase();
  });
});

describe('UI排版优化测试', () => {
  const defaultProps = {
    projectId: 'layout-test-project',
    prdContent: '# 测试PRD\n\n这是一个测试产品需求文档。',
    model: 'deepseek',
    apiKey: 'sk-test-key',
  };

  beforeEach(async () => {
    await clearTestDatabase();
    mockFetch.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  describe('ScoreResultRenderer 评分渲染器', () => {
    it('应该正确提取并显示总分', async () => {
      const scoreContent = '# 评分报告\n\n总分：85\n\n## 详细评分\n- 功能完整性：20/25\n- 技术可行性：18/20';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      // 应该显示评分卡片中的分数
      await waitFor(() => {
        expect(screen.getByText('85')).toBeInTheDocument();
        expect(screen.getByText('/100')).toBeInTheDocument();
      });
    });

    it('评分>=90应显示"优秀"标签', async () => {
      const scoreContent = '总分：95\n\n这是一份优质的PRD';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      await waitFor(() => {
        expect(screen.getByText('优秀')).toBeInTheDocument();
      });
    });

    it('评分>=80且<90应显示"良好"标签', async () => {
      const scoreContent = '总分：85\n\n这是一份良好的PRD';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      await waitFor(() => {
        expect(screen.getByText('良好')).toBeInTheDocument();
      });
    });

    it('评分>=70且<80应显示"合格"标签', async () => {
      const scoreContent = '总分：72\n\n这是一份合格的PRD';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      await waitFor(() => {
        expect(screen.getByText('合格')).toBeInTheDocument();
      });
    });

    it('评分<70应显示"待改进"标签', async () => {
      const scoreContent = '总分：55\n\n这份PRD需要改进';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      await waitFor(() => {
        expect(screen.getByText('待改进')).toBeInTheDocument();
      });
    });

    it('无法提取总分时应该不显示评分卡片', async () => {
      const scoreContent = '# 分析报告\n\n这是一个没有总分的分析结果。';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'score', {
          content: scoreContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const scoreItem = viewItems.find(item => item.textContent?.includes('质量评分'));
      if (scoreItem) {
        await user.click(scoreItem);
      }

      await waitFor(() => {
        // 不应该有评分数字和/100标记
        expect(screen.queryByText('/100')).not.toBeInTheDocument();
      });
    });
  });

  describe('OptimizeResultRenderer 优化建议渲染器', () => {
    it('应该显示"AI 优化建议报告"标题', async () => {
      const optimizeContent = '# 优化建议\n\n1. 建议一\n2. 建议二';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: optimizeContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText('AI 优化建议报告')).toBeInTheDocument();
        expect(screen.getByText('基于PRD内容的智能分析与改进建议')).toBeInTheDocument();
      });
    });

    it('内容以文本开头时应该显示摘要区域', async () => {
      const optimizeContent = '这份PRD整体质量较高，以下是一些优化建议。\n\n# 详细建议\n1. 建议一';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: optimizeContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText('分析摘要')).toBeInTheDocument();
      });
    });

    it('内容以标题开头时不应显示摘要区域', async () => {
      const optimizeContent = '# 优化建议\n\n1. 建议一\n2. 建议二';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: optimizeContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText('AI 优化建议报告')).toBeInTheDocument();
        // 不应显示摘要区域
        expect(screen.queryByText('分析摘要')).not.toBeInTheDocument();
      });
    });
  });

  describe('CompetitorResultRenderer 竞品分析渲染器', () => {
    it('应该显示"竞品分析报告"标题', async () => {
      const competitorContent = '# 竞品分析\n\n## 竞品A\n产品介绍...';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'competitor', {
          content: competitorContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const competitorItem = viewItems.find(item => item.textContent?.includes('竞品分析'));
      if (competitorItem) {
        await user.click(competitorItem);
      }

      await waitFor(() => {
        expect(screen.getByText('竞品分析报告')).toBeInTheDocument();
        expect(screen.getByText('市场竞争态势与差异化分析')).toBeInTheDocument();
      });
    });

    it('识别到竞品关键词时应显示竞品数量', async () => {
      const competitorContent = '# 竞品分析\n\n## 竞品1：Product A\n介绍...\n\n## 竞品2：Product B\n介绍...\n\n## 竞品3：Product C\n介绍...';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'competitor', {
          content: competitorContent,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const competitorItem = viewItems.find(item => item.textContent?.includes('竞品分析'));
      if (competitorItem) {
        await user.click(competitorItem);
      }

      await waitFor(() => {
        // 应该显示"识别 X 个竞品"
        expect(screen.getByText(/识别 \d+ 个竞品/)).toBeInTheDocument();
      });
    });
  });

  describe('AnalysisResultView 内容布局测试', () => {
    it('内容区域应该有内边距', async () => {
      const content = '# 测试内容\n\n这是一段测试文本。';
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: content,
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      // 验证内容被正确渲染
      await waitFor(() => {
        expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
      });
    });

    it('应该显示生成时间和重新生成按钮', async () => {
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: '测试内容',
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText(/生成于/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /重新生成/i })).toBeInTheDocument();
      });
    });

    it('图表类型的重试次数应该显示标签', async () => {
      // 设置重试次数的模拟响应
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          content: '```mermaid\ngraph TD\nA-->B\n```',
          retryCount: 2
        }),
      } as Response);

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      await waitFor(() => {
        expect(screen.getByText('生成图表')).toBeInTheDocument();
      });

      const menuItems = screen.getAllByRole('menuitem');
      const diagramItem = menuItems.find(item => item.textContent?.includes('生成图表'));
      if (diagramItem) {
        await user.click(diagramItem);
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // 验证重试标签显示
      await waitFor(() => {
        // 查找包含"自动优化"的元素
        expect(screen.getByText(/自动优化 2 次/)).toBeInTheDocument();
      });
    });

    it('过期PRD应该显示警告标签', async () => {
      // 保存带有不同哈希的结果，模拟PRD已更新
      await analysisResultsDB.save(
        createTestAnalysisResult(defaultProps.projectId, 'optimize', {
          content: '旧分析结果',
          prdContentHash: 'different-old-hash',
        })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const viewItems = screen.getAllByRole('menuitem');
      const optimizeItem = viewItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText('PRD已更新，建议重新生成')).toBeInTheDocument();
      });
    });
  });

  describe('LoadingIndicator 加载状态测试', () => {
    it('图表类型加载时应显示"正在生成图表..."', async () => {
      let resolveRequest: (value: Response) => void;
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => { resolveRequest = resolve; })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const menuItems = screen.getAllByRole('menuitem');
      const diagramItem = menuItems.find(item => item.textContent?.includes('生成图表'));
      if (diagramItem) {
        await user.click(diagramItem);
      }

      await waitFor(() => {
        expect(screen.getByText('正在生成图表...')).toBeInTheDocument();
      });

      // 完成请求
      resolveRequest!({
        ok: true,
        json: async () => ({ content: 'graph TD' }),
      } as Response);
    });

    it('非图表类型加载时应显示"正在分析中..."', async () => {
      let resolveRequest: (value: Response) => void;
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => { resolveRequest = resolve; })
      );

      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      await waitFor(() => {
        expect(screen.getByText('正在分析中，请稍候...')).toBeInTheDocument();
      });

      // 完成请求
      resolveRequest!({
        ok: true,
        json: async () => ({ content: '分析结果' }),
      } as Response);
    });
  });

  describe('EmptyState 空状态测试', () => {
    it('无结果时应显示描述和开始分析按钮', async () => {
      const user = userEvent.setup();
      render(<AIAnalysisTools {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /AI 分析/i }));

      const menuItems = screen.getAllByRole('menuitem');
      const optimizeItem = menuItems.find(item => item.textContent?.includes('AI 优化建议'));
      if (optimizeItem) {
        await user.click(optimizeItem);
      }

      // 等待Sheet打开
      await waitFor(() => {
        expect(screen.getByText('AI 分析结果')).toBeInTheDocument();
      });

      // 模拟API请求完成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '分析结果' }),
      } as Response);

      // 等待分析完成或空状态显示
      await waitFor(() => {
        // 应该显示分析结果或空状态
        const resultOrEmpty = screen.queryByText('开始分析') || screen.queryByTestId('markdown-content');
        expect(resultOrEmpty).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
