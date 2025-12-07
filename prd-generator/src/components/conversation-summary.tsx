'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ConversationMessage } from '@/types';

interface ConversationSummaryProps {
  conversation: ConversationMessage[];
  className?: string;
}

interface SummaryItem {
  question: string;
  answer: string;
  timestamp: number;
}

export function ConversationSummary({ conversation, className }: ConversationSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 从对话中提取问答对
  const summaryItems: SummaryItem[] = [];
  
  for (let i = 0; i < conversation.length - 1; i++) {
    const msg = conversation[i];
    const nextMsg = conversation[i + 1];
    
    // 如果当前是AI问题，下一个是用户回答
    if (msg.role === 'assistant' && nextMsg.role === 'user') {
      // 提取问题核心（取第一行或前50个字符）
      const questionText = msg.content.split('\n')[0].slice(0, 100);
      const answerText = nextMsg.content.slice(0, 200);
      
      summaryItems.push({
        question: questionText,
        answer: answerText,
        timestamp: nextMsg.timestamp,
      });
    }
  }

  if (summaryItems.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm font-medium">已确认信息</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {summaryItems.length} 项
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-3">
                {summaryItems.map((item, index) => (
                  <div 
                    key={index} 
                    className="text-sm border-l-2 border-primary/30 pl-3 py-1"
                  >
                    <div className="text-muted-foreground text-xs mb-1">
                      {item.question}
                    </div>
                    <div className="font-medium">
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// 简化版摘要卡片（用于侧边栏）
interface QuickSummaryProps {
  conversation: ConversationMessage[];
}

export function QuickSummary({ conversation }: QuickSummaryProps) {
  // 提取关键信息
  const keyInfo: { label: string; value: string }[] = [];
  
  const keywords = ['产品名称', '目标用户', '核心功能', '技术栈', '平台'];
  
  for (const msg of conversation) {
    if (msg.role === 'user') {
      // 简单匹配一些常见模式
      for (const keyword of keywords) {
        if (msg.content.includes(keyword)) {
          const value = msg.content.slice(0, 50);
          if (!keyInfo.find(k => k.label === keyword)) {
            keyInfo.push({ label: keyword, value });
          }
        }
      }
    }
  }

  // 从初始输入提取产品描述
  const initialInput = conversation[0]?.content;
  if (initialInput && conversation[0]?.role === 'user') {
    keyInfo.unshift({
      label: '产品想法',
      value: initialInput.slice(0, 80) + (initialInput.length > 80 ? '...' : ''),
    });
  }

  if (keyInfo.length === 0) {
    return null;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        快速摘要
      </div>
      <div className="space-y-1.5">
        {keyInfo.slice(0, 3).map((info, index) => (
          <div key={index} className="text-xs">
            <span className="text-muted-foreground">{info.label}：</span>
            <span className="text-foreground">{info.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
