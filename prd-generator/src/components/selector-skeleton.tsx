'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface SelectorSkeletonProps {
  count?: number;
}

// 单个骨架屏卡片
function SkeletonCard() {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-muted animate-pulse">
      {/* 问题标题 */}
      <Skeleton className="h-5 w-3/4" />
      
      {/* 选项列表 */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      
      {/* 确认按钮 */}
      <div className="flex justify-end pt-2">
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

// 骨架屏组
export function SelectorSkeleton({ count = 2 }: SelectorSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

// 紧凑型骨架屏（单行）
export function CompactSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg animate-pulse">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 flex-1 max-w-xs" />
    </div>
  );
}
