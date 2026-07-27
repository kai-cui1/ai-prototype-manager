/**
 * @module pages/TeamDetailPage
 * @description 团队详情页（F-M6-09~14）：成员管理 + 邀请 + 角色变更 + 解散。
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, Plus, MoreVertical, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  teamRole: string;
  joinedAt: string;
  invitedBy: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  status: string;
  myRole: string;
}

const ROLE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: { label: 'Owner', variant: 'default' },
  admin: { label: 'Admin', variant: 'secondary' },
  member: { label: 'Member', variant: 'outline' },
};

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dissolveOpen, setDissolveOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!teamId) return;
    try {
      const [teamRes, membersRes] = await Promise.all([
        apiClient.get(`/teams/${teamId}`),
        apiClient.get(`/teams/${teamId}/members`),
      ]);
      setTeam(teamRes.data.data);
      setMembers(membersRes.data.data || []);
    } catch {
      toast.error('获取团队信息失败');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const myRole = team?.myRole || 'member';
  const canInvite = myRole === 'owner' || myRole === 'admin';
  const canDissolve = myRole === 'owner';

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await apiClient.patch(`/teams/${teamId}/members/${memberId}`, { teamRole: newRole });
      toast.success('角色已变更');
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || '操作失败');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await apiClient.delete(`/teams/${teamId}/members/${memberId}`);
      toast.success('成员已移除');
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || '操作失败');
    }
  };

  const handleLeave = async () => {
    try {
      await apiClient.post(`/teams/${teamId}/leave`);
      toast.success('已退出团队');
      navigate('/teams');
    } catch (err: unknown) {
      toast.error((err as Error).message || '操作失败');
    }
  };

  const handleDissolve = async () => {
    try {
      await apiClient.delete(`/teams/${teamId}`);
      toast.success('团队已解散');
      navigate('/teams');
    } catch (err: unknown) {
      toast.error((err as Error).message || '解散失败');
    }
    setDissolveOpen(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!team) {
    return <div className="py-12 text-center text-muted-foreground">团队不存在</div>;
  }

  const badge = ROLE_BADGE[myRole] || ROLE_BADGE.member;

  return (
    <div className="space-y-6">
      {/* 返回 + 页头 */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/teams')}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回团队列表
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{team.displayName}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {team.description && (
            <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canDissolve && (
            <Button variant="destructive" size="sm" onClick={() => setDissolveOpen(true)}>
              解散团队
            </Button>
          )}
        </div>
      </div>

      {/* 成员列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">成员列表 ({members.length})</h3>
          {canInvite && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-1 h-4 w-4" />
              邀请成员
            </Button>
          )}
        </div>

        <div className="divide-y rounded-lg border">
          {members.map((m) => {
            const mBadge = ROLE_BADGE[m.teamRole] || ROLE_BADGE.member;
            const isSelf = m.userId === user?.id;
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.displayName}</span>
                    <span className="text-xs text-muted-foreground">({m.email})</span>
                    <Badge variant={mBadge.variant}>{mBadge.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    加入于 {new Date(m.joinedAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>

                {/* 操作菜单 */}
                {!isSelf && myRole === 'owner' && m.teamRole !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {m.teamRole === 'member' && (
                        <DropdownMenuItem onClick={() => handleRoleChange(m.id, 'admin')}>
                          设为 Admin
                        </DropdownMenuItem>
                      )}
                      {m.teamRole === 'admin' && (
                        <DropdownMenuItem onClick={() => handleRoleChange(m.id, 'member')}>
                          设为 Member
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleRemoveMember(m.id)}
                      >
                        移除成员
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* 自己的退出按钮 */}
                {isSelf && myRole !== 'owner' && (
                  <Button variant="ghost" size="sm" onClick={handleLeave}>
                    退出团队
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 邀请成员 Dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        teamId={teamId!}
        onInvited={() => { setInviteOpen(false); fetchData(); }}
      />

      {/* 解散团队 AlertDialog */}
      <AlertDialog open={dissolveOpen} onOpenChange={setDissolveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解散团队</AlertDialogTitle>
            <AlertDialogDescription>
              确认解散「{team.displayName}」？<br /><br />
              解散后：所有成员将失去团队访问权限，团队名称将被释放，此操作不可撤销。<br />
              前提：团队下无活跃项目。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDissolve}
            >
              确认解散
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// 邀请成员 Dialog
// ============================================================

function InviteDialog({
  open,
  onOpenChange,
  teamId,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamId: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/teams/${teamId}/members`, { email, teamRole: role });
      toast.success('已邀请成员加入团队');
      setEmail('');
      setRole('member');
      onInvited();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        toast.error('该用户已是团队成员');
      } else {
        toast.error(e.message || '邀请失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>邀请成员加入团队</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">用户邮箱 *</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>分配角色 *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="invite-role"
                  value="member"
                  checked={role === 'member'}
                  onChange={(e) => setRole(e.target.value)}
                />
                Member
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="invite-role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value)}
                />
                Admin
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              邀请加入
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
