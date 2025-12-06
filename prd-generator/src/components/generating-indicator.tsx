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
      <div className="max-w-[85%] w-full rounded-lg p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900">
            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              AI 助手正在分析您的需求...
            </p>
          </div>
          {canCancel && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 步骤指示器 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            {GENERATION_STEPS.map((step, index) => (
              <div
                key={step.key}
                className={`flex items-center gap-1 transition-colors ${
                  index <= stepIndex
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`w-5 h-5 flex items-center justify-center rounded-full text-xs border transition-colors ${
                    index < stepIndex
                      ? 'bg-blue-600 text-white border-blue-600'
                      : index === stepIndex
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-muted-foreground'
                  }`}
                >
                  {index < stepIndex ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            ))}
          </div>
          
          {/* 进度条 */}
          <Progress value={animatedProgress} className="h-2" />
        </div>

        {/* 底部信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {currentStepConfig?.label || '处理中'}...
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>已用时 {elapsedTime}s</span>
            {remainingTime > 0 && (
              <span>预计剩余 {remainingTime}s</span>
            )}
          </div>
        </div>

        {/* 提示信息 */}
        {elapsedTime > 10 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 pt-3 border-t border-muted">
            ⏳ 生成时间较长，请耐心等待。如长时间无响应，可点击取消后重试。
          </p>
        )}
      </div>
    </div>
  );
}
