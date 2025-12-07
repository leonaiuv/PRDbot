'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy, CheckCircle2, ChevronDown, ChevronUp, Network, GitBranch, Database } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MermaidRendererProps {
  content: string;
}

/**
 * Mermaid图表渲染组件
 * - 自动检测并渲染Markdown中的Mermaid代码块
 * - 支持多图表渲染
 * - 支持主题适配(浅色/深色模式)
 * - 错误降级:语法错误时显示源代码和复制按钮
 * - 响应式布局:SVG自适应容器宽度
 */

// 图表类型图标映射
const diagramIcons: Record<string, React.ElementType> = {
  'graph': Network,
  'flowchart': GitBranch,
  'erDiagram': Database,
  'sequenceDiagram': GitBranch,
  'classDiagram': Network,
};

// 图表类型名称映射
const diagramTypeNames: Record<string, string> = {
  'graph': '架构图',
  'flowchart': '流程图',
  'erDiagram': '数据模型图',
  'sequenceDiagram': '时序图',
  'classDiagram': '类图',
};

// 提取图表类型
function getDiagramType(code: string): string {
  const trimmed = code.trim();
  for (const type of Object.keys(diagramTypeNames)) {
    if (trimmed.startsWith(type)) {
      return type;
    }
  }
  return 'graph';
}

// 提取标题（从注释或标题行）
function extractTitle(text: string, index: number): string {
  // 尝试从内容上方的标题行提取
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith('##')) {
      return line.replace(/^#+\s*\d*\.?\s*/, '').trim();
    }
  }
  return `图表 ${index + 1}`;
}
// 从Mermaid内容中提取所有代码块
const extractAllMermaidBlocks = (text: string): { code: string; title: string; type: string }[] => {
  const blocks: { code: string; title: string; type: string }[] = [];
  // 使用RegExp构造函数避免换行符问题
  const regex = new RegExp('(?:##\\s*\\d*\\.?\\s*([^\\n]*)\\n*)?```mermaid\\s*\\n([\\s\\S]*?)\\n```', 'gi');
  
  let match;
  let index = 0;
  while ((match = regex.exec(text)) !== null) {
    const title = match[1]?.trim() || extractTitle(text.substring(0, match.index), index);
    const code = match[2]?.trim() || '';
    const type = getDiagramType(code);
    blocks.push({ code, title, type });
    index++;
  }
  
  return blocks;
};

// 从Mermaid内容中提取单个代码块（兼容旧版）
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

  // 获取图表类型信息
  const diagramType = getDiagramType(mermaidCode);
  const DiagramIcon = diagramIcons[diagramType] || Network;
  const typeName = diagramTypeNames[diagramType] || '图表';

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
          <div className="flex items-center gap-2">
            <DiagramIcon className="h-3.5 w-3.5" />
            <span>{typeName}</span>
          </div>
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

/**
 * 多图表渲染组件
 * 支持渲染多个图表，每个图表可展开/收起
 */
interface MultiDiagramRendererProps {
  content: string;
}

export function MultiDiagramRenderer({ content }: MultiDiagramRendererProps) {
  const blocks = extractAllMermaidBlocks(content);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set(blocks.map((_, i) => i)));

  if (blocks.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">未找到Mermaid图表内容</span>
      </div>
    );
  }

  const toggleExpand = (index: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 如果只有一个图表，直接渲染
  if (blocks.length === 1) {
    const block = blocks[0];
    const DiagramIcon = diagramIcons[block.type] || Network;
    
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <DiagramIcon className="h-4 w-4 text-primary" />
          <span>{block.title}</span>
        </div>
        <SingleDiagramRenderer code={block.code} />
      </div>
    );
  }

  // 多个图表使用可折叠卡片
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Network className="h-4 w-4" />
        <span>共 {blocks.length} 个图表</span>
      </div>
      
      {blocks.map((block, index) => {
        const isExpanded = expandedIndices.has(index);
        const DiagramIcon = diagramIcons[block.type] || Network;
        
        return (
          <div key={index} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(index)}
              className={cn(
                "w-full flex items-center justify-between p-3 text-left transition-colors",
                "hover:bg-muted/50",
                isExpanded && "border-b"
              )}
            >
              <div className="flex items-center gap-2">
                <DiagramIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{block.title}</span>
                <span className="text-xs text-muted-foreground">
                  ({diagramTypeNames[block.type] || '图表'})
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {isExpanded && (
              <div className="p-3">
                <SingleDiagramRenderer code={block.code} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 单个图表渲染器（仅渲染代码）
 */
function SingleDiagramRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    if (!code) {
      return;
    }

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
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
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
  }, [code, theme, systemTheme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  if (renderError) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
          <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
          <span className="text-destructive">{renderError}</span>
        </div>
        <div className="relative">
          <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48">
            <code>{code}</code>
          </pre>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="absolute top-1 right-1 h-6 text-xs"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="mermaid-container bg-card rounded overflow-auto"
        style={{ minHeight: '150px' }}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-6 text-xs"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              复制源码
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
