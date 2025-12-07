'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Loader2, 
  ChevronDown,
  Lightbulb,
  Award,
  Users,
  Network,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidRenderer } from './mermaid-renderer';
import { toast } from 'sonner';
import { analysisResultsDB } from '@/lib/db';
import type { AnalysisResult, AnalysisType } from '@/types';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface AIAnalysisToolsProps {
  projectId: string;
  prdContent: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
  customModelName?: string;
}

// 简单的hash函数用于比较PRD内容是否变化
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  
  if (diff < 60 * 1000) {
    return '刚刚';
  } else if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`;
  } else if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  } else if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}

// 分析结果状态
interface AnalysisState {
  content: string;
  updatedAt: number | null;
  isOutdated: boolean;  // PRD内容已变化
}

const ANALYSIS_OPTIONS = [
  {
    type: 'optimize' as AnalysisType,
    label: 'AI 优化建议',
    icon: Lightbulb,
    description: '从多个维度分析PRD并给出改进建议',
  },
  {
    type: 'score' as AnalysisType,
    label: '质量评分',
    icon: Award,
    description: '对PRD进行专业评分和评级',
  },
  {
    type: 'competitor' as AnalysisType,
    label: '竞品分析',
    icon: Users,
    description: '识别竞争对手并进行对比分析',
  },
  {
    type: 'diagram' as AnalysisType,
    label: '生成图表',
    icon: Network,
    description: '生成架构图、流程图、ER图',
  },
];

export function AIAnalysisTools({ 
  projectId,
  prdContent, 
  model, 
  apiKey, 
  customApiUrl,
  customModelName 
}: AIAnalysisToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisType>('optimize');
  const [results, setResults] = useState<Record<AnalysisType, AnalysisState>>({
    optimize: { content: '', updatedAt: null, isOutdated: false },
    score: { content: '', updatedAt: null, isOutdated: false },
    competitor: { content: '', updatedAt: null, isOutdated: false },
    diagram: { content: '', updatedAt: null, isOutdated: false },
  });
  const [loading, setLoading] = useState<Record<AnalysisType, boolean>>({
    optimize: false,
    score: false,
    competitor: false,
    diagram: false,
  });

  // 计算当前PRD内容的hash
  const currentPrdHash = simpleHash(prdContent);

  // 加载已保存的分析结果
  const loadSavedResults = useCallback(async () => {
    try {
      const savedResults = await analysisResultsDB.getByProject(projectId);
      if (savedResults.length > 0) {
        const newResults = { ...results };
        savedResults.forEach((result: AnalysisResult) => {
          const type = result.type as AnalysisType;
          newResults[type] = {
            content: result.content,
            updatedAt: result.updatedAt,
            isOutdated: result.prdContentHash !== currentPrdHash,
          };
        });
        setResults(newResults);
      }
    } catch (error) {
      console.error('Failed to load saved analysis results:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentPrdHash]);

  useEffect(() => {
    loadSavedResults();
  }, [loadSavedResults]);

  // 执行分析并保存结果
  const handleAnalyze = async (type: AnalysisType) => {
    if (!prdContent.trim()) {
      toast.error('没有PRD内容可分析');
      return;
    }

    if (!apiKey) {
      toast.error('请先配置 API Key');
      return;
    }

    setLoading(prev => ({ ...prev, [type]: true }));
    setActiveTab(type);
    setIsOpen(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          prdContent,
          model,
          apiKey,
          customApiUrl,
          customModelName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '分析失败');
      }

      const data = await response.json();
      const now = Date.now();
      
      // 保存到数据库
      await analysisResultsDB.save({
        id: `${projectId}_${type}`,
        projectId,
        type,
        content: data.content,
        prdContentHash: currentPrdHash,
      });

      setResults(prev => ({ 
        ...prev, 
        [type]: { 
          content: data.content, 
          updatedAt: now,
          isOutdated: false 
        } 
      }));
      
      toast.success('分析完成并已保存');
    } catch (error) {
      console.error('Analysis error:', error);
      
      if (error instanceof Error) {
        let errorMessage = error.message;
        let suggestion: string | undefined;
        
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.error) {
            errorMessage = errorData.error;
            suggestion = errorData.suggestion;
          }
        } catch {
          // 非JSON错误,使用原始消息
        }
        
        toast.error(errorMessage, {
          description: suggestion,
          duration: 5000,
        });
      } else {
        toast.error('分析失败,请检查网络连接');
      }
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // 查看已有结果
  const handleViewResult = (type: AnalysisType) => {
    setActiveTab(type);
    setIsOpen(true);
  };

  const hasContent = prdContent.trim().length > 0;
  
  // 计算已有结果数量
  const savedCount = Object.values(results).filter(r => r.content).length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-2"
            disabled={!hasContent}
          >
            <Sparkles className="h-4 w-4" />
            AI 分析
            {savedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {savedCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {/* 查看已有结果 */}
          {savedCount > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                已保存的分析结果
              </div>
              {ANALYSIS_OPTIONS.filter(opt => results[opt.type].content).map((option) => {
                const result = results[option.type];
                return (
                  <DropdownMenuItem
                    key={`view-${option.type}`}
                    onClick={() => handleViewResult(option.type)}
                    className="flex items-start gap-3 py-2"
                  >
                    <Eye className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {result.isOutdated && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            已过期
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {result.updatedAt ? formatTime(result.updatedAt) : '未知'}
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}
          
          {/* 生成新分析 */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {savedCount > 0 ? '重新生成' : '生成分析'}
          </div>
          {ANALYSIS_OPTIONS.map((option) => {
            const hasResult = results[option.type].content;
            return (
              <DropdownMenuItem
                key={option.type}
                onClick={() => handleAnalyze(option.type)}
                disabled={loading[option.type]}
                className="flex items-start gap-3 py-2"
              >
                {hasResult ? (
                  <RefreshCw className="h-4 w-4 mt-0.5" />
                ) : (
                  <option.icon className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    {hasResult ? `重新生成${option.label}` : option.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </div>
                {loading[option.type] && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-[90vw]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI 分析结果
            </SheetTitle>
            <SheetDescription>
              基于PRD内容的智能分析（结果已自动保存）
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisType)} className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              {ANALYSIS_OPTIONS.map((option) => {
                const hasResult = results[option.type].content;
                const isOutdated = results[option.type].isOutdated;
                return (
                  <TabsTrigger 
                    key={option.type} 
                    value={option.type}
                    className="gap-1.5 text-xs sm:text-sm relative"
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{option.label}</span>
                    {hasResult && (
                      <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${isOutdated ? 'bg-amber-500' : 'bg-green-500'}`} />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {ANALYSIS_OPTIONS.map((option) => {
              const result = results[option.type];
              return (
                <TabsContent 
                  key={option.type} 
                  value={option.type}
                  className="mt-4"
                >
                  {loading[option.type] ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground">
                        正在分析中，请稍候...
                      </p>
                    </div>
                  ) : result.content ? (
                    <div className="space-y-3">
                      {/* 状态栏 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          <span>生成于 {result.updatedAt ? formatTime(result.updatedAt) : '未知'}</span>
                          {result.isOutdated && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              PRD已更新，建议重新生成
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs gap-1"
                          onClick={() => handleAnalyze(option.type)}
                          disabled={loading[option.type]}
                        >
                          <RefreshCw className="h-3 w-3" />
                          重新生成
                        </Button>
                      </div>
                      
                      {/* 内容 */}
                      <ScrollArea className="h-[calc(100vh-300px)]">
                        <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                          {option.type === 'diagram' ? (
                            <MermaidRenderer content={result.content} />
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {result.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <option.icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {option.description}
                      </p>
                      <Button onClick={() => handleAnalyze(option.type)} disabled={loading[option.type]}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        开始分析
                      </Button>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
