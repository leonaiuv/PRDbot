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
  const { settings, loadSettings, updateSettings, setApiKey } = useSettingsStore();
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
      // 保存所有API Keys
      for (const [provider, key] of Object.entries(apiKeys)) {
        if (key) {
          await setApiKey(provider, key);
        }
      }

      // 保存其他设置
      await updateSettings({
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
    <div className="min-h-screen">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="ml-4 font-semibold">设置</h1>
        </div>
      </header>

      <main className="container py-6 max-w-2xl">
        <div className="space-y-6">
          {/* 默认模型选择 */}
          <Card>
            <CardHeader>
              <CardTitle>AI 模型</CardTitle>
              <CardDescription>选择默认使用的 AI 模型</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger>
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
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                配置各个 AI 服务商的 API Key，密钥将加密保存在本地
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {AI_MODELS.filter(m => m.id !== 'custom').map((model) => (
                <div key={model.id} className="space-y-2">
                  <Label htmlFor={`key-${model.id}`}>{model.name} API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`key-${model.id}`}
                        type={showKeys[model.id] ? 'text' : 'password'}
                        value={apiKeys[model.id] || ''}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, [model.id]: e.target.value }))}
                        placeholder={`输入 ${model.name} API Key`}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowKey(model.id)}
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

              <Separator />

              {/* 自定义 API */}
              <div className="space-y-2">
                <Label htmlFor="custom-url">自定义 API URL（可选）</Label>
                <Input
                  id="custom-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://your-api-endpoint.com/v1/chat/completions"
                />
                <p className="text-xs text-muted-foreground">
                  如果你有自己的 API 代理或私有部署，可以在这里配置
                </p>
              </div>

              {defaultModel === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="key-custom">自定义 API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="key-custom"
                        type={showKeys['custom'] ? 'text' : 'password'}
                        value={apiKeys['custom'] || ''}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, custom: e.target.value }))}
                        placeholder="输入自定义 API Key"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowKey('custom')}
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
          <Card>
            <CardHeader>
              <CardTitle>导出设置</CardTitle>
              <CardDescription>配置 PRD 文档的默认导出格式</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings?.exportPreferences?.defaultFormat || 'md'}
                onValueChange={(value: 'md' | 'pdf' | 'docx') => 
                  updateSettings({ exportPreferences: { defaultFormat: value } })
                }
              >
                <SelectTrigger>
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
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
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
          <Card>
            <CardHeader>
              <CardTitle>获取 API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>DeepSeek：</strong>
                访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">platform.deepseek.com</a> 注册并获取 API Key
              </p>
              <p>
                <strong>Qwen（通义千问）：</strong>
                访问 <a href="https://dashscope.console.aliyun.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">阿里云 DashScope</a> 开通服务
              </p>
              <p>
                <strong>Doubao（豆包）：</strong>
                访问 <a href="https://www.volcengine.com/product/doubao" target="_blank" rel="noopener noreferrer" className="text-primary underline">火山引擎</a> 开通服务
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
