/**
 * @module pages/TokensPage
 * @description Access Token 管理页（F-M6-18/19/20）：创建/列表/撤销 PAT。
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Key, Plus, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'active', variant: 'default' },
  revoked: { label: 'revoked', variant: 'secondary' },
  expired: { label: 'expired', variant: 'outline' },
};

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<TokenItem | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await apiClient.get('/tokens');
      setTokens(res.data.data || []);
    } catch {
      toast.error('获取 Token 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await apiClient.delete(`/tokens/${revokeTarget.id}`);
      toast.success('Token 已撤销');
      fetchTokens();
    } catch (err: unknown) {
      toast.error((err as Error).message || '撤销失败');
    }
    setRevokeTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Key className="h-5 w-5" />
            Access Token
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理用于 MCP Server 和 API 调用的个人访问令牌
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          创建 Token
        </Button>
      </div>

      {/* Token 列表 */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Key className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">还没有创建任何 Token</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tokens.map((t) => {
            const badge = STATUS_BADGE[t.status] || STATUS_BADGE.active;
            return (
              <div key={t.id} className={`flex items-center justify-between px-4 py-3 ${t.status !== 'active' ? 'opacity-60' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {t.tokenPrefix}...
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    创建于 {new Date(t.createdAt).toLocaleDateString('zh-CN')}
                    {t.lastUsedAt && ` · 最后使用: ${new Date(t.lastUsedAt).toLocaleDateString('zh-CN')}`}
                    {t.expiresAt ? ` · 过期: ${new Date(t.expiresAt).toLocaleDateString('zh-CN')}` : ' · 永不过期'}
                  </p>
                </div>
                {t.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRevokeTarget(t)}
                  >
                    撤销
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 安全提示 */}
      <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Token 创建后仅显示一次，请妥善保存。</span>
      </div>

      {/* 创建 Token Dialog */}
      <CreateTokenDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => fetchTokens()}
      />

      {/* 撤销确认 AlertDialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销 Token</AlertDialogTitle>
            <AlertDialogDescription>
              确认撤销「{revokeTarget?.name}」？<br /><br />
              撤销后，使用此 Token 的 MCP 连接将立即失效，需要重新创建。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
            >
              确认撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// 创建 Token Dialog（两步：填写 → 显示明文）
// ============================================================

function CreateTokenDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [plainToken, setPlainToken] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep('form');
    setName('');
    setExpiresAt('');
    setPlainToken('');
    setCopied(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: { name: string; expiresAt?: string } = { name };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const res = await apiClient.post('/tokens', body);
      setPlainToken(res.data.data.plainToken);
      setStep('result');
      onCreated();
    } catch (err: unknown) {
      toast.error((err as Error).message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainToken);
    setCopied(true);
    toast.success('已复制到剪贴板');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>创建 Access Token</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token 名称 *</Label>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="我的 Claude Code"
                  required
                />
                <p className="text-xs text-muted-foreground">用于标识此 Token 的用途</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expires">过期时间（可选）</Label>
                <Input
                  id="token-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">留空表示永不过期</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  创建
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Token 创建成功
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                请立即复制以下 Token，关闭后将无法再次查看：
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
                <code className="flex-1 break-all font-mono text-xs">{plainToken}</code>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-destructive">⚠️ 此 Token 仅显示这一次！</p>
              <DialogFooter>
                <Button onClick={() => handleClose(false)}>我已保存</Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
