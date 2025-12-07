'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, LayoutTemplate, PenLine } from 'lucide-react';
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
import { TemplateSelector } from '@/components/template-selector';
import { useProjectStore } from '@/store';
import { type PRDTemplate, getTemplateInitialInput, PRD_TEMPLATES } from '@/lib/templates';

export function NewProjectDialog() {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'template' | 'custom'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<PRDTemplate | null>(
    PRD_TEMPLATES.find(t => t.id === 'blank') || null
  );

  const handleSelectTemplate = (template: PRDTemplate) => {
    setSelectedTemplate(template);
    if (template.id !== 'blank') {
      setInput(getTemplateInitialInput(template));
    } else {
      setInput('');
    }
  };

  const handleCreate = async () => {
    const finalInput = activeTab === 'template' && selectedTemplate
      ? (selectedTemplate.id === 'blank' ? input : getTemplateInitialInput(selectedTemplate) + (input ? '\n\n' + input : ''))
      : input;

    if (!finalInput.trim()) {
      toast.error('请输入产品描述');
      return;
    }

    setIsLoading(true);
    try {
      // 从输入中提取项目名称（取前20个字符或第一句话）
      const name = selectedTemplate && selectedTemplate.id !== 'blank'
        ? selectedTemplate.name
        : (finalInput.split(/[,，。.!！?？\n]/)[0].slice(0, 20) || '未命名项目');
      const project = await createProject(name, finalInput.trim());
      
      toast.success('项目创建成功');
      setOpen(false);
      setInput('');
      setSelectedTemplate(PRD_TEMPLATES.find(t => t.id === 'blank') || null);
      router.push(`/project/${project.id}/chat`);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('创建项目失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 touch-feedback">
          <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">新建</span>项目
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] mx-4 sm:mx-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            新建 PRD 项目
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            选择模板快速开始，或自由描述你的产品想法。
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'custom')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="template" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              使用模板
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <PenLine className="h-4 w-4" />
              自由输入
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="template" className="space-y-4">
            <TemplateSelector 
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleSelectTemplate}
            />
            {selectedTemplate && selectedTemplate.id !== 'blank' && (
              <div className="space-y-2">
                <Label htmlFor="additional" className="text-sm">补充说明（可选）</Label>
                <Textarea
                  id="additional"
                  placeholder="添加更多具体需求..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            )}
            {selectedTemplate?.id === 'blank' && (
              <div className="space-y-2">
                <Label htmlFor="blank-input" className="text-sm">产品描述</Label>
                <Textarea
                  id="blank-input"
                  placeholder="例如：帮我生成一个文生图应用..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm">产品描述</Label>
              <Textarea
                id="description"
                placeholder="例如：帮我生成一个文生图应用，或者：我想做一个在线协作白板工具"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
                className="resize-none text-sm sm:text-base min-h-[100px] sm:min-h-[120px]"
              />
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 sm:p-3">
              <p>💡 提示：你可以输入一句话或模糊的产品想法，AI 会引导你完善细节。</p>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            className="h-9 sm:h-10 text-sm touch-feedback"
          >
            取消
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isLoading || (activeTab === 'custom' ? !input.trim() : !selectedTemplate || (selectedTemplate.id === 'blank' && !input.trim()))}
            className="h-9 sm:h-10 text-sm touch-feedback"
          >
            {isLoading ? '创建中...' : '开始'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
