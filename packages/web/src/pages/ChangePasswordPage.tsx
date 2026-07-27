/**
 * @module pages/ChangePasswordPage
 * @description 强制改密页（F-M6-05）：首次登录必须修改密码。
 *              独立全屏页面，无 Sidebar；顶部仅有 Logo + "退出登录"链接。
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, LogOut } from 'lucide-react';
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

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { changePassword, logout } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= 12 && !mismatch && !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 12) {
      setError('密码长度至少 12 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      // 强制改密不需要 oldPassword（后端 mustChangePassword 模式下跳过验证）
      await changePassword('', newPassword);
      toast.success('密码修改成功');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      setError(e.message || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-lg font-bold">APM</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          退出登录
        </Button>
      </header>

      {/* 居中表单 */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-6 rounded-lg border bg-background p-8 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">首次登录，请设置新密码</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ≥12位，含大小写字母、数字和符号
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* 密码强度指示器 */}
              {newPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= strength.level ? strength.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{strength.label}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mismatch && (
                <p className="text-xs text-destructive">两次密码不一致</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认修改
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
