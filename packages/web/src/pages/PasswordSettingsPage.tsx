/**
 * @module pages/PasswordSettingsPage
 * @description 修改密码页（F-M6-03）：个人设置中的常规改密（需验证旧密码）。
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score >= 5 && pw.length >= 16) return { level: 4, label: '极强', color: 'bg-emerald-600' };
  if (score >= 4) return { level: 3, label: '强', color: 'bg-green-500' };
  if (score >= 3) return { level: 2, label: '中等', color: 'bg-orange-400' };
  return { level: 1, label: '弱', color: 'bg-red-500' };
}

export default function PasswordSettingsPage() {
  const { changePassword } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPassword) { setError('请输入当前密码'); return; }
    if (newPassword.length < 12) { setError('新密码长度至少 12 位'); return; }
    if (newPassword !== confirmPassword) { setError('两次密码不一致'); return; }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success('密码已修改，所有 Token 已失效');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 400) {
        setError('当前密码错误');
      } else {
        setError(e.message || '修改失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold">修改密码</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          修改密码后，所有 Access Token 将自动失效
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="old-pw">当前密码 *</Label>
          <div className="relative">
            <Input
              id="old-pw"
              type={showOld ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
            />
            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-pw">新密码 *</Label>
          <div className="relative">
            <Input
              id="new-pw"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="pr-10"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword && (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-muted'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{strength.label}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">≥12位，含大小写字母、数字和符号</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-pw">确认新密码 *</Label>
          <Input
            id="confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {mismatch && <p className="text-xs text-destructive">两次密码不一致</p>}
        </div>

        <Button type="submit" disabled={loading || !oldPassword || !newPassword || mismatch}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          确认修改
        </Button>
      </form>

      <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>修改密码后，所有已创建的 Access Token 将自动撤销，需要重新创建。</span>
      </div>
    </div>
  );
}
