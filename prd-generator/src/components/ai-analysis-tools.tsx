'use client';

import { useState } from 'react';
import { 
  Sparkles, 
  Loader2, 
  ChevronDown,
  Lightbulb,
  Award,
  Users,
  Network
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AnalysisType = 'optimize' | 'score' | 'competitor' | 'diagram';

interface AIAnalysisToolsProps {
  prdContent: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
  customModelName?: string;
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
  prdContent, 
  model, 
  apiKey, 
  customApiUrl,
  customModelName 
}: AIAnalysisToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisType>('optimize');
  const [results, setResults] = useState<Record<AnalysisType, string>>({
    optimize: '',
    score: '',
    competitor: '',
    diagram: '',
  });
  const [loading, setLoading] = useState<Record<AnalysisType, boolean>>({
    optimize: false,
    score: false,
    competitor: false,
    diagram: false,
  });

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
      setResults(prev => ({ ...prev, [type]: data.content }));
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : '分析失败');
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const hasContent = prdContent.trim().length > 0;

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
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {ANALYSIS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleAnalyze(option.type)}
              disabled={loading[option.type]}
              className="flex items-start gap-3 py-2"
            >
              <option.icon className="h-4 w-4 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
              {loading[option.type] && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </DropdownMenuItem>
          ))}
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
              基于PRD内容的智能分析
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisType)} className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              {ANALYSIS_OPTIONS.map((option) => (
                <TabsTrigger 
                  key={option.type} 
                  value={option.type}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <option.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{option.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {ANALYSIS_OPTIONS.map((option) => (
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
                ) : results[option.type] ? (
                  <ScrollArea className="h-[calc(100vh-250px)]">
                    <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {results[option.type]}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <option.icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {option.description}
                    </p>
                    <Button onClick={() => handleAnalyze(option.type)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      开始分析
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
