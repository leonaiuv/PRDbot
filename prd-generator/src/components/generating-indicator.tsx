'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GENERATION_STEPS, type GenerationStep } from '@/types';

interface GeneratingIndicatorProps {
  currentStep: GenerationStep;
  stepIndex: number;
  elapsedTime: number;
  onCancel?: () => void;
  canCancel?: boolean;
}

export function GeneratingIndicator({
  currentStep,
  stepIndex,
  elapsedTime,
  onCancel,
  canCancel = true,
}: GeneratingIndicatorProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // 当前步骤配置
  const currentStepConfig = GENERATION_STEPS[stepIndex];
  const targetProgress = currentStepConfig?.percent || 0;
  
  // 预计剩余时间（秒）
  const estimatedTotal = 15; // 预计总时间15秒
  const remainingTime = Math.max(0, estimatedTotal - elapsedTime);

  // 动画过渡进度条
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatedProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 1) return targetProgress;
        return prev + diff * 0.1;
      });
    }, 50);
    
    return () => clearInterval(timer);
  }, [targetProgress]);

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] sm:max-w-[85%] w-full rounded-xl p-3 sm:p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900 transition-all">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0">
            <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
              AI 助手正在分析您的需求...
            </p>
          </div>
          {canCancel && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0 touch-feedback"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>

        {/* 步骤指示器 */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between text-[10px] sm:text-xs mb-2 gap-1">
            {GENERATION_STEPS.map((step, index) => (
              <div
                key={step.key}
                className={`flex items-center gap-0.5 sm:gap-1 transition-colors ${
                  index <= stepIndex
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full text-[10px] sm:text-xs border transition-colors flex-shrink-0 ${
                    index < stepIndex
                      ? 'bg-blue-600 text-white border-blue-600'
                      : index === stepIndex
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-muted-foreground'
                  }`}
                >
                  {index < stepIndex ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline truncate">{step.label}</span>
              </div>
            ))}
          </div>
          
          {/* 进度条 */}
          <Progress value={animatedProgress} className="h-1.5 sm:h-2" />
        </div>

        {/* 底部信息 */}
        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
            <span className="truncate">
              {currentStepConfig?.label || '处理中'}...
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <span>已用 {elapsedTime}s</span>
            {remainingTime > 0 && (
              <span className="hidden xs:inline">剩余约 {remainingTime}s</span>
            )}
          </div>
        </div>

        {/* 提示信息 */}
        {elapsedTime > 10 && (
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-muted">
            ⏳ 生成时间较长，请耐心等待。如长时间无响应，可取消重试。
          </p>
        )}
      </div>
    </div>
  );
}
