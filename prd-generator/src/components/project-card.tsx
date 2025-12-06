'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { MoreVertical, Trash2, FileDown, Play, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/store';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
}

const statusMap = {
  exploring: { label: '需求探索中', variant: 'default' as const },
  generated: { label: 'PRD 已生成', variant: 'secondary' as const },
  exported: { label: '已导出', variant: 'outline' as const },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { deleteProject } = useProjectStore();

  const handleContinue = () => {
    if (project.status === 'exploring') {
      router.push(`/project/${project.id}/chat`);
    } else {
      router.push(`/project/${project.id}/prd`);
    }
  };

  const handleDelete = async () => {
    if (confirm('确定要删除这个项目吗？')) {
      await deleteProject(project.id);
      toast.success('项目已删除');
    }
  };

  const handleExport = () => {
    router.push(`/project/${project.id}/prd?export=true`);
  };

  const status = statusMap[project.status];
  const formattedDate = format(new Date(project.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN });

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:translate-y-[-2px] touch-feedback cursor-pointer" onClick={handleContinue}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg line-clamp-1 flex-1">{project.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 sm:h-8 sm:w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0"
              >
                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleContinue}>
                {project.status === 'exploring' ? (
                  <>
                    <Play className="mr-2 h-4 w-4" /> 继续编辑
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" /> 查看PRD
                  </>
                )}
              </DropdownMenuItem>
              {project.status !== 'exploring' && (
                <DropdownMenuItem onClick={handleExport}>
                  <FileDown className="mr-2 h-4 w-4" /> 导出
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Badge variant={status.variant} className="w-fit text-[10px] sm:text-xs">{status.label}</Badge>
      </CardHeader>
      
      <CardContent className="pb-2 sm:pb-3">
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2 sm:mb-3">
          {project.initialInput || '暂无描述'}
        </p>
        
        {project.status === 'exploring' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
              <span>进度</span>
              <span>{project.metadata.questionCount}/20 问题</span>
            </div>
            <Progress value={project.metadata.progress} className="h-1 sm:h-1.5" />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2 flex justify-between items-center">
        <span className="text-[10px] sm:text-xs text-muted-foreground">{formattedDate}</span>
        <Button 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); handleContinue(); }}
          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 touch-feedback"
        >
          {project.status === 'exploring' ? '继续' : '查看'}
        </Button>
      </CardFooter>
    </Card>
  );
}
