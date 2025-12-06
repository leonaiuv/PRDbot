'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
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
import { chatDraftsDB } from '@/lib/db';
import type { ConversationMessage, SelectorData, QuestionMeta, GenerationPhase } from '@/types';
import type { ValidatedAIResponse } from '@/lib/validator';

// 后端校验响应类型
interface ValidatedChatResponse {
  validated: boolean;
  data?: ValidatedAIResponse;
  textContent?: string;
  rawContent?: string;
  validationErrors?: string[];
  retryCount?: number;
}

// 从校验后的数据转换为选择器数据
function convertToSelectorData(data: ValidatedAIResponse): {
  selectors: SelectorData[];
  meta: QuestionMeta;
} {
  const selectors: SelectorData[] = data.questions.map(q => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    required: q.required ?? true,
  }));
  
  const meta: QuestionMeta = {
    phase: data.meta.phase,
    progress: data.meta.progress,
    canGeneratePRD: data.meta.canGeneratePRD,
    suggestedNextTopic: data.meta.suggestedNextTopic,
  };
  
  return { selectors, meta };
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
    abortAndReset,
    setGenerationPhase,
  } = useChatStore();
  
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentSelectors, setCurrentSelectors] = useState<SelectorData[]>([]);
  const [showStatusBar, setShowStatusBar] = useState(true);
  // 统一管理所有选择器的选择状态: { selectorId: selectedValues[] }
  const [selectionsMap, setSelectionsMap] = useState<Record<string, string[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载项目和设置
  useEffect(() => {
    setMounted(true);
    loadProject(projectId);
    loadSettings();
    // 组件卸载时安全中断并保存草稿
    return () => {
      // 使用abortAndReset安全中断进行中的请求
      abortAndReset();
    };
  }, [projectId, loadProject, loadSettings, abortAndReset]);

  // 从持久化存储或会话历史恢复表单状态
  useEffect(() => {
    if (!currentProject || !mounted) return;
    
    const restoreFormState = async () => {
      // 先尝试从持久化草稿恢复
      const draft = await chatDraftsDB.get(projectId);
      if (draft && draft.currentSelectors.length > 0) {
        setCurrentSelectors(draft.currentSelectors);
        setSelectionsMap(draft.selectionsMap);
        setInput(draft.inputDraft || '');
        setPendingSelectors(draft.currentSelectors, draft.questionMeta || undefined);
        setGenerationPhase(draft.generationPhase || 'interactive');
        setShowStatusBar(true);
        return;
      }
      
      // 如果没有草稿，从最后一条assistant消息恢复
      const conversation = currentProject.conversation;
      if (conversation.length === 0) return;
      
      // 找到最后一条带selectors的assistant消息
      for (let i = conversation.length - 1; i >= 0; i--) {
        const msg = conversation[i];
        if (msg.role === 'assistant' && msg.selectors && msg.selectors.length > 0) {
          // 检查这条消息后面是否有用户回复（如果有，说明已提交）
          const hasUserReply = conversation.slice(i + 1).some(m => m.role === 'user');
          if (!hasUserReply) {
            // 未提交，恢复表单状态
            setCurrentSelectors(msg.selectors);
            const initialMap: Record<string, string[]> = {};
            msg.selectors.forEach(s => {
              initialMap[s.id] = [];
            });
            setSelectionsMap(initialMap);
            setPendingSelectors(msg.selectors);
            setGenerationPhase('interactive');
            setShowStatusBar(true);
          }
          break;
        }
      }
    };
    
    restoreFormState();
  }, [currentProject, mounted, projectId, setPendingSelectors, setGenerationPhase]);

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

  // 发送消息到AI（后端校验模式 - 后端聚合并校验响应，前端等待校验结果后统一渲染）
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
      let sseBuffer = ''; // SSE分片缓冲
      let validatedResponse: ValidatedChatResponse | null = null;

      // 等待后端校验完成的响应
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
            validatedResponse = JSON.parse(data) as ValidatedChatResponse;
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
            validatedResponse = JSON.parse(data) as ValidatedChatResponse;
          } catch (e) {
            console.warn('SSE final buffer parse warning:', e);
          }
        }
      }

      // 处理后端校验结果
      if (!validatedResponse) {
        throw new Error('AI 响应解析失败');
      }

      if (validatedResponse.validated && validatedResponse.data) {
        // 校验通过，使用结构化数据
        const { selectors, meta } = convertToSelectorData(validatedResponse.data);
        
        // 如果有重试，显示提示
        if (validatedResponse.retryCount && validatedResponse.retryCount > 0) {
          toast.info(`AI 已自动纠正输出格式 (重试 ${validatedResponse.retryCount} 次)`);
        }

        // 添加AI消息
        const aiMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          timestamp: Date.now(),
          content: validatedResponse.textContent || '',
          selectors: selectors
        };
        await addMessage(aiMessage);

        // 设置待渲染的选择器
        if (selectors.length > 0) {
          setPendingSelectors(selectors, meta);
          setCurrentSelectors(selectors);
          // 初始化所有选择器的状态为空数组
          const initialMap: Record<string, string[]> = {};
          selectors.forEach(s => {
            initialMap[s.id] = [];
          });
          setSelectionsMap(initialMap);
        }

        // 完成生成，进入可交互状态
        completeGeneration();

      } else {
        // 校验失败，显示错误信息和原始内容
        const errorMsg = validatedResponse.validationErrors?.join('; ') || 'AI 输出格式异常';
        console.error('Chat validation failed:', {
          errors: validatedResponse.validationErrors,
          rawContent: validatedResponse.rawContent?.substring(0, 200),
          retryCount: validatedResponse.retryCount
        });
        
        toast.error(`AI 输出格式异常，已重试 ${validatedResponse.retryCount || 0} 次`);

        // 将原始内容作为文本消息显示
        const aiMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          timestamp: Date.now(),
          content: validatedResponse.rawContent || '无法解析AI响应'
        };
        await addMessage(aiMessage);

        // 设置错误状态
        setGenerationError(errorMsg);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : '发送失败';
      toast.error(errorMessage);
      setGenerationError(errorMessage);
    }
  }, [currentProject, settings, addMessage, startGeneration, setPendingSelectors, completeGeneration, setGenerationError]);

  // 处理单个选择器的值变更（受控模式）
  const handleSelectorChange = useCallback((selectorId: string, values: string[]) => {
    setSelectionsMap(prev => {
      const newMap = {
        ...prev,
        [selectorId]: values
      };
      // 异步持久化草稿（不阻塞）
      chatDraftsDB.save({
        projectId,
        currentSelectors,
        selectionsMap: newMap,
        questionMeta,
        generationPhase,
        inputDraft: input,
      }).catch(console.error);
      return newMap;
    });
  }, [projectId, currentSelectors, questionMeta, generationPhase, input]);

  // 检查是否所有必填项都已填写
  const allRequiredFilled = useMemo(() => {
    return currentSelectors.every(selector => {
      if (!selector.required) return true;
      const values = selectionsMap[selector.id] || [];
      if (selector.type === 'text') {
        return values.length > 0 && values[0].trim().length > 0;
      }
      return values.length > 0;
    });
  }, [currentSelectors, selectionsMap]);

  // 检查是否有任何选择
  const hasAnySelection = useMemo(() => {
    return Object.values(selectionsMap).some(values => values.length > 0);
  }, [selectionsMap]);

  // 统一提交所有选择器的答案
  const handleSubmitAll = useCallback(async () => {
    if (currentSelectors.length === 0) return;
    
    // 构建统一的提交内容
    const contentParts: string[] = [];
    
    for (const selector of currentSelectors) {
      const values = selectionsMap[selector.id] || [];
      if (values.length === 0) continue;
      
      // 获取选中的标签
      let labels: string[];
      if (selector.type === 'text') {
        labels = values;
      } else {
        labels = values.map(v => {
          const option = selector.options.find(o => o.value === v);
          return option?.label || v;
        });
      }
      
      contentParts.push(`${selector.question}\n我的选择：${labels.join('、')}`);
    }
    
    if (contentParts.length === 0) return;
    
    // 清空当前选择器和选择状态
    setCurrentSelectors([]);
    setSelectionsMap({});
    resetGeneration();
    
    // 删除草稿（已提交）
    await chatDraftsDB.delete(projectId);
    
    // 发送合并后的用户选择作为消息
    await sendMessage(contentParts.join('\n\n'));
  }, [currentSelectors, selectionsMap, sendMessage, resetGeneration, projectId]);

  // 处理选择器提交（兼容旧的单个提交模式 - 仅用于单个选择器场景）
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
    
    // 删除草稿（已提交）
    await chatDraftsDB.delete(projectId);

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
      <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-3 sm:px-6 flex h-12 sm:h-14 items-center justify-between">
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
            <Button
              variant="default"
              size="sm"
              onClick={handleGeneratePRD}
              disabled={currentProject.conversation.length < 4}
              className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 touch-feedback"
            >
              <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">生成 </span>PRD
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 touch-feedback">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 对话区域 */}
      <ScrollArea className="flex-1 custom-scrollbar" ref={scrollRef}>
        <div className="container px-3 sm:px-6 py-3 sm:py-4 max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {currentProject.conversation.map((message) => {
            // AI消息如果内容为空且有选择器数据，则不显示空气泡
            const isEmptyAIMessage = message.role === 'assistant' && 
              (!message.content || message.content.trim() === '') && 
              message.selectors && message.selectors.length > 0;
            
            if (isEmptyAIMessage) return null;
            
            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-xl sm:rounded-lg p-3 sm:p-4 transition-all ${
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
                    <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                  )}
                </div>
              </div>
            );
          })}

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

          {/* 当前选择器 - 受控模式统一渲染 */}
          {generationPhase === 'interactive' && currentSelectors.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {currentSelectors.map((selector) => (
                <SmartSelector
                  key={selector.id}
                  selector={selector}
                  value={selectionsMap[selector.id] || []}
                  onChange={(values) => handleSelectorChange(selector.id, values)}
                  disabled={isStreaming}
                />
              ))}
              
              {/* 统一提交按钮 */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSubmitAll}
                  disabled={isStreaming || !hasAnySelection}
                  className="min-w-[100px] sm:min-w-[120px] h-9 sm:h-10 text-sm touch-feedback"
                >
                  <CheckCircle2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  提交全部
                  {currentSelectors.length > 1 && (
                    <span className="ml-1 text-xs opacity-75">
                      ({Object.values(selectionsMap).filter(v => v.length > 0).length}/{currentSelectors.length})
                    </span>
                  )}
                </Button>
              </div>
              
              {/* 必填项提示 */}
              {!allRequiredFilled && hasAnySelection && (
                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 text-center">
                  还有必填项未完成，请继续填写
                </p>
              )}
            </div>
          )}

          {/* 错误状态显示 */}
          {generationPhase === 'error' && (
            <div className="flex justify-start">
              <div className="max-w-[90%] sm:max-w-[85%] rounded-lg p-3 sm:p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                  生成失败，请点击重试或检查网络连接
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 输入区域 */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur p-3 sm:p-4 safe-area-inset">
        <div className="container px-0 sm:px-6 max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="min-h-[44px] sm:min-h-[50px] max-h-[120px] sm:max-h-[200px] resize-none text-sm sm:text-base"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[44px] w-[44px] sm:h-[50px] sm:w-[50px] flex-shrink-0 touch-feedback"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
            已回答 {currentProject.metadata.questionCount} 个问题 · 建议 10-20 个后生成 PRD
          </p>
        </div>
      </div>
    </div>
  );
}
