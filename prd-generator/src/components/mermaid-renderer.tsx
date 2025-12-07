'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface MermaidRendererProps {
  content: string;
}

/**
 * Mermaid图表渲染组件
 * - 自动检测并渲染Markdown中的Mermaid代码块
 * - 支持主题适配(浅色/深色模式)
 * - 错误降级:语法错误时显示源代码和复制按钮
 * - 响应式布局:SVG自适应容器宽度
 */
// 从Markdown内容中提取Mermaid代码块
const extractMermaidCode = (text: string): string | null => {
  // 匹配 ```mermaid ... ``` 代码块
  const match = text.match(/```mermaid\s*\n([\s\S]*?)\n```/i);
  return match ? match[1].trim() : null;
};

export function MermaidRenderer({ content }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { theme, systemTheme } = useTheme();

  // 预先提取 mermaid 代码
  const mermaidCode = extractMermaidCode(content) || '';

  // 如果没有代码，直接显示错误信息，不通过 effect
  const error = !mermaidCode ? '未找到Mermaid代码块' : renderError;

  useEffect(() => {
    if (!mermaidCode) {
      return;
    }

    // 配置Mermaid主题
    const currentTheme = theme === 'system' ? systemTheme : theme;
    const mermaidTheme = currentTheme === 'dark' ? 'dark' : 'default';

    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'loose',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      themeVariables: {
        fontSize: '14px',
      },
    });

    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        setRenderError(null);
        
        // 生成唯一ID
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 渲染Mermaid图表
        const { svg } = await mermaid.render(id, mermaidCode);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          
          // 设置SVG响应式属性
          const svgElement = containerRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
          }
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setRenderError(`图表渲染失败: ${errorMessage}`);
      }
    };

    renderDiagram();
  }, [mermaidCode, theme, systemTheme]);

  // 复制Mermaid代码到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // 错误降级:显示源代码
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-destructive">{error}</p>
            <p className="text-muted-foreground mt-1">
              显示Mermaid源代码,您可以复制到支持Mermaid的编辑器中查看
            </p>
          </div>
        </div>
        
        <div className="relative">
          <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-96">
            <code>{mermaidCode}</code>
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="absolute top-2 right-2"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                复制代码
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="mermaid-container p-4 bg-card border rounded-lg overflow-auto"
        style={{ minHeight: '200px' }}
      />
      {mermaidCode && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Mermaid图表</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 text-xs"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已复制源码
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                复制源码
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
