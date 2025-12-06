'use client';

import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GenerationPhase } from '@/types';

interface GenerationStatusBarProps {
  phase: GenerationPhase;
  selectorCount?: number;
  error?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  onExport?: () => void;
  canGeneratePRD?: boolean;
}

export function GenerationStatusBar({
  phase,
  selectorCount = 0,
  error,
  onRetry,
  onDismiss,
  onExport,
  canGeneratePRD = false,
}: GenerationStatusBarProps) {
  // 只在特定状态显示
  if (phase === 'idle' || phase === 'generating') {
    return null;
  }

  // 成功状态
  if (phase === 'interactive' && selectorCount > 0) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 mb-3 sm:mb-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 transition-all">
        <div className="flex items-center gap-1.5 sm:gap-2 text-green-700 dark:text-green-300">
          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium">
            {selectorCount} 个问题已生成，请依次回答
          </span>
          {canGeneratePRD && (
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-800 ml-1">
              可生成 PRD
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 justify-end">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport} className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2 touch-feedback">
              <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              导出
            </Button>
          )}
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2 touch-feedback">
              <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              重新生成
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-6 w-6 sm:h-7 sm:w-7 touch-feedback">
              <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 错误状态
  if (phase === 'error') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 mb-3 sm:mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 transition-all">
        <div className="flex items-center gap-1.5 sm:gap-2 text-red-700 dark:text-red-300 min-w-0">
          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium truncate">
            生成失败{error ? `：${error}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 justify-end flex-shrink-0">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2 border-red-300 hover:bg-red-100 touch-feedback">
              <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              重试
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 touch-feedback">
              <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 超时状态
  if (phase === 'timeout') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 mb-3 sm:mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 transition-all">
        <div className="flex items-center gap-1.5 sm:gap-2 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium">
            生成超时，请重试或稍后再试
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 justify-end flex-shrink-0">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2 border-amber-300 hover:bg-amber-100 touch-feedback">
              <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              重试
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600 touch-feedback">
              <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
