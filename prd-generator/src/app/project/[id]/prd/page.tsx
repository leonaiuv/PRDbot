'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Settings, Send, Loader2, Download, Edit, Eye, Construction, FileText, AlertCircle, RefreshCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore, useSettingsStore, usePRDGenerationStore } from '@/store';
import { exportMarkdown } from '@/lib/export';
import type { ConversationMessage } from '@/types';

// 动态导入Markdown编辑器
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

export default function PRDPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const shouldGenerate = searchParams.get('generate') === 'true';
  
  const { loadProject, addMessage, updatePRDContent, setProjectStatus, isLoading } = useProjectStore();
  // P2: 使用 selector 从 projects 派生 currentProject
  const currentProject = useProjectStore(state => {
    if (!state.currentProjectId) return null;
    return state.projects.find(p => p.id === state.currentProjectId) || null;
  });
  const { settings, loadSettings } = useSettingsStore();
  
  // 使用全局PRD生成状态管理
  const { 
    getTask, 
    startTask, 
    appendTaskContent, 
    completeTask, 
    errorTask, 
    updateElapsedTime,
    clearTask,
    restoreTask,
    abortAndPersist,
    loadPersistedTask,
  } = usePRDGenerationStore();
  const prdTask = usePRDGenerationStore(state => state.tasks[projectId]);
  // getTask 在 effect 中使用，放入 ref 避免依赖数组长度变化
  const getTaskRef = useRef(getTask);
  useEffect(() => {
    getTaskRef.current = getTask;
  }, [getTask]);
  
  // 本地状态（用于对话流式响应，与PRD生成分离）
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const appendStreamContent = useCallback((content: string) => {
    setStreamContent(prev => prev + content);
  }, []);
  const clearStreamContent = useCallback(() => {
    setStreamContent('');
  }, []);
  
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'prd'>('chat');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(400);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 从PRD任务状态获取生成中状态
  const isGenerating = prdTask?.phase === 'generating';
  const prdTaskContent = prdTask?.streamContent || '';
  const prdTaskElapsedTime = prdTask?.elapsedTime || 0;
  const prdTaskError = prdTask?.phase === 'error' ? prdTask.error : undefined;

  // 加载项目和设置
  useEffect(() => {
    setMounted(true);
    loadProject(projectId);
    loadSettings();
    
    // 组件卸载时安全中断并保存进度
    return () => {
      // 如果正在生成，中断并保存进度
      abortAndPersist(projectId);
    };
  }, [projectId, loadProject, loadSettings, abortAndPersist]);

  // 检查并恢复中断的任务
  useEffect(() => {
    if (!mounted || !currentProject) return;

    // 如果内存中已有正在进行的生成任务，避免被误判为中断
    const activeTask = getTaskRef.current(projectId);
    if (activeTask?.phase === 'generating') return;
    
    const checkAndRestoreTask = async () => {
      // 检查是否有持久化的中断任务
      const persisted = await loadPersistedTask(projectId);
      if (persisted && (persisted.phase === 'generating' || persisted.phase === 'error')) {
        // 再次检查是否已经启动了新的生成任务，避免竞态覆盖
        const latestTask = getTaskRef.current(projectId);
        if (latestTask?.phase === 'generating' && latestTask.startTime >= persisted.startTime) {
          return;
        }

        // P3: 边界条件修复 - 检查项目是否有完整内容
        // 使用更严格的判断：内容必须存在且有实质性内容（至少 50 个字符）
        const hasValidContent = currentProject.prdContent && 
          currentProject.prdContent.trim().length > 50;
        
        if (hasValidContent) {
          // 项目已有完整内容，说明上次生成实际成功了，清除错误状态
          await clearTask(projectId);
          return;
        }
        
        // 恢复任务状态
        await restoreTask(projectId);
        if (persisted.phase === 'generating') {
          toast.info('检测到中断的生成任务，请点击重试');
        }
      }
    };
    
    checkAndRestoreTask();
  }, [mounted, projectId, currentProject, loadPersistedTask, restoreTask, clearTask]);

  // PRD生成计时器
  useEffect(() => {
    if (isGenerating) {
      // 启动已用时间计时器
      elapsedTimerRef.current = setInterval(() => {
        updateElapsedTime(projectId);
      }, 1000);
    } else {
      // 非生成状态时清理计时器
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
    
    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, [isGenerating, projectId, updateElapsedTime]);

  // 聊天区自动滚动到底部
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [currentProject?.conversation, streamContent, isStreaming]);

  // 计算编辑器高度
  useEffect(() => {
    const updateEditorHeight = () => {
      if (editorContainerRef.current) {
        setEditorHeight(editorContainerRef.current.clientHeight);
      }
    };
    updateEditorHeight();
    window.addEventListener('resize', updateEditorHeight);
    return () => window.removeEventListener('resize', updateEditorHeight);
  }, [editMode]);

  // 自动生成PRD（仅当URL参数指示且没有已存在内容时）
  useEffect(() => {
    if (!shouldGenerate || !currentProject || !settings) return;
    // 检查是否已有内容或正在生成
    if (currentProject.prdContent || isGenerating) return;
    // 检查是否有错误任务（不自动重试）
    const task = getTask(projectId);
    if (task?.phase === 'error') return;
    
    generatePRD();
  }, [shouldGenerate, currentProject, settings, isGenerating, projectId, getTask]);

  // 生成PRD文档
  const generatePRD = useCallback(async () => {
    if (!currentProject || !settings?.apiKeys[settings.defaultModel]) {
      toast.error('请先在设置中配置 API Key');
      return;
    }

    // 检查是否已有生成任务在进行中
    const existingTask = getTask(projectId);
    if (existingTask?.phase === 'generating') {
      toast.info('PRD 正在生成中，请稍候...');
      return;
    }

    // 启动全局生成任务
    const abortController = startTask(projectId);

    try {
      // 构建对话历史
      const conversationHistory = currentProject.conversation
        .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
        .join('\n\n');

      const response = await fetch('/api/generate-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory,
          model: settings.defaultModel,
          apiKey: settings.apiKeys[settings.defaultModel],
          customApiUrl: settings.customApiUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'PRD生成失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let fullContent = '';
      let sseBuffer = ''; // SSE分片缓冲，避免跨chunk截断

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用stream模式解码，正确处理多字节UTF-8字符
        sseBuffer += decoder.decode(value, { stream: true });
        
        // 按换行符分割，保留最后一个可能不完整的行
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
              appendTaskContent(projectId, content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      // 处理buffer中可能残留的最后一行
      if (sseBuffer.startsWith('data: ')) {
        const data = sseBuffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
              appendTaskContent(projectId, content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      // 保存PRD内容
      await updatePRDContent(fullContent);
      await setProjectStatus('generated');
      
      // 完成生成任务
      completeTask(projectId);
      toast.success('PRD 生成完成');

    } catch (error) {
      // 检查是否是取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('PRD 生成已取消');
        clearTask(projectId);
        return;
      }
      
      console.error('Generate PRD error:', error);
      const errorMessage = error instanceof Error ? error.message : 'PRD生成失败';
      errorTask(projectId, errorMessage);
      toast.error(errorMessage);
    }
  }, [currentProject, settings, projectId, getTask, startTask, appendTaskContent, completeTask, errorTask, clearTask, updatePRDContent, setProjectStatus]);

  // 继续对话
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    if (!settings?.apiKeys[settings.defaultModel]) {
      toast.error('请先在设置中配置 API Key');
      return;
    }

    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      timestamp: Date.now(),
      content: input.trim()
    };
    await addMessage(userMessage);
    setInput('');

    setIsStreaming(true);
    clearStreamContent();

    try {
      const messages: { role: string; content: string }[] = [...(currentProject?.conversation || []), userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      // 添加当前PRD内容作为上下文
      if (currentProject?.prdContent) {
        messages.push({
          role: 'system',
          content: `当前的PRD文档内容：

${currentProject.prdContent}

请基于此文档回答用户问题，并在需要时提供修改建议。`
        });
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: settings.defaultModel,
          apiKey: settings.apiKeys[settings.defaultModel],
          customApiUrl: settings.customApiUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let fullContent = '';
      let sseBuffer = ''; // SSE分片缓冲，避免跨chunk截断

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用stream模式解码，正确处理多字节UTF-8字符
        sseBuffer += decoder.decode(value, { stream: true });
        
        // 按换行符分割，保留最后一个可能不完整的行
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
              appendStreamContent(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      // 处理buffer中可能残留的最后一行
      if (sseBuffer.startsWith('data: ')) {
        const data = sseBuffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
              appendStreamContent(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      const aiMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        timestamp: Date.now(),
        content: fullContent
      };
      await addMessage(aiMessage);

    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setIsStreaming(false);
      clearStreamContent();
    }
  };

  // 处理PRD编辑
  const handlePRDChange = useCallback(async (value?: string) => {
    if (value !== undefined && currentProject) {
      await updatePRDContent(value);
    }
  }, [currentProject, updatePRDContent]);

  // 导出功能
  const handleExport = (format: 'md') => {
    if (!currentProject?.prdContent) {
      toast.error('没有可导出的内容');
      return;
    }

    exportMarkdown(currentProject.prdContent, currentProject.name);
    setProjectStatus('exported');
    toast.success('Markdown 导出成功');
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">项目不存在</p>
        <Link href="/">
          <Button>返回首页</Button>
        </Link>
      </div>
    );
  }

  const prdContent = isGenerating ? prdTaskContent : currentProject.prdContent;

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-3 sm:px-4 md:px-6 flex h-12 sm:h-14 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 touch-feedback">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <h1 className="font-semibold text-sm sm:text-base truncate">
              {currentProject.name}
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 touch-feedback">
                  <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">导出</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('md')}>
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                  <Construction className="mr-2 h-4 w-4" />
                  PDF (.pdf) - 开发中
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                  <Construction className="mr-2 h-4 w-4" />
                  Word (.docx) - 开发中
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 touch-feedback">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 移动端Tab切换 */}
      <div className="md:hidden border-b bg-background/95 backdrop-blur">
        <div className="flex">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-3 text-sm font-medium transition-all touch-feedback ${
              mobileTab === 'chat'
                ? 'border-b-2 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            对话区
          </button>
          <button
            onClick={() => setMobileTab('prd')}
            className={`flex-1 py-3 text-sm font-medium transition-all touch-feedback ${
              mobileTab === 'prd'
                ? 'border-b-2 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            PRD 文档
          </button>
        </div>
      </div>

      {/* 主内容区域 - 左右分栏 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* 左侧对话区 */}
        <div className={`w-full md:w-2/5 lg:w-1/3 border-r flex flex-col min-h-0 ${
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="p-2 border-b bg-muted/30 hidden md:block">
            <h2 className="text-sm font-medium text-center text-muted-foreground">对话区</h2>
          </div>
          
          <ScrollArea className="flex-1 min-h-0 custom-scrollbar" viewportRef={scrollViewportRef}>
            <div className="p-3 sm:p-4 space-y-3">
              {currentProject.conversation.slice(-10).map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-2.5 sm:p-3 text-sm transition-all ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content.slice(0, 500) + (message.content.length > 500 ? '...' : '')}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && streamContent && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-xl p-2.5 sm:p-3 bg-muted text-sm">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamContent.slice(0, 500)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && !streamContent && (
                <div className="flex justify-start">
                  <div className="rounded-xl p-2.5 sm:p-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">思考中...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 输入区域 */}
          <div className="flex-shrink-0 border-t p-2 sm:p-3 bg-background safe-area-inset">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="继续对话..."
                className="min-h-[38px] sm:min-h-[40px] max-h-[80px] sm:max-h-[100px] resize-none text-sm"
                rows={1}
                disabled={isStreaming}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-[38px] w-[38px] sm:h-[40px] sm:w-[40px] flex-shrink-0 touch-feedback"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 右侧PRD预览/编辑区 */}
        <div className={`flex-1 flex flex-col min-h-0 ${
          mobileTab === 'prd' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground hidden md:block">PRD 文档</h2>
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {isGenerating && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  生成中... {prdTaskElapsedTime > 0 && `${prdTaskElapsedTime}s`}
                </span>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  disabled={isGenerating}
                  className="h-8 text-xs sm:text-sm touch-feedback"
                >
                  {editMode ? (
                    <>
                      <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      预览
                    </>
                  ) : (
                    <>
                      <Edit className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      编辑
                    </>
                  )}
                </Button>
                {!currentProject.prdContent && !isGenerating && (
                  <Button size="sm" onClick={generatePRD} className="h-8 text-xs sm:text-sm touch-feedback">
                    生成 PRD
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            {editMode ? (
              <div ref={editorContainerRef} data-color-mode="light" className="h-full flex flex-col min-h-0">
                <MDEditor
                  value={prdContent}
                  onChange={handlePRDChange}
                  height={editorHeight}
                  preview="edit"
                />
              </div>
            ) : (
              <ScrollArea className="h-full min-h-0 custom-scrollbar">
                <div className="p-4 sm:p-6 prose prose-sm dark:prose-invert max-w-none">
                  {/* 生成中状态 - 显示骨架屏或流式内容 */}
                  {isGenerating && (
                    <div className="space-y-4">
                      {/* 生成进度提示 */}
                      <div className="flex items-center justify-center gap-3 py-4 px-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                        <div className="text-sm">
                          <span className="text-blue-700 dark:text-blue-300 font-medium">PRD 文档生成中</span>
                          {prdTaskElapsedTime > 0 && (
                            <span className="text-blue-600/70 dark:text-blue-400/70 ml-2">
                              已用时 {prdTaskElapsedTime} 秒
                            </span>
                          )}
                        </div>
                      </div>
                                  
                      {/* 流式内容或骨架屏 */}
                      {prdTaskContent ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {prdTaskContent}
                        </ReactMarkdown>
                      ) : (
                        /* 骨架屏占位 */
                        <div className="space-y-6 animate-pulse">
                          <div className="space-y-3">
                            <div className="h-8 bg-muted rounded w-1/3"></div>
                            <div className="h-4 bg-muted rounded w-full"></div>
                            <div className="h-4 bg-muted rounded w-5/6"></div>
                            <div className="h-4 bg-muted rounded w-4/6"></div>
                          </div>
                          <div className="space-y-3">
                            <div className="h-6 bg-muted rounded w-1/4"></div>
                            <div className="h-4 bg-muted rounded w-full"></div>
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                          </div>
                          <div className="space-y-3">
                            <div className="h-6 bg-muted rounded w-1/3"></div>
                            <div className="h-4 bg-muted rounded w-full"></div>
                            <div className="h-4 bg-muted rounded w-5/6"></div>
                            <div className="h-4 bg-muted rounded w-2/3"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                              
                  {/* 错误状态 - 仅当没有已保存内容时显示 */}
                  {prdTaskError && !currentProject.prdContent && (
                    <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-100 dark:bg-red-950/30 mb-4">
                        <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" />
                      </div>
                      <p className="text-sm sm:text-base text-red-600 dark:text-red-400 mb-2">生成失败</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-4">{prdTaskError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          clearTask(projectId);
                          generatePRD();
                        }}
                        className="touch-feedback"
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        重试
                      </Button>
                    </div>
                  )}
                              
                  {/* 正常内容显示 - 只要有持久化内容就优先显示 */}
                  {!isGenerating && currentProject.prdContent && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentProject.prdContent}
                    </ReactMarkdown>
                  )}
                              
                  {/* 空状态 */}
                  {!isGenerating && !prdTaskError && !prdContent && (
                    <div className="text-center py-12 sm:py-16 text-muted-foreground">
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted mb-4">
                        <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                      <p className="text-sm sm:text-base">还没有生成 PRD 文档</p>
                      <p className="text-xs sm:text-sm mt-2">点击上方“生成 PRD”按钮开始生成</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
