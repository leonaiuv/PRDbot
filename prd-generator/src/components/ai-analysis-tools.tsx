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
  CheckCircle2,
  BarChart3,
  Target,
  TrendingUp,
  AlertCircle,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidRenderer } from './mermaid-renderer';
import { toast } from 'sonner';
import { analysisResultsDB } from '@/lib/db';
import type { AnalysisResult, AnalysisType } from '@/types';
import { cn } from '@/lib/utils';

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
  retryCount?: number;  // 重试次数（仅图表类型）
}

// 加载状态
interface LoadingState {
  isLoading: boolean;
  retryCount?: number;
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

// 加载状态指示器组件
function LoadingIndicator({ type, retryCount }: { type: AnalysisType; retryCount?: number }) {
  const isDiagram = type === 'diagram';
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        {isDiagram && (
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
            <Network className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-4">
        {isDiagram ? '正在生成图表...' : '正在分析中，请稍候...'}
      </p>
      {isDiagram && retryCount !== undefined && retryCount > 0 && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>正在优化图表格式（重试 {retryCount} 次）</span>
        </div>
      )}
    </div>
  );
}

// 空状态组件
function EmptyState({ 
  icon: Icon, 
  description, 
  onAnalyze, 
  isLoading 
}: { 
  icon: React.ElementType; 
  description: string; 
  onAnalyze: () => void; 
  isLoading: boolean; 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      </div>
      <p className="text-muted-foreground mb-4 max-w-xs">
        {description}
      </p>
      <Button onClick={onAnalyze} disabled={isLoading} className="gap-2">
        <Sparkles className="h-4 w-4" />
        开始分析
      </Button>
    </div>
  );
}

// 分析结果展示组件
function AnalysisResultView({ 
  type, 
  result, 
  onRefresh, 
  isLoading 
}: { 
  type: AnalysisType; 
  result: AnalysisState; 
  onRefresh: () => void; 
  isLoading: boolean; 
}) {
  return (
    <div className="space-y-4">
      {/* 状态栏 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-3 border-b mx-1">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>生成于 {result.updatedAt ? formatTime(result.updatedAt) : '未知'}</span>
          {result.isOutdated && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              PRD已更新，建议重新生成
            </Badge>
          )}
          {type === 'diagram' && result.retryCount !== undefined && result.retryCount > 0 && (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              自动优化 {result.retryCount} 次
            </Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className="h-3 w-3" />
          重新生成
        </Button>
      </div>
      
      {/* 内容区域 - 增加内边距优化排版 */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="px-4 py-2">
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:text-foreground
            prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-4
            prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
            prose-p:my-3 prose-p:leading-relaxed prose-p:text-muted-foreground
            prose-ul:my-3 prose-ul:pl-4
            prose-ol:my-3 prose-ol:pl-4
            prose-li:my-1 prose-li:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-semibold
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-muted prose-pre:border prose-pre:border-border
            prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4
            prose-table:border-collapse
            prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-border
            prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border
          ">
            {type === 'diagram' ? (
              <MermaidRenderer content={result.content} />
            ) : type === 'score' ? (
              <ScoreResultRenderer content={result.content} />
            ) : type === 'optimize' ? (
              <OptimizeResultRenderer content={result.content} />
            ) : type === 'competitor' ? (
              <CompetitorResultRenderer content={result.content} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// 评分结果专用渲染器
function ScoreResultRenderer({ content }: { content: string }) {
  // 尝试提取总分
  const scoreMatch = content.match(/总分[:：]\s*(\d+)/i);
  const totalScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
  
  // 根据分数确定颜色和等级
  const getScoreConfig = (score: number) => {
    if (score >= 90) return { 
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      label: '优秀',
      icon: '🏆'
    };
    if (score >= 80) return { 
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      label: '良好',
      icon: '👍'
    };
    if (score >= 70) return { 
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      label: '合格',
      icon: '📝'
    };
    return { 
      color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      label: '待改进',
      icon: '⚠️'
    };
  };
  
  const scoreConfig = totalScore !== null ? getScoreConfig(totalScore) : null;
  
  return (
    <div className="space-y-6">
      {/* 评分卡片 */}
      {totalScore !== null && scoreConfig && (
        <div className={cn(
          "flex items-center justify-between p-5 rounded-xl border-2 shadow-sm",
          scoreConfig.color
        )}>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/50 dark:bg-black/20">
              <span className="text-3xl">{scoreConfig.icon}</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{totalScore}</span>
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
              <div className="text-sm font-medium mt-1">{scoreConfig.label}</div>
            </div>
          </div>
          <BarChart3 className="h-10 w-10 opacity-50" />
        </div>
      )}
      
      {/* 详细内容 */}
      <div className="bg-muted/30 rounded-lg p-5 border">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// 优化建议专用渲染器
function OptimizeResultRenderer({ content }: { content: string }) {
  // 尝试提取分析摘要（第一段内容）
  const lines = content.split('\n').filter(line => line.trim());
  const hasSummary = lines[0] && !lines[0].startsWith('#') && lines[0].length > 20;
  const summary = hasSummary ? lines[0] : null;
  const mainContent = hasSummary ? lines.slice(1).join('\n') : content;
  
  return (
    <div className="space-y-5">
      {/* 标题卡片 */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">AI 优化建议报告</h3>
          <p className="text-xs text-muted-foreground">基于PRD内容的智能分析与改进建议</p>
        </div>
      </div>
      
      {/* 摘要区域 */}
      {summary && (
        <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">分析摘要</span>
              <p className="text-sm text-foreground leading-relaxed">{summary}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 详细内容 */}
      <div className="bg-card rounded-lg p-5 border shadow-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {mainContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// 竞品分析专用渲染器
function CompetitorResultRenderer({ content }: { content: string }) {
  // 尝试识别竞品数量
  const competitorMatches = content.match(/竞品[\d一二三四五六七八九十]+|竞争对手[\d一二三四五六七八九十]+|(?:###?\s*\d+\.|[-*]\s*\*\*)/g);
  const competitorCount = competitorMatches ? Math.min(competitorMatches.length, 5) : null;
  
  return (
    <div className="space-y-5">
      {/* 标题卡片 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-800/50">
            <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-violet-700 dark:text-violet-300">竞品分析报告</h3>
            <p className="text-xs text-violet-600/70 dark:text-violet-400/70">市场竞争态势与差异化分析</p>
          </div>
        </div>
        {competitorCount && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 dark:bg-violet-800/50 rounded-full">
            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">识别 {competitorCount} 个竞品</span>
          </div>
        )}
      </div>
      
      {/* 详细内容 */}
      <div className="bg-card rounded-lg p-5 border shadow-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

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
  const [loading, setLoading] = useState<Record<AnalysisType, LoadingState>>({
    optimize: { isLoading: false },
    score: { isLoading: false },
    competitor: { isLoading: false },
    diagram: { isLoading: false },
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

    setLoading(prev => ({ ...prev, [type]: { isLoading: true, retryCount: 0 } }));
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

      // 如果有重试次数，更新loading状态显示
      if (data.retryCount !== undefined && data.retryCount > 0) {
        setLoading(prev => ({ ...prev, [type]: { isLoading: true, retryCount: data.retryCount } }));
      }
      
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
          isOutdated: false,
          retryCount: data.retryCount,
        } 
      }));
      
      if (type === 'diagram' && data.retryCount > 0) {
        toast.success(`图表生成完成（重试${data.retryCount}次后成功）`);
      } else {
        toast.success('分析完成并已保存');
      }
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
      setLoading(prev => ({ ...prev, [type]: { isLoading: false } }));
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
            const loadingState = loading[option.type];
            return (
              <DropdownMenuItem
                key={option.type}
                onClick={() => handleAnalyze(option.type)}
                disabled={loadingState.isLoading}
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
                {loadingState.isLoading && (
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
              const loadingState = loading[option.type];
              return (
                <TabsContent 
                  key={option.type} 
                  value={option.type}
                  className="mt-4"
                >
                  {loadingState.isLoading ? (
                    <LoadingIndicator 
                      type={option.type} 
                      retryCount={loadingState.retryCount} 
                    />
                  ) : result.content ? (
                    <AnalysisResultView
                      type={option.type}
                      result={result}
                      onRefresh={() => handleAnalyze(option.type)}
                      isLoading={loadingState.isLoading}
                    />
                  ) : (
                    <EmptyState
                      icon={option.icon}
                      description={option.description}
                      onAnalyze={() => handleAnalyze(option.type)}
                      isLoading={loadingState.isLoading}
                    />
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
