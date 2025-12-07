/**
 * export.ts 边界测试
 * 测试导出功能的各种边界场景和浏览器兼容性
 */

// 测试文件中mock类型问题 - 使用类型断言替代@ts-nocheck

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  exportMarkdown,
  exportJSON,
  exportPDF,
  exportWord,
  copyToClipboard,
} from '@/lib/export';
import { saveAs } from 'file-saver';

// file-saver 已通过 jest.config.js 的 moduleNameMapper 自动 mock

describe('export.ts - 导出功能边界测试', () => {
  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
  });

  describe('exportMarkdown - MD文件导出边界', () => {
    it('应该导出正常的Markdown内容', () => {
      // 功能验证：标准导出
      const content = '# 测试PRD\n\n这是内容';
      const filename = '测试文档';
      
      exportMarkdown(content, filename);
      
      expect(saveAs).toHaveBeenCalledTimes(1);
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/markdown;charset=utf-8');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][1]).toBe('测试文档.md');
    });

    it('应该处理空内容导出', () => {
      // 数据边界：空字符串
      exportMarkdown('', 'empty');
      
      expect(saveAs).toHaveBeenCalledTimes(1);
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      expect(blob.size).toBeGreaterThanOrEqual(0);
    });

    it('应该处理超长内容（模拟10MB）', () => {
      // 数据边界：大文件
      const longContent = 'A'.repeat(10 * 1024 * 1024); // 10MB
      
      exportMarkdown(longContent, 'large');
      
      expect(saveAs).toHaveBeenCalled();
      // 验证不崩溃即可
    });

    it('应该处理包含特殊字符的内容', () => {
      // 数据边界：特殊字符
      const content = '# 测试\n\n😀 emoji\n\n特殊符号：<>&"\'';
      
      exportMarkdown(content, 'special');
      
      expect(saveAs).toHaveBeenCalled();
    });

    it('应该处理文件名中的非法字符', () => {
      // 数据边界：文件名清理（虽然saveAs可能会处理）
      const content = '测试';
      const filename = '项目<>:?|/*.md';
      
      // 不应该抛异常
      expect(() => exportMarkdown(content, filename)).not.toThrow();
    });
  });

  describe('exportJSON - JSON文件导出边界', () => {
    it('应该导出标准对象', () => {
      // 功能验证：对象序列化
      const data = { name: '测试项目', items: [1, 2, 3] };
      const filename = 'data';
      
      exportJSON(data, filename);
      
      expect(saveAs).toHaveBeenCalledTimes(1);
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      expect(blob.type).toBe('application/json;charset=utf-8');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][1]).toBe('data.json');
    });

    it('应该处理空对象', () => {
      // 数据边界：空对象
      exportJSON({}, 'empty');
      
      expect(saveAs).toHaveBeenCalled();
    });

    it('应该处理复杂嵌套对象', () => {
      // 数据边界：深度嵌套
      const data = {
        level1: {
          level2: {
            level3: {
              value: '深度嵌套'
            }
          }
        }
      };
      
      exportJSON(data, 'nested');
      
      expect(saveAs).toHaveBeenCalled();
    });

    it('应该格式化JSON（带缩进）', async () => {
      // 功能验证：美化输出
      const data = { a: 1, b: 2 };
      
      exportJSON(data, 'formatted');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('\n'); // 应该有换行（格式化）
      expect(text).toContain('  '); // 应该有缩进
    });
  });

  describe('exportPDF - PDF导出边界', () => {
    let mockWindow: {
      document: { write: jest.Mock; close: jest.Mock };
      print: jest.Mock;
      close: jest.Mock;
      onload: (() => void) | null;
      closed: boolean;
    };
    let originalOpen: typeof window.open;

    beforeEach(() => {
      originalOpen = window.open;
      mockWindow = {
        document: {
          write: jest.fn(),
          close: jest.fn(),
        },
        print: jest.fn(),
        close: jest.fn(),
        onload: null,
        closed: false,
      };
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('应该成功打开打印窗口', () => {
      // 功能验证：正常打印流程
      window.open = jest.fn().mockReturnValue(mockWindow) as unknown as typeof window.open;
      
      const content = '# 测试PRD\n\n内容';
      exportPDF(content, '测试文档');
      
      expect(window.open).toHaveBeenCalledWith('', '_blank');
      expect(mockWindow.document.write).toHaveBeenCalled();
      expect(mockWindow.document.close).toHaveBeenCalled();
    });

    it('应该在窗口被阻止时抛出错误', () => {
      // 用户交互边界：弹窗阻止
      window.open = jest.fn().mockReturnValue(null) as unknown as typeof window.open;
      
      expect(() => {
        exportPDF('内容', '文档');
      }).toThrow('无法打开打印窗口');
    });

    it('应该处理空内容', () => {
      // 数据边界：空字符串
      window.open = jest.fn().mockReturnValue(mockWindow) as unknown as typeof window.open;
      
      exportPDF('', 'empty');
      
      expect(mockWindow.document.write).toHaveBeenCalled();
    });

    it('应该包含正确的打印样式', () => {
      // 功能验证：CSS样式
      window.open = jest.fn().mockReturnValue(mockWindow) as unknown as typeof window.open;
      
      exportPDF('# 标题', '文档');
      
      const htmlContent = (mockWindow.document.write as jest.Mock).mock.calls[0][0];
      expect(htmlContent).toContain('@media print');
      expect(htmlContent).toContain('font-family');
      expect(htmlContent).toContain('line-height');
    });

    it('应该设置onload和延时打印', () => {
      // 时间边界：备用打印
      window.open = jest.fn().mockReturnValue(mockWindow) as unknown as typeof window.open;
      jest.useFakeTimers();
      
      exportPDF('内容', '文档');
      
      // 验证设置了onload
      expect(mockWindow.onload).toBeDefined();
      
      // 验证延时打印（500ms）
      jest.advanceTimersByTime(500);
      expect(mockWindow.print).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('应该在onload触发后不重复打印', () => {
      // 时间边界：避免重复
      window.open = jest.fn().mockReturnValue(mockWindow) as unknown as typeof window.open;
      jest.useFakeTimers();
      
      exportPDF('内容', '文档');
      
      // 模拟onload立即触发
      mockWindow.onload();
      expect(mockWindow.print).toHaveBeenCalledTimes(1);
      
      // 模拟窗口已关闭
      mockWindow.closed = true;
      jest.advanceTimersByTime(500);
      // 不应该再次打印
      expect(mockWindow.print).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });

  describe('exportWord - Word文档导出边界', () => {
    it('应该导出Word格式文件', () => {
      // 功能验证：Word导出
      const content = '# 标题\n\n内容';
      
      exportWord(content, '文档');
      
      expect(saveAs).toHaveBeenCalled();
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      expect(blob.type).toBe('application/msword;charset=utf-8');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][1]).toBe('文档.doc');
    });

    it('应该包含Office XML声明', async () => {
      // 功能验证：Office格式
      exportWord('测试', '文档');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
      expect(text).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    });

    it('应该包含中文字体支持', async () => {
      // 功能验证：字体配置
      exportWord('中文内容', '文档');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('Microsoft YaHei');
      expect(text).toContain('微软雅黑');
    });
  });

  describe('copyToClipboard - 剪贴板操作边界', () => {
    let originalClipboard: typeof navigator.clipboard;
    let originalExecCommand: typeof document.execCommand;

    beforeEach(() => {
      originalClipboard = navigator.clipboard;
      originalExecCommand = document.execCommand;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      });
      document.execCommand = originalExecCommand;
    });

    it('应该使用Clipboard API复制', async () => {
      // 功能验证：现代API
      const mockWriteText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });
      
      await copyToClipboard('测试文本');
      
      expect(mockWriteText).toHaveBeenCalledWith('测试文本');
    });

    it('应该在Clipboard API失败时降级', async () => {
      // 兼容性边界：降级方案
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error('Permission denied'))),
        },
        writable: true,
      });
      
      document.execCommand = jest.fn(() => true);
      
      // 应该不抛异常
      await expect(copyToClipboard('测试')).resolves.not.toThrow();
    });

    it('应该使用execCommand作为fallback', async () => {
      // 兼容性边界：旧版浏览器
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });
      
      const mockExecCommand = jest.fn(() => true);
      document.execCommand = mockExecCommand;
      
      await copyToClipboard('测试文本');
      
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
    });

    it('应该在fallback时创建临时textarea', async () => {
      // 兼容性边界：DOM操作
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });
      
      document.execCommand = jest.fn(() => true);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');
      
      await copyToClipboard('测试');
      
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('应该处理空字符串', async () => {
      // 数据边界：空文本
      const mockWriteText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });
      
      await copyToClipboard('');
      
      expect(mockWriteText).toHaveBeenCalledWith('');
    });

    it('应该处理超长文本', async () => {
      // 数据边界：大数据
      const longText = 'A'.repeat(100000);
      const mockWriteText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });
      
      await copyToClipboard(longText);
      
      expect(mockWriteText).toHaveBeenCalledWith(longText);
    });
  });

  describe('Markdown转HTML边界测试', () => {
    // 内部函数测试需要通过导出函数间接测试
    it('应该正确转换标题', async () => {
      // 功能验证：标题转换
      exportWord('# H1\n## H2\n### H3', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
    });

    it('应该正确转换粗体和斜体', async () => {
      // 功能验证：文本样式
      exportWord('**粗体** *斜体* ***粗斜体***', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    it('应该正确转换代码块', async () => {
      // 功能验证：代码格式
      exportWord('```\ncode block\n```\n\n`inline code`', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<pre><code>');
      expect(html).toContain('<code>');
    });

    it('应该正确转换列表', async () => {
      // 功能验证：列表转换
      exportWord('- 项目1\n- 项目2\n\n1. 有序1\n2. 有序2', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<li>');
    });

    it('应该正确转换链接', async () => {
      // 功能验证：链接转换
      exportWord('[文本](http://example.com)', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<a href="http://example.com">文本</a>');
    });

    it('应该处理链接中的特殊字符', async () => {
      // 数据边界：URL特殊字符
      exportWord('[test](http://example.com?x=1&y=2)', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      // 应该包含链接，特殊字符可能被转义
      expect(html).toContain('href=');
    });

    it('应该处理换行符', async () => {
      // 数据边界：换行处理
      exportWord('行1\n行2\n\n段落2', 'test');
      
      const blob = (saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][0] as Blob;
      const html = await blob.text();
      expect(html).toContain('<br>');
      expect(html).toContain('</p><p>');
    });
  });

  describe('并发导出边界测试', () => {
    it('应该支持连续导出请求', () => {
      // 并发边界：连续调用
      exportMarkdown('内容1', '文件1');
      exportMarkdown('内容2', '文件2');
      exportMarkdown('内容3', '文件3');
      
      expect(saveAs).toHaveBeenCalledTimes(3);
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][1]).toBe('文件1.md');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[1][1]).toBe('文件2.md');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[2][1]).toBe('文件3.md');
    });

    it('应该独立处理不同格式的导出', () => {
      // 并发边界：多格式
      exportMarkdown('MD内容', 'file');
      exportJSON({ data: 'JSON' }, 'file');
      exportWord('Word内容', 'file');
      
      expect(saveAs).toHaveBeenCalledTimes(3);
      // 验证文件扩展名不同
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[0][1]).toBe('file.md');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[1][1]).toBe('file.json');
      expect((saveAs as jest.MockedFunction<typeof saveAs>).mock.calls[2][1]).toBe('file.doc');
    });
  });
});
