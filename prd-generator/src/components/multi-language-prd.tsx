'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Languages, Loader2, Globe, ChevronDown, Check, AlertCircle, Clock, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard, exportMarkdown } from '@/lib/export';
import { useTranslationStore, SUPPORTED_LANGUAGES } from '@/store';
import type { LanguageConfig } from '@/types';

interface MultiLanguagePRDProps {
  projectId: string;
  prdContent: string;
  projectName: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
  customModelName?: string;
}

export function MultiLanguagePRD({
  projectId,
  prdContent,
  projectName,
  model,
  apiKey,
  customApiUrl,
  customModelName,
}: MultiLanguagePRDProps) {
  const [translatedContent, setTranslatedContent] = useState('');
  const [currentLang, setCurrentLang] = useState<LanguageConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  
  // 保持引用以便在异步回调中使用
  const dialogOpenRef = useRef(dialogOpen);
  dialogOpenRef.current = dialogOpen;
  
  const {
    getTask,
    getProjectTasks,
    checkCache,
    startTask,
    completeTask,
    errorTask,
    cancelTask,
  } = useTranslationStore();

  // 获取当前语言的任务状态
  const currentTask = currentLang ? getTask(projectId, currentLang.code) : undefined;
  const isTranslating = currentTask?.phase === 'translating';
  
  // 获取所有进行中的任务数量
  const projectTasks = getProjectTasks(projectId);
  const activeTasksCount = projectTasks.filter(t => t.phase === 'translating').length;

  // 翻译逻辑
  const handleTranslate = useCallback(async (lang: LanguageConfig) => {
    if (!prdContent.trim()) {
      toast.error('没有PRD内容可翻译');
      return;
    }

    if (!apiKey) {
      toast.error('请先配置 API Key');
      return;
    }

    // 检查是否已有该语言的翻译任务进行中
    const existingTask = getTask(projectId, lang.code);
    if (existingTask?.phase === 'translating') {
      toast.info(`${lang.name}翻译正在进行中...`);
      setCurrentLang(lang);
      setDialogOpen(true);
      return;
    }

    // 设置当前语言
    setCurrentLang(lang);
    setTranslatedContent('');
    setFromCache(false);
    
    // 先检查缓存
    const cached = await checkCache(projectId, prdContent, lang.code);
    if (cached) {
      setTranslatedContent(cached.translatedContent);
      setFromCache(true);
      setDialogOpen(true);
      toast.success(`${lang.flag} ${lang.name}翻译已从缓存加载`, { duration: 2000 });
      return;
    }

    // 开始新的翻译任务
    setDialogOpen(true);
    const abortController = startTask(projectId, lang.code, lang.name);
    
    // 后台翻译提示
    toast.info(`开始翻译为${lang.name}，可关闭弹窗继续其他操作`, {
      duration: 3000,
    });

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: prdContent,
          targetLang: lang.nativeName,
          model,
          apiKey,
          customApiUrl,
          customModelName,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.providerError 
          ? `${error.error}: ${error.providerError}` 
          : (error.error || '翻译失败');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // 完成任务并保存缓存
      await completeTask(projectId, lang.code, prdContent, data.content);
      
      // 如果弹窗仍然打开且是当前语言，直接显示
      if (dialogOpenRef.current && currentLang?.code === lang.code) {
        setTranslatedContent(data.content);
        setFromCache(false);
      }
      
      // 显示完成通知（可点击查看）
      toast.success(`${lang.flag} ${lang.name}翻译完成`, {
        duration: 5000,
        action: {
          label: '查看',
          onClick: () => {
            setCurrentLang(lang);
            setTranslatedContent(data.content);
            setFromCache(false);
            setDialogOpen(true);
          },
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户取消，不显示错误
        return;
      }
      
      console.error('Translation error:', error);
      const errorMsg = error instanceof Error ? error.message : '翻译失败';
      await errorTask(projectId, lang.code, errorMsg);
      
      toast.error(`${lang.flag} ${lang.name}翻译失败: ${errorMsg}`, {
        duration: 5000,
        action: {
          label: '重试',
          onClick: () => handleTranslate(lang),
        },
      });
    }
  }, [projectId, prdContent, model, apiKey, customApiUrl, customModelName, currentLang, getTask, checkCache, startTask, completeTask, errorTask]);

  // 当任务完成时，如果弹窗打开，加载翻译内容
  useEffect(() => {
    if (currentLang && currentTask?.phase === 'completed' && dialogOpen && !translatedContent) {
      // 从缓存加载
      checkCache(projectId, prdContent, currentLang.code).then(cached => {
        if (cached) {
          setTranslatedContent(cached.translatedContent);
        }
      });
    }
  }, [currentTask?.phase, currentLang, dialogOpen, translatedContent, projectId, prdContent, checkCache]);

  // 处理取消任务
  const handleCancel = useCallback(() => {
    if (currentLang) {
      cancelTask(projectId, currentLang.code);
      setDialogOpen(false);
      toast.info('翻译已取消');
    }
  }, [projectId, currentLang, cancelTask]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(translatedContent);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const handleExport = () => {
    if (currentLang) {
      exportMarkdown(translatedContent, `${projectName}_${currentLang.code}`);
      toast.success('导出成功');
    }
  };

  // 获取语言状态标记
  const getLanguageStatus = (lang: LanguageConfig) => {
    const task = getTask(projectId, lang.code);
    if (task?.phase === 'translating') {
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    }
    if (task?.phase === 'completed') {
      return <Check className="h-3 w-3 text-green-500" />;
    }
    if (task?.phase === 'error') {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    return null;
  };

  if (!prdContent.trim()) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 relative">
            <Languages className="h-4 w-4" />
            翻译
            {activeTasksCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeTasksCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const status = getLanguageStatus(lang);
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleTranslate(lang)}
                className="gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {lang.nativeName}
                  </span>
                </div>
                {status}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {currentLang?.flag} {currentLang?.name}版本
              {fromCache && (
                <Badge variant="outline" className="ml-2 gap-1">
                  <Zap className="h-3 w-3" />
                  缓存
                </Badge>
              )}
              {isTranslating && (
                <Badge variant="secondary" className="ml-2 gap-1">
                  <Clock className="h-3 w-3 animate-pulse" />
                  翻译中
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isTranslating 
                ? `正在翻译为 ${currentLang?.nativeName}，可关闭弹窗继续其他操作`
                : `PRD 文档已翻译为 ${currentLang?.nativeName}`
              }
            </DialogDescription>
          </DialogHeader>

          {isTranslating && !translatedContent ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                正在翻译为{currentLang?.name}，请稍候...
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                您可以关闭此弹窗，翻译将在后台继续
              </p>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                取消翻译
              </Button>
            </div>
          ) : currentTask?.phase === 'error' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="h-8 w-8 text-destructive mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                翻译失败
              </p>
              <p className="text-xs text-destructive mb-4">
                {currentTask.error}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => currentLang && handleTranslate(currentLang)}
              >
                重试
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] mt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {translatedContent}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={handleCopy}>
                  复制
                </Button>
                <Button onClick={handleExport}>
                  导出 {currentLang?.code.toUpperCase()} 版本
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
