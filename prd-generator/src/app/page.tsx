'use client';

import { useEffect, useState } from 'react';
import { Search, Settings, FileText } from 'lucide-react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectCard } from '@/components/project-card';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { useProjectStore } from '@/store';

export default function Home() {
  const { projects, isLoading, searchKeyword, loadProjects, setSearchKeyword } = useProjectStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadProjects();
  }, [loadProjects]);

  // 过滤项目
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    p.initialInput.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 sm:h-16 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-semibold text-base sm:text-lg">PRD 生成工具</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 touch-feedback">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <NewProjectDialog />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        {/* 搜索框 */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="搜索项目..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-9 h-10 sm:h-11 transition-shadow focus:shadow-md"
            />
          </div>
        </div>

        {/* 项目列表 */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3 animate-pulse">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted mb-4 sm:mb-6">
              <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-medium mb-2">
              {searchKeyword ? '没有找到匹配的项目' : '还没有项目'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-sm mx-auto">
              {searchKeyword ? '尝试使用其他关键词搜索' : '点击上方"新建项目"按钮开始创建你的第一个 PRD'}
            </p>
            {!searchKeyword && <NewProjectDialog />}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
      
      {/* 底部安全区域 */}
      <div className="safe-area-inset" />
    </div>
  );
}
