'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImportPRDDialogProps {
  onImport: (content: string) => void;
  model?: string;
  apiKey?: string;
  customApiUrl?: string;
}

export function ImportPRDDialog({ 
  onImport, 
  model, 
  apiKey, 
  customApiUrl 
}: ImportPRDDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = ['.md', '.txt', '.markdown'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      toast.error('只支持 Markdown 或文本文件');
      return;
    }

    try {
      const text = await file.text();
      setContent(text);
      toast.success(`已读取文件: ${file.name}`);
    } catch {
      toast.error('读取文件失败');
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast.error('请先导入内容');
      return;
    }

    if (!apiKey) {
      toast.error('请先配置 API Key');
      return;
    }

    setIsAnalyzing(true);
    setSuggestions('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'optimize',
          prdContent: content,
          model,
          apiKey,
          customApiUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('分析失败');
      }

      const data = await response.json();
      setSuggestions(data.content);
    } catch {
      toast.error('分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = () => {
    if (!content.trim()) {
      toast.error('内容不能为空');
      return;
    }

    onImport(content);
    setOpen(false);
    setContent('');
    setSuggestions('');
    toast.success('PRD 已导入');
  };

  const handleClose = () => {
    setOpen(false);
    setContent('');
    setSuggestions('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Upload className="h-4 w-4" />
          导入 PRD
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            导入已有 PRD
          </DialogTitle>
          <DialogDescription>
            导入 Markdown 格式的 PRD 文档，AI 可以帮助分析和优化
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'file')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="paste">粘贴内容</TabsTrigger>
            <TabsTrigger value="file">上传文件</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <Label>PRD 内容</Label>
              <Textarea
                placeholder="粘贴你的 PRD 文档内容（Markdown 格式）..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".md,.txt,.markdown"
                className="hidden"
              />
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                支持 .md, .txt, .markdown 格式
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </Button>
            </div>
            {content && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  已读取 {content.length} 个字符
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        {content && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>预览</Label>
              {apiKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      AI 分析建议
                    </>
                  )}
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content.length > 2000 
                    ? content.slice(0, 2000) + '\n\n...(内容已截断)' 
                    : content
                  }
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        )}

        {suggestions && (
          <div className="space-y-2">
            <Label>AI 分析建议</Label>
            <ScrollArea className="h-[150px] border rounded-md p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {suggestions}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={!content.trim()}>
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
