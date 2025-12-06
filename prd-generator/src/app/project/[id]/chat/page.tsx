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
import { Skeleton } from '@/components/ui/skeleton';
import { SmartSelector, SelectedAnswer } from '@/components/smart-selector';
import { useProjectStore, useSettingsStore, useChatStore } from '@/store';
import type { ConversationMessage, SelectorData, AIQuestionsResponse } from '@/types';

// 解析AI响应中的选择器数据
function parseAIResponse(response: string): { textContent: string; selectorData: SelectorData[] | null } {
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed: AIQuestionsResponse = JSON.parse(jsonMatch[1]);
      const textContent = response.replace(/```json\n[\s\S]*?\n```/, '').trim();
      const selectors = parsed.questions?.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        required: q.required
      })) || null;
      return { textContent, selectorData: selectors };
    } catch (e) {
      console.error('Failed to parse selector data:', e);
    }
  }
  return { textContent: response, selectorData: null };
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const { currentProject, loadProject, addMessage, updateProject, setProjectStatus, isLoading } = useProjectStore();
  const { settings, loadSettings } = useSettingsStore();
  const { isStreaming, streamContent, setStreaming, appendStreamContent, clearStreamContent, setError } = useChatStore();
  
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentSelectors, setCurrentSelectors] = useState<SelectorData[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载项目和设置
  useEffect(() => {
    setMounted(true);
    loadProject(projectId);
    loadSettings();
  }, [projectId, loadProject, loadSettings]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentProject?.conversation, streamContent]);

  // 发送初始消息
  useEffect(() => {
    if (currentProject && currentProject.conversation.length === 0 && currentProject.initialInput && settings) {
      sendMessage(currentProject.initialInput);
    }
  }, [currentProject, settings]);

  // 发送消息到AI
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

    // 开始流式响应
    setStreaming(true);
    clearStreamContent();
    setCurrentSelectors([]);

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.replace('data: ', '');
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

      // 解析AI响应
      const { textContent, selectorData } = parseAIResponse(fullContent);

      // 添加AI消息
      const aiMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        timestamp: Date.now(),
        content: textContent,
        selector: selectorData?.[0]
      };
      await addMessage(aiMessage);

      // 设置当前选择器
      if (selectorData && selectorData.length > 0) {
        setCurrentSelectors(selectorData);
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : '发送失败');
      setError(error instanceof Error ? error.message : '发送失败');
    } finally {
      setStreaming(false);
      clearStreamContent();
    }
  }, [currentProject, settings, addMessage, setStreaming, appendStreamContent, clearStreamContent, setError]);

  // 处理选择器提交
  const handleSelectorSubmit = async (selectorId: string, values: string[]) => {
    const selector = currentSelectors.find(s => s.id === selectorId);
    if (!selector) return;

    // 获取选中的标签
    const labels = values.map(v => {
      const option = selector.options.find(o => o.value === v);
      return option?.label || v;
    });

    // 发送用户选择作为消息
    const content = `${selector.question}\n我的选择：${labels.join('、')}`;
    await sendMessage(content);
  };

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

          {/* 流式响应显示 */}
          {isStreaming && streamContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg p-4 bg-muted">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {isStreaming && !streamContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg p-4 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">AI 正在思考...</span>
                </div>
              </div>
            </div>
          )}

          {/* 当前选择器 */}
          {!isStreaming && currentSelectors.length > 0 && (
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
