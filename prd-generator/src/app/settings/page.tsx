'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/store';
import { AI_MODELS } from '@/types';

export default function SettingsPage() {
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [customUrl, setCustomUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('deepseek');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setApiKeys(settings.apiKeys || {});
      setCustomUrl(settings.customApiUrl || '');
      setDefaultModel(settings.defaultModel || 'deepseek');
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // P3: 合并为一次原子操作，避免多次 DB 写入
      await updateSettings({
        apiKeys,
        defaultModel,
        customApiUrl: customUrl,
      });

      toast.success('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 sm:h-16 items-center">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 touch-feedback">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div className="ml-3 sm:ml-4">
            <h1 className="font-semibold text-base sm:text-lg">设置</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">管理你的 AI 模型和 API 配置</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        <div className="space-y-6">
          {/* 默认模型选择 */}
          <Card className="shadow-sm border-0 bg-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                AI 模型
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm pl-3">选择默认使用的 AI 模型</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger className="h-10 sm:h-11">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* API Keys 配置 */}
          <Card className="shadow-sm border-0 bg-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                API Keys
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm pl-3">
                配置各个 AI 服务商的 API Key，密钥将加密保存在本地
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {AI_MODELS.filter(m => m.id !== 'custom').map((model) => (
                <div key={model.id} className="space-y-2 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                  <Label htmlFor={`key-${model.id}`} className="text-sm font-medium">{model.name} API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`key-${model.id}`}
                        type={showKeys[model.id] ? 'text' : 'password'}
                        value={apiKeys[model.id] || ''}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, [model.id]: e.target.value }))}
                        placeholder={`输入 ${model.name} API Key`}
                        className="h-10 sm:h-11 text-sm pr-10"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowKey(model.id)}
                      className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-feedback"
                    >
                      {showKeys[model.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

              <Separator className="my-4" />

              {/* 自定义 API */}
              <div className="space-y-2">
                <Label htmlFor="custom-url" className="text-sm">自定义 API URL（可选）</Label>
                <Input
                  id="custom-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://your-api-endpoint.com/v1/chat/completions"
                  className="h-10 sm:h-11 text-sm"
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  如果你有自己的 API 代理或私有部署，可以在这里配置
                </p>
              </div>

              {defaultModel === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="key-custom" className="text-sm">自定义 API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="key-custom"
                        type={showKeys['custom'] ? 'text' : 'password'}
                        value={apiKeys['custom'] || ''}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, custom: e.target.value }))}
                        placeholder="输入自定义 API Key"
                        className="h-10 sm:h-11 text-sm"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowKey('custom')}
                      className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-feedback"
                    >
                      {showKeys['custom'] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 导出偏好 */}
          <Card className="shadow-sm border-0 bg-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                导出设置
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm pl-3">配置 PRD 文档的默认导出格式</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings?.exportPreferences?.defaultFormat || 'md'}
                onValueChange={(value: 'md' | 'pdf' | 'docx') => 
                  updateSettings({ exportPreferences: { defaultFormat: value } })
                }
              >
                <SelectTrigger className="h-10 sm:h-11">
                  <SelectValue placeholder="选择导出格式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                  <SelectItem value="docx">Word (.docx)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="sticky bottom-6 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              size="lg"
              className="w-full h-11 sm:h-12 shadow-lg touch-feedback font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存设置
                </>
              )}
            </Button>
          </div>

          {/* 帮助信息 */}
          <Card className="shadow-sm border-0 bg-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                获取 API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm text-muted-foreground">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <strong className="text-foreground">DeepSeek</strong>
                    <p className="mt-0.5">访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">platform.deepseek.com</a> 注册并获取 API Key</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <strong className="text-foreground">Qwen（通义千问）</strong>
                    <p className="mt-0.5">访问 <a href="https://dashscope.console.aliyun.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">阿里云 DashScope</a> 开通服务</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <strong className="text-foreground">Doubao（豆包）</strong>
                    <p className="mt-0.5">访问 <a href="https://www.volcengine.com/product/doubao" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">火山引擎</a> 开通服务</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* 底部安全区域 */}
      <div className="safe-area-inset" />
    </div>
  );
}
