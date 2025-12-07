'use client';

import { useState, useMemo } from 'react';
import { Share2, Link, Copy, Check, Clock, Lock, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { generateShareLink, isContentShareable } from '@/lib/share';

interface SharePRDDialogProps {
  prdContent: string;
  projectName: string;
}

export function SharePRDDialog({ prdContent, projectName }: SharePRDDialogProps) {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('never');

  // 使用 useMemo 计算派生状态，避免在 useEffect 中 setState
  const shareability = useMemo(() => {
    return prdContent ? isContentShareable(prdContent) : null;
  }, [prdContent]);

  // 生成分享链接
  const handleGenerateLink = () => {
    if (!prdContent) {
      toast.error('没有可分享的内容');
      return;
    }

    if (usePassword && !password) {
      toast.error('请输入分享密码');
      return;
    }

    try {
      const link = generateShareLink(projectName, prdContent, {
        password: usePassword ? password : undefined,
        expiresIn: expiresIn !== 'never' ? parseInt(expiresIn) : undefined,
      });

      setShareLink(link);
    } catch {
      toast.error('生成分享链接失败');
    }
  };

  // 复制链接
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // 重置状态
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setShareLink('');
      setCopied(false);
      setPassword('');
      setUsePassword(false);
      setExpiresIn('never');
    }
  };

  const canShare = shareability?.shareable ?? false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
              disabled={!prdContent}
            >
              <Share2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">分享</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>分享 PRD 文档</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            分享 PRD 文档
          </DialogTitle>
          <DialogDescription>
            生成只读分享链接，可设置有效期和密码保护
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 内容大小提示 */}
          {shareability && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              canShare 
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' 
                : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'
            }`}>
              {canShare ? (
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                {canShare ? (
                  <>
                    <p>内容压缩后约 {(shareability.size / 1000).toFixed(1)} KB</p>
                    <p className="text-xs opacity-80">
                      压缩率: {shareability.compressionRatio.toFixed(1)}x
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">内容过大，无法通过链接分享</p>
                    <p className="text-xs opacity-80">
                      建议使用导出功能下载文档后分享
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {canShare && (
            <>
              {/* 有效期设置 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  有效期
                </Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永久有效</SelectItem>
                    <SelectItem value="1">1 小时</SelectItem>
                    <SelectItem value="24">1 天</SelectItem>
                    <SelectItem value="168">7 天</SelectItem>
                    <SelectItem value="720">30 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 密码保护 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    密码保护
                  </Label>
                  <Switch 
                    checked={usePassword} 
                    onCheckedChange={setUsePassword}
                  />
                </div>
                {usePassword && (
                  <Input
                    type="password"
                    placeholder="设置访问密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </div>

              {/* 生成按钮 */}
              {!shareLink && (
                <Button 
                  onClick={handleGenerateLink} 
                  className="w-full"
                  disabled={usePassword && !password}
                >
                  <Link className="mr-2 h-4 w-4" />
                  生成分享链接
                </Button>
              )}

              {/* 分享链接 */}
              {shareLink && (
                <div className="space-y-2">
                  <Label>分享链接</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareLink}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {usePassword && '访问时需要输入密码 • '}
                    {expiresIn !== 'never' 
                      ? `链接将在 ${expiresIn === '1' ? '1 小时' : expiresIn === '24' ? '1 天' : expiresIn === '168' ? '7 天' : '30 天'} 后失效`
                      : '链接永久有效'
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
