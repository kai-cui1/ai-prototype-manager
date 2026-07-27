/**
 * @module pages/AdminUsersPage
 * @description 用户管理页（F-M6-06/07）：用户列表 + 创建 + 禁用/启用。仅 SuperAdmin。
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
import { UserCog, Plus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

interface UserItem {
  id: string;
  email: string;
  displayName: string;
  platformRole: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<UserItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '20' };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await apiClient.get('/admin/users', { params });
      setUsers(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await apiClient.patch(`/admin/users/${user.id}/status`, { status: newStatus });
      toast.success(newStatus === 'disabled' ? '用户已禁用' : '用户已启用');
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as Error).message || '操作失败');
    }
    setDisableTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <UserCog className="h-5 w-5" />
            用户管理
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">管理系统中的所有用户账号</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          创建用户
        </Button>
      </div>

      {/* 搜索 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索邮箱或名称..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
      ) : (
        <div className="divide-y rounded-lg border">
          {users.map((u) => (
            <div key={u.id} className={`flex items-center justify-between px-4 py-3 ${u.status === 'disabled' ? 'opacity-60' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{u.displayName}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={u.platformRole === 'super_admin' ? 'destructive' : 'secondary'}>
                    {u.platformRole === 'super_admin' ? 'SuperAdmin' : 'User'}
                  </Badge>
                  <Badge variant={u.status === 'active' ? 'default' : 'outline'}>
                    {u.status === 'active' ? 'active' : 'disabled'}
                  </Badge>
                  {u.lastLoginAt && (
                    <span className="text-xs text-muted-foreground">
                      最后登录: {new Date(u.lastLoginAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
              {u.platformRole !== 'super_admin' && (
                <Button
                  variant={u.status === 'active' ? 'ghost' : 'outline'}
                  size="sm"
                  className={u.status === 'active' ? 'text-destructive hover:text-destructive' : ''}
                  onClick={() => setDisableTarget(u)}
                >
                  {u.status === 'active' ? '禁用' : '启用'}
                </Button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">无匹配用户</div>
          )}
        </div>
      )}

      {/* 分页 */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {Math.ceil(total / 20)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* 创建用户 Dialog */}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchUsers} />

      {/* 禁用确认 */}
      <AlertDialog open={!!disableTarget} onOpenChange={() => setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disableTarget?.status === 'active' ? '确认禁用用户' : '确认启用用户'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disableTarget?.status === 'active'
                ? `确认禁用「${disableTarget?.displayName}」(${disableTarget?.email})？禁用后该用户无法登录系统，已有会话立即失效。可随时重新启用。`
                : `确认启用「${disableTarget?.displayName}」？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={disableTarget?.status === 'active' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => disableTarget && handleToggleStatus(disableTarget)}
            >
              {disableTarget?.status === 'active' ? '确认禁用' : '确认启用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// 创建用户 Dialog
// ============================================================

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/admin/users', { email, displayName, initialPassword });
      toast.success('用户已创建');
      setEmail('');
      setDisplayName('');
      setInitialPassword('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setError('该邮箱已存在');
      } else {
        setError(e.message || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建用户</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="user-email">邮箱 *</Label>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">显示名称 *</Label>
            <Input id="user-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-pw">初始密码 *</Label>
            <Input id="user-pw" type="password" value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground">用户首次登录时将被强制修改密码</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading || !email || !displayName || !initialPassword}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建用户
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
