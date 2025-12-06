'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Settings, Send, Loader2, Download, Edit, Eye, Construction } from 'lucide-react';
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
import { useProjectStore, useSettingsStore } from '@/store';
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
  
  const { currentProject, loadProject, addMessage, updatePRDContent, setProjectStatus, isLoading } = useProjectStore();
  const { settings, loadSettings } = useSettingsStore();
  
  // 使用本地状态管理流式响应，避免与 Chat 页面冲突
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
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载项目和设置
  useEffect(() => {
    setMounted(true);
    loadProject(projectId);
    loadSettings();
  }, [projectId, loadProject, loadSettings]);

  // 自动生成PRD
  useEffect(() => {
    if (shouldGenerate && currentProject && settings && !currentProject.prdContent && !isGenerating) {
      generatePRD();
    }
  }, [shouldGenerate, currentProject, settings]);

  // 生成PRD文档
  const generatePRD = useCallback(async () => {
    if (!currentProject || !settings?.apiKeys[settings.defaultModel]) {
      toast.error('请先在设置中配置 API Key');
      return;
    }

    setIsGenerating(true);
    clearStreamContent();

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

      // 保存PRD内容
      await updatePRDContent(fullContent);
      await setProjectStatus('generated');
      toast.success('PRD 生成完成');

    } catch (error) {
      console.error('Generate PRD error:', error);
      toast.error(error instanceof Error ? error.message : 'PRD生成失败');
    } finally {
      setIsGenerating(false);
      clearStreamContent();
    }
  }, [currentProject, settings, appendStreamContent, clearStreamContent, updatePRDContent, setProjectStatus]);

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

  const prdContent = isGenerating ? streamContent : currentProject.prdContent;

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
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
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧对话区 */}
        <div className="w-2/5 border-r flex flex-col">
          <div className="p-2 border-b bg-muted/50">
            <h2 className="text-sm font-medium text-center">对话区</h2>
          </div>
          
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {currentProject.conversation.slice(-10).map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg p-3 text-sm ${
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
                  <div className="max-w-[90%] rounded-lg p-3 bg-muted text-sm">
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
                  <div className="rounded-lg p-3 bg-muted">
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
          <div className="flex-shrink-0 border-t p-3">
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
                placeholder="继续对话，补充需求或要求修改..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm"
                rows={1}
                disabled={isStreaming}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-[40px] w-[40px]"
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
        <div className="flex-1 flex flex-col">
          <div className="p-2 border-b bg-muted/50 flex items-center justify-between">
            <h2 className="text-sm font-medium">PRD 文档</h2>
            <div className="flex items-center gap-2">
              {isGenerating && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  生成中...
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditMode(!editMode)}
                disabled={isGenerating}
              >
                {editMode ? (
                  <>
                    <Eye className="mr-1 h-4 w-4" />
                    预览
                  </>
                ) : (
                  <>
                    <Edit className="mr-1 h-4 w-4" />
                    编辑
                  </>
                )}
              </Button>
              {!currentProject.prdContent && !isGenerating && (
                <Button size="sm" onClick={generatePRD}>
                  生成 PRD
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {editMode ? (
              <div data-color-mode="light" className="h-full">
                <MDEditor
                  value={prdContent}
                  onChange={handlePRDChange}
                  height="100%"
                  preview="edit"
                />
              </div>
            ) : (
              <ScrollArea className="h-full p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {prdContent ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {prdContent}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <p>还没有生成 PRD 文档</p>
                      <p className="text-sm mt-2">点击右上角"生成 PRD"按钮开始生成</p>
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
