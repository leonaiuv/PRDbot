'use client';

import { useState } from 'react';
import { Languages, Loader2, Globe, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard, exportMarkdown } from '@/lib/export';

interface MultiLanguagePRDProps {
  prdContent: string;
  projectName: string;
  model: string;
  apiKey: string;
  customApiUrl?: string;
}

const LANGUAGES = [
  { code: 'en', name: '英语', flag: '🇺🇸', nativeName: 'English' },
  { code: 'ja', name: '日语', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: '韩语', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'de', name: '德语', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'fr', name: '法语', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'es', name: '西班牙语', flag: '🇪🇸', nativeName: 'Español' },
];

export function MultiLanguagePRD({
  prdContent,
  projectName,
  model,
  apiKey,
  customApiUrl,
}: MultiLanguagePRDProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [translatedContent, setTranslatedContent] = useState('');
  const [currentLang, setCurrentLang] = useState<typeof LANGUAGES[0] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleTranslate = async (lang: typeof LANGUAGES[0]) => {
    if (!prdContent.trim()) {
      toast.error('没有PRD内容可翻译');
      return;
    }

    if (!apiKey) {
      toast.error('请先配置 API Key');
      return;
    }

    setCurrentLang(lang);
    setIsLoading(true);
    setDialogOpen(true);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: prdContent,
          targetLang: lang.nativeName,
          model,
          apiKey,
          customApiUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '翻译失败');
      }

      const data = await response.json();
      setTranslatedContent(data.content);
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(error instanceof Error ? error.message : '翻译失败');
      setDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(translatedContent);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const handleExport = () => {
    if (currentLang) {
      exportMarkdown(translatedContent, `${projectName}_${currentLang.code}`);
      toast.success('导出成功');
    }
  };

  if (!prdContent.trim()) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Languages className="h-4 w-4" />
            翻译
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleTranslate(lang)}
              className="gap-2"
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              <span className="text-muted-foreground text-xs ml-auto">
                {lang.nativeName}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {currentLang?.flag} {currentLang?.name}版本
            </DialogTitle>
            <DialogDescription>
              PRD 文档已翻译为 {currentLang?.nativeName}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                正在翻译为{currentLang?.name}，请稍候...
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] mt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {translatedContent}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={handleCopy}>
                  复制
                </Button>
                <Button onClick={handleExport}>
                  导出 {currentLang?.code.toUpperCase()} 版本
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
