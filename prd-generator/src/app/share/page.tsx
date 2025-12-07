'use client';

import { useEffect, useState, Suspense, useSyncExternalStore, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Lock, AlertCircle, Clock, ArrowLeft, Download, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  parseShareData, 
  decryptContent, 
  isShareExpired, 
  formatExpiresAt,
  type ShareData 
} from '@/lib/share';
import { exportMarkdown } from '@/lib/export';

// 使用 useSyncExternalStore 处理 SSR hydration
const useIsMounted = () => {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
};

function SharePageContent() {
  const searchParams = useSearchParams();
  const mounted = useIsMounted();
  
  // 使用 useMemo 计算初始状态，避免在 useEffect 中调用 setState
  const initialState = useMemo(() => {
    const data = searchParams.get('d');
    
    if (!data) {
      return { error: '无效的分享链接', shareData: null, isExpired: false, decryptedContent: null };
    }

    const parsed = parseShareData(data);
    if (!parsed) {
      return { error: '无法解析分享内容', shareData: null, isExpired: false, decryptedContent: null };
    }

    if (isShareExpired(parsed)) {
      return { error: null, shareData: parsed, isExpired: true, decryptedContent: null };
    }

    // 如果没有加密，直接显示内容
    const content = !parsed.isEncrypted ? parsed.content : null;
    return { error: null, shareData: parsed, isExpired: false, decryptedContent: content };
  }, [searchParams]);

  const [shareData, setShareData] = useState<ShareData | null>(initialState.shareData);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(initialState.decryptedContent);
  const [password, setPassword] = useState('');
  const [error] = useState<string | null>(initialState.error);
  const [isExpired] = useState(initialState.isExpired);
  const [copied, setCopied] = useState(false);

  // 当 searchParams 变化时更新状态（重新计算）
  useEffect(() => {
    setShareData(initialState.shareData);
    setDecryptedContent(initialState.decryptedContent);
  }, [initialState]);

  const handleDecrypt = () => {
    if (!shareData || !password) return;

    const decrypted = decryptContent(shareData.content, password);
    if (decrypted) {
      setDecryptedContent(decrypted);
    } else {
      toast.error('密码错误');
    }
  };

  const handleExport = () => {
    if (!decryptedContent || !shareData) return;
    exportMarkdown(decryptedContent, shareData.title || 'PRD文档');
    toast.success('导出成功');
  };

  const handleCopy = async () => {
    if (!decryptedContent) return;
    try {
      await navigator.clipboard.writeText(decryptedContent);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 mb-4">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold mb-2">无效的分享链接</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link href="/">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </Link>
      </div>
    );
  }

  // 已过期状态
  if (isExpired && shareData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-950/30 mb-4">
          <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h1 className="text-xl font-semibold mb-2">分享链接已过期</h1>
        <p className="text-muted-foreground mb-6">
          此分享链接于 {new Date(shareData.expiresAt!).toLocaleString()} 过期
        </p>
        <Link href="/">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </Link>
      </div>
    );
  }

  // 需要密码状态
  if (shareData?.isEncrypted && !decryptedContent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>密码保护</CardTitle>
            <CardDescription>
              此文档需要密码才能查看
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>访问密码</Label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
              />
            </div>
            <Button className="w-full" onClick={handleDecrypt} disabled={!password}>
              解锁查看
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 正常显示内容
  if (decryptedContent && shareData) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* 顶部导航 */}
        <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="container px-4 md:px-6 flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="font-semibold truncate max-w-[200px] sm:max-w-none">
                  {shareData.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {shareData.expiresAt && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {formatExpiresAt(shareData.expiresAt)}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                复制
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
            </div>
          </div>
        </header>

        {/* 内容区域 */}
        <ScrollArea className="flex-1">
          <div className="container max-w-4xl mx-auto px-4 md:px-6 py-8">
            {/* 分享信息提示 */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 pb-4 border-b">
              <FileText className="h-4 w-4" />
              <span>只读分享文档</span>
              <span className="mx-2">•</span>
              <span>
                分享于 {new Date(shareData.createdAt).toLocaleDateString()}
              </span>
              {shareData.expiresAt && (
                <>
                  <span className="mx-2">•</span>
                  <Clock className="h-4 w-4" />
                  <span>{formatExpiresAt(shareData.expiresAt)}</span>
                </>
              )}
            </div>

            {/* PRD 内容 */}
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {decryptedContent}
              </ReactMarkdown>
            </article>
          </div>
        </ScrollArea>

        {/* 底部信息 */}
        <footer className="border-t py-4 bg-muted/30">
          <div className="container text-center text-xs text-muted-foreground">
            此文档由 PRD Generator 生成并分享
          </div>
        </footer>
      </div>
    );
  }

  // 加载中状态
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}
