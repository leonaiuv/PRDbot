'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Send, Loader2, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartSelector, SelectedAnswer } from '@/components/smart-selector';
import { SelectorSkeleton } from '@/components/selector-skeleton';
import { GeneratingIndicator } from '@/components/generating-indicator';
import { GenerationStatusBar } from '@/components/generation-status-bar';
import { useProjectStore, useSettingsStore, useChatStore } from '@/store';
import type { ConversationMessage, SelectorData, AIQuestionsResponse, QuestionMeta } from '@/types';

// 解析AI响应中的选择器数据和元数据
// 放宽正则匹配：兼容 \r\n、可选空格、大小写变体、缺少尾部换行
function parseAIResponse(response: string): { 
  textContent: string; 
  selectorData: SelectorData[] | null;
  meta: QuestionMeta | null;
} {
  // 兼容多种代码块格式：```json、``` json、```JSON等
  const jsonMatch = response.match(/```\s*json\s*\r?\n?([\s\S]*?)\r?\n?```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim()) as AIQuestionsResponse & { meta?: QuestionMeta };
      // 移除代码块时也使用宽松正则
      const textContent = response.replace(/```\s*json\s*\r?\n?[\s\S]*?\r?\n?```/i, '').trim();
      const selectors = parsed.questions?.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        required: q.required
      })) || null;
      return { textContent, selectorData: selectors, meta: parsed.meta || null };
    } catch (e) {
      console.error('Failed to parse selector data:', e);
    }
  }
  return { textContent: response, selectorData: null, meta: null };
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const { currentProject, loadProject, addMessage, updateProject, setProjectStatus, isLoading } = useProjectStore();
  const { settings, loadSettings } = useSettingsStore();
  const { 
    isStreaming, 
    generationPhase,
    currentStep,
    stepIndex,
    elapsedTime,
    pendingSelectors,
    questionMeta,
    canCancel,
    error,
    startGeneration,
    advanceStep,
    setPendingSelectors,
    completeGeneration,
    cancelGeneration,
    setGenerationError,
    updateElapsedTime,
    resetGeneration,
  } = useChatStore();
  
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentSelectors, setCurrentSelectors] = useState<SelectorData[]>([]);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载项目和设置
  useEffect(() => {
    setMounted(true);
    loadProject(projectId);
    loadSettings();
    // 组件卸载时清理
    return () => {
      resetGeneration();
    };
  }, [projectId, loadProject, loadSettings, resetGeneration]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentProject?.conversation, generationPhase, pendingSelectors]);

  // 发送初始消息
  useEffect(() => {
    if (currentProject && currentProject.conversation.length === 0 && currentProject.initialInput && settings) {
      sendMessage(currentProject.initialInput);
    }
  }, [currentProject, settings]);

  // 进度模拟器 - 当开始生成时启动
  useEffect(() => {
    if (generationPhase === 'generating') {
      // 清理之前的定时器
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      
      // 启动已用时间计时器
      elapsedTimerRef.current = setInterval(() => {
        updateElapsedTime();
      }, 1000);
      
      // 启动步骤进度模拟器（每3秒推进一步）
      stepTimerRef.current = setInterval(() => {
        advanceStep();
      }, 3500);
    } else {
      // 非生成状态时清理定时器
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
    
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [generationPhase, advanceStep, updateElapsedTime]);

  // 发送消息到AI（缓冲模式 - 不实时流式渲染，等待完整响应后统一渲染）
  const sendMessage = useCallback(async (content: string) => {
    if (!settings?.apiKeys[settings.defaultModel]) {
      toast.error('请先在设置中配置 API Key');
      return;
    }

    // 添加用户消息
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      timestamp: Date.now(),
      content: content
    };
    await addMessage(userMessage);

    // 开始生成（启动生成状态、清空待渲染选择器）
    startGeneration({ content });
    setCurrentSelectors([]);
    setShowStatusBar(true);

    try {
      const messages = [...(currentProject?.conversation || []), userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

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
      let sseBuffer = ''; // SSE分片缓冲，避免跨chunk的JSON被截断

      // 缓冲模式：不实时渲染，等待完整响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用stream模式解码，正确处理多字节UTF-8字符
        sseBuffer += decoder.decode(value, { stream: true });
        
        // 按换行符分割，保留最后一个可能不完整的行
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // 保留未完成的行到buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
              // 不再实时渲染，只累积内容
            }
          } catch (e) {
            console.warn('SSE JSON parse warning:', e, 'data:', data);
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
            }
          } catch (e) {
            console.warn('SSE final buffer parse warning:', e);
          }
        }
      }

      // 解析完整的AI响应
      const { textContent, selectorData, meta } = parseAIResponse(fullContent);

      // 添加AI消息
      const aiMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        timestamp: Date.now(),
        content: textContent,
        selectors: selectorData || undefined
      };
      await addMessage(aiMessage);

      // 设置待渲染的选择器（用于统一渲染）
      if (selectorData && selectorData.length > 0) {
        setPendingSelectors(selectorData, meta || undefined);
        setCurrentSelectors(selectorData);
      }

      // 完成生成，进入可交互状态
      completeGeneration();

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : '发送失败';
      toast.error(errorMessage);
      setGenerationError(errorMessage);
    }
  }, [currentProject, settings, addMessage, startGeneration, setPendingSelectors, completeGeneration, setGenerationError]);

  // 处理选择器提交
  const handleSelectorSubmit = async (selectorId: string, values: string[]) => {
    const selector = currentSelectors.find(s => s.id === selectorId);
    if (!selector) return;

    // 获取选中的标签
    const labels = values.map(v => {
      const option = selector.options.find(o => o.value === v);
      return option?.label || v;
    });

    // 清空当前选择器（因为即将发送新消息）
    setCurrentSelectors([]);
    resetGeneration();

    // 发送用户选择作为消息
    const content = `${selector.question}\n我的选择：${labels.join('、')}`;
    await sendMessage(content);
  };

  // 处理取消生成
  const handleCancelGeneration = useCallback(() => {
    cancelGeneration();
    toast.info('已取消生成');
  }, [cancelGeneration]);

  // 处理重试
  const handleRetry = useCallback(() => {
    const { retryParams } = useChatStore.getState();
    if (retryParams?.content) {
      resetGeneration();
      sendMessage(retryParams.content);
    }
  }, [sendMessage, resetGeneration]);

  // 关闭状态栏
  const handleDismissStatusBar = useCallback(() => {
    setShowStatusBar(false);
  }, []);

  // 处理发送按钮
  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
  };

  // 处理回车键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 生成PRD
  const handleGeneratePRD = async () => {
    if (!currentProject) return;
    
    // 构建对话历史文本
    const conversationHistory = currentProject.conversation
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    // 更新项目状态
    await setProjectStatus('generated');
    
    // 跳转到PRD页面
    router.push(`/project/${projectId}/prd?generate=true`);
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

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="flex-shrink-0 border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="font-semibold truncate max-w-[200px] md:max-w-none">
              {currentProject.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleGeneratePRD}
              disabled={currentProject.conversation.length < 4}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              生成 PRD
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 对话区域 */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="container max-w-3xl space-y-4">
          {currentProject.conversation.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* 生成中状态 - 显示进度指示器和骨架屏 */}
          {generationPhase === 'generating' && (
            <>
              {/* 生成进度指示器 */}
              <GeneratingIndicator
                currentStep={currentStep}
                stepIndex={stepIndex}
                elapsedTime={elapsedTime}
                onCancel={handleCancelGeneration}
                canCancel={canCancel}
              />
              
              {/* 骨架屏占位 */}
              <SelectorSkeleton count={2} />
            </>
          )}

          {/* 状态提示栏 */}
          {showStatusBar && (generationPhase === 'interactive' || generationPhase === 'error' || generationPhase === 'timeout') && (
            <GenerationStatusBar
              phase={generationPhase}
              selectorCount={pendingSelectors.length}
              error={error}
              onRetry={handleRetry}
              onDismiss={handleDismissStatusBar}
              canGeneratePRD={questionMeta?.canGeneratePRD}
            />
          )}

          {/* 当前选择器 - 统一渲染 */}
          {generationPhase === 'interactive' && currentSelectors.length > 0 && (
            <div className="space-y-4">
              {currentSelectors.map((selector) => (
                <SmartSelector
                  key={selector.id}
                  selector={selector}
                  onSubmit={(values) => handleSelectorSubmit(selector.id, values)}
                  disabled={isStreaming}
                />
              ))}
            </div>
          )}

          {/* 错误状态显示 */}
          {generationPhase === 'error' && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                  生成失败，请点击重试或检查网络连接
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 输入区域 */}
      <div className="flex-shrink-0 border-t bg-background p-4">
        <div className="container max-w-3xl">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，或使用上方选择器回答问题..."
              className="min-h-[50px] max-h-[200px] resize-none"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[50px] w-[50px]"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            已回答 {currentProject.metadata.questionCount} 个问题 · 建议回答 10-20 个问题后生成 PRD
          </p>
        </div>
      </div>
    </div>
  );
}
