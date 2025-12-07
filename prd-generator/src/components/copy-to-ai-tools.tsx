'use client';

import { useState } from 'react';
import { Copy, Check, Code, FileCode, Wand2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { copyToClipboard } from '@/lib/export';

interface CopyToAIToolsProps {
  prdContent: string;
  projectName: string;
}

// AI工具提示词模板
const AI_TOOL_TEMPLATES = {
  cursor: {
    name: 'Cursor',
    icon: '🖱️',
    template: (content: string, name: string) => `# PRD: ${name}

我需要你根据以下PRD文档来实现这个项目。请仔细阅读需求，然后帮我：
1. 设计技术架构
2. 规划文件结构
3. 逐步实现各个功能模块

## PRD 文档内容

${content}

---

请先给我一个实现计划概述，然后我们逐步推进。`,
  },
  claude: {
    name: 'Claude',
    icon: '🤖',
    template: (content: string, name: string) => `我有一份产品需求文档（PRD），需要你帮我分析并提供技术实现方案。

## 项目名称
${name}

## PRD 完整内容
${content}

---

请帮我：
1. 分析这个需求的技术可行性
2. 推荐合适的技术栈
3. 设计系统架构
4. 给出开发计划和时间估算
5. 指出可能的技术挑战和解决方案`,
  },
  chatgpt: {
    name: 'ChatGPT',
    icon: '💬',
    template: (content: string, name: string) => `作为一个资深全栈开发工程师，请帮我根据以下PRD实现这个项目。

## 项目：${name}

## 需求文档
${content}

---

请提供：
1. 推荐的技术栈和框架
2. 项目目录结构
3. 核心代码实现
4. 数据库设计
5. API 接口设计`,
  },
  v0: {
    name: 'v0.dev',
    icon: '⚡',
    template: (content: string, name: string) => `请根据以下PRD需求，生成一个完整的React组件实现。

项目：${name}

需求描述：
${content.slice(0, 2000)}${content.length > 2000 ? '\n\n...(内容已截断)' : ''}

---

请生成：
1. 完整的 React 组件代码
2. 使用 Tailwind CSS 进行样式设计
3. 包含必要的交互逻辑
4. 使用 shadcn/ui 组件库`,
  },
  bolt: {
    name: 'Bolt.new',
    icon: '⚡',
    template: (content: string, name: string) => `创建一个完整的项目：${name}

功能需求：
${content.slice(0, 3000)}${content.length > 3000 ? '\n\n...(内容已截断)' : ''}

请使用 Next.js + TypeScript + Tailwind CSS 实现。`,
  },
};

export function CopyToAITools({ prdContent, projectName }: CopyToAIToolsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (tool: keyof typeof AI_TOOL_TEMPLATES) => {
    const template = AI_TOOL_TEMPLATES[tool];
    const content = template.template(prdContent, projectName);
    
    try {
      await copyToClipboard(content);
      setCopied(true);
      toast.success(`已复制为 ${template.name} 格式`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const handlePreview = (tool: keyof typeof AI_TOOL_TEMPLATES) => {
    const template = AI_TOOL_TEMPLATES[tool];
    setPreviewTitle(template.name);
    setPreviewContent(template.template(prdContent, projectName));
    setPreviewOpen(true);
  };

  const handleCopyFromPreview = async () => {
    try {
      await copyToClipboard(previewContent);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  if (!prdContent.trim()) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Code className="h-4 w-4" />
            复制到 AI
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground">
              格式化并复制到 AI 编程工具
            </p>
          </div>
          <DropdownMenuSeparator />
          {Object.entries(AI_TOOL_TEMPLATES).map(([key, tool]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleCopy(key as keyof typeof AI_TOOL_TEMPLATES)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <span>{tool.icon}</span>
                {tool.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(key as keyof typeof AI_TOOL_TEMPLATES);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                预览
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleCopy('cursor')}>
            <Copy className="h-4 w-4 mr-2" />
            快速复制（Cursor格式）
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {previewTitle} 提示词预览
            </DialogTitle>
            <DialogDescription>
              预览将要复制的内容，可以直接编辑后再复制
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4">
            <Textarea
              value={previewContent}
              onChange={(e) => setPreviewContent(e.target.value)}
              className="min-h-[380px] font-mono text-sm resize-none"
            />
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCopyFromPreview}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
