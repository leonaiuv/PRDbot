'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { History, RotateCcw, Trash2, Save, Clock, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { prdVersionsDB } from '@/lib/db';
import type { PRDVersion } from '@/types';

interface VersionHistoryProps {
  projectId: string;
  currentContent: string;
  onRestore: (content: string) => void;
}

export function VersionHistory({ projectId, currentContent, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PRDVersion | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await prdVersionsDB.getByProject(projectId);
      setVersions(data);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleSaveVersion = async () => {
    if (!currentContent.trim()) {
      toast.error('没有内容可保存');
      return;
    }

    try {
      const version: PRDVersion = {
        id: uuidv4(),
        projectId,
        content: currentContent,
        createdAt: Date.now(),
        description: versionDescription || undefined,
        isAuto: false,
      };
      await prdVersionsDB.create(version);
      await prdVersionsDB.cleanupOld(projectId, 20); // 保留最近20个版本
      await loadVersions();
      setSaveDialogOpen(false);
      setVersionDescription('');
      toast.success('版本已保存');
    } catch (error) {
      console.error('Failed to save version:', error);
      toast.error('保存失败');
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    onRestore(selectedVersion.content);
    setRestoreDialogOpen(false);
    setSelectedVersion(null);
    toast.success('已恢复到所选版本');
  };

  const handleDeleteVersion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await prdVersionsDB.delete(id);
      await loadVersions();
      toast.success('版本已删除');
    } catch (error) {
      console.error('Failed to delete version:', error);
      toast.error('删除失败');
    }
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <History className="h-4 w-4" />
            版本历史
            {versions.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {versions.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              版本历史
            </SheetTitle>
            <SheetDescription>
              查看和恢复PRD的历史版本
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <Button
              onClick={() => setSaveDialogOpen(true)}
              className="w-full gap-2"
              disabled={!currentContent.trim()}
            >
              <Save className="h-4 w-4" />
              保存当前版本
            </Button>

            <Separator />

            <ScrollArea className="h-[calc(100vh-280px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无历史版本</p>
                  <p className="text-sm mt-1">保存当前版本以开始追踪</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className="group p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedVersion(version);
                        setRestoreDialogOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              版本 {versions.length - index}
                            </span>
                            {version.isAuto && (
                              <Badge variant="secondary" className="text-[10px]">
                                自动保存
                              </Badge>
                            )}
                          </div>
                          {version.description && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {version.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                            <Clock className="h-3 w-3" />
                            {format(new Date(version.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => handleDeleteVersion(version.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* 保存版本对话框 */}
      <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存版本</AlertDialogTitle>
            <AlertDialogDescription>
              为当前版本添加一个描述（可选）
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="版本描述，如：修复了需求描述"
            value={versionDescription}
            onChange={(e) => setVersionDescription(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveVersion}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 恢复版本对话框 */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复版本</AlertDialogTitle>
            <AlertDialogDescription>
              确定要恢复到此版本吗？当前内容将被替换。建议先保存当前版本。
              {selectedVersion && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(selectedVersion.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </div>
                  {selectedVersion.description && (
                    <p className="mt-1">{selectedVersion.description}</p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              <RotateCcw className="mr-2 h-4 w-4" />
              恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 自动保存版本的Hook
export function useAutoSaveVersion(projectId: string, content: string, enabled: boolean = true) {
  const [lastSavedContent, setLastSavedContent] = useState('');

  useEffect(() => {
    if (!enabled || !content.trim() || content === lastSavedContent) return;

    // 内容变化后5分钟自动保存
    const timer = setTimeout(async () => {
      try {
        // 检查内容是否有实质性变化（超过50个字符的差异）
        if (Math.abs(content.length - lastSavedContent.length) > 50) {
          const version: PRDVersion = {
            id: uuidv4(),
            projectId,
            content,
            createdAt: Date.now(),
            description: '自动保存',
            isAuto: true,
          };
          await prdVersionsDB.create(version);
          await prdVersionsDB.cleanupOld(projectId, 20);
          setLastSavedContent(content);
        }
      } catch (error) {
        console.error('Auto-save version failed:', error);
      }
    }, 5 * 60 * 1000); // 5分钟

    return () => clearTimeout(timer);
  }, [projectId, content, lastSavedContent, enabled]);
}
