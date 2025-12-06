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
      <div className="flex items-center justify-between gap-4 p-3 mb-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            {selectorCount} 个问题已生成，请依次回答
          </span>
          {canGeneratePRD && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-800 ml-2">
              可生成 PRD
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              导出
            </Button>
          )}
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              重新生成
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-7 w-7">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 错误状态
  if (phase === 'error') {
    return (
      <div className="flex items-center justify-between gap-4 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            生成失败{error ? `：${error}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs border-red-300 hover:bg-red-100">
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-7 w-7 text-red-600">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 超时状态
  if (phase === 'timeout') {
    return (
      <div className="flex items-center justify-between gap-4 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            生成超时，请重试或稍后再试
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs border-amber-300 hover:bg-amber-100">
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-7 w-7 text-amber-600">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
