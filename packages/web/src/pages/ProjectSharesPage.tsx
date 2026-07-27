/**
 * @module pages/ProjectSharesPage
 * @description 项目共享管理页（F-M6-15/16/17）：共享列表/创建/变更角色/撤销。
 *              路由 /p/:projectId/shares，项目层。
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Plus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface ShareItem {
  id: string;
  granteeType: 'team' | 'user';
  granteeId: string;
  granteeName: string;
  projectRole: string;
  sharedBy: string;
  createdAt: string;
}

export default function ProjectSharesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ShareItem | null>(null);

  const fetchShares = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await apiClient.get(`/projects/${projectId}/shares`);
      setShares(res.data.data || []);
    } catch {
      toast.error('获取共享列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  const handleRoleChange = async (shareId: string, newRole: string) => {
    try {
      await apiClient.patch(`/projects/${projectId}/shares/${shareId}`, { projectRole: newRole });
      toast.success('角色已变更');
      fetchShares();
    } catch (err: unknown) {
      toast.error((err as Error).message || '操作失败');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await apiClient.delete(`/projects/${projectId}/shares/${revokeTarget.id}`);
      toast.success('共享已撤销');
      fetchShares();
    } catch (err: unknown) {
      toast.error((err as Error).message || '撤销失败');
    }
    setRevokeTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Share2 className="h-5 w-5" />
            项目共享
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理此项目的跨团队/跨用户共享授权
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          共享项目
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
      ) : shares.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Share2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">此项目尚未共享给其他团队或用户</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {s.granteeType === 'team' ? '🏢' : '👤'} {s.granteeName}
                  </span>
                  <Badge variant={s.projectRole === 'editor' ? 'default' : 'secondary'}>
                    {s.projectRole === 'editor' ? 'Editor' : 'Viewer'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  共享于 {new Date(s.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                    变更角色 <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRoleChange(s.id, 'editor')}>
                      Editor (可编辑)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRoleChange(s.id, 'viewer')}>
                      Viewer (只读)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRevokeTarget(s)}
                >
                  撤销共享
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建共享 Dialog */}
      <CreateShareDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId!}
        onCreated={() => { setCreateOpen(false); fetchShares(); }}
      />

      {/* 撤销确认 */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销共享</AlertDialogTitle>
            <AlertDialogDescription>
              确认撤销对「{revokeTarget?.granteeName}」的项目共享？<br /><br />
              撤销后，该{revokeTarget?.granteeType === 'team' ? '团队成员' : '用户'}将无法访问此项目。
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
// 创建共享 Dialog
// ============================================================

function CreateShareDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  onCreated: () => void;
}) {
  const [granteeType, setGranteeType] = useState<'team' | 'user'>('team');
  const [granteeId, setGranteeId] = useState('');
  const [projectRole, setProjectRole] = useState('editor');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!granteeId) return;
    setLoading(true);
    try {
      await apiClient.post(`/projects/${projectId}/shares`, { granteeType, granteeId, projectRole });
      toast.success('项目已共享');
      setGranteeId('');
      onCreated();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        toast.error('该项目已共享给此团队/用户');
      } else {
        toast.error(e.message || '共享失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>共享项目</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>授权目标类型 *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="grantee-type" checked={granteeType === 'team'} onChange={() => setGranteeType('team')} />
                团队
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="grantee-type" checked={granteeType === 'user'} onChange={() => setGranteeType('user')} />
                用户
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grantee-id">{granteeType === 'team' ? '团队 ID' : '用户 ID'} *</Label>
            <Input
              id="grantee-id"
              value={granteeId}
              onChange={(e) => setGranteeId(e.target.value)}
              placeholder={granteeType === 'team' ? '输入团队 ID' : '输入用户 ID'}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>授权角色 *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="share-role" checked={projectRole === 'editor'} onChange={() => setProjectRole('editor')} />
                Editor (可编辑)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="share-role" checked={projectRole === 'viewer'} onChange={() => setProjectRole('viewer')} />
                Viewer (只读)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading || !granteeId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认共享
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
