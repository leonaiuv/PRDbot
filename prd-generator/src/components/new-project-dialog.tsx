'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
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
import { useProjectStore } from '@/store';

export function NewProjectDialog() {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!input.trim()) {
      toast.error('请输入产品描述');
      return;
    }

    setIsLoading(true);
    try {
      // 从输入中提取项目名称（取前20个字符或第一句话）
      const name = input.split(/[,，。.!！?？\n]/)[0].slice(0, 20) || '未命名项目';
      const project = await createProject(name, input.trim());
      
      toast.success('项目创建成功');
      setOpen(false);
      setInput('');
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>新建 PRD 项目</DialogTitle>
          <DialogDescription>
            请描述你想要构建的产品，AI 将通过多轮对话帮你生成完整的 PRD 文档。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="description">产品描述</Label>
            <Textarea
              id="description"
              placeholder="例如：帮我生成一个文生图应用，或者：我想做一个在线协作白板工具"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>提示：你可以输入一句话或模糊的产品想法，AI 会引导你完善细节。</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? '创建中...' : '开始'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
