'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface SelectorSkeletonProps {
  count?: number;
}

// 单个骨架屏卡片
function SkeletonCard() {
  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-muted/30 rounded-xl border border-muted animate-pulse">
      {/* 问题标题 */}
      <Skeleton className="h-4 sm:h-5 w-3/4" />
      
      {/* 选项列表 */}
      <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full flex-shrink-0" />
          <Skeleton className="h-3.5 sm:h-4 w-40 sm:w-48" />
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full flex-shrink-0" />
          <Skeleton className="h-3.5 sm:h-4 w-48 sm:w-56" />
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full flex-shrink-0" />
          <Skeleton className="h-3.5 sm:h-4 w-32 sm:w-40" />
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full flex-shrink-0" />
          <Skeleton className="h-3.5 sm:h-4 w-36 sm:w-44" />
        </div>
      </div>
      
      {/* 确认按钮 */}
      <div className="flex justify-end pt-1 sm:pt-2">
        <Skeleton className="h-8 sm:h-9 w-16 sm:w-20 rounded-md" />
      </div>
    </div>
  );
}

// 骨架屏组
export function SelectorSkeleton({ count = 2 }: SelectorSkeletonProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

// 紧凑型骨架屏（单行）
export function CompactSkeleton() {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-muted/30 rounded-xl animate-pulse">
      <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full flex-shrink-0" />
      <Skeleton className="h-3.5 sm:h-4 flex-1 max-w-xs" />
    </div>
  );
}
