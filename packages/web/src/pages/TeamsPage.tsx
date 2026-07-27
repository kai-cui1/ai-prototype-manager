/**
 * @module pages/TeamsPage
 * @description 团队列表页（F-M6-08）：展示当前用户所在团队 + 创建团队。
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, Plus, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface TeamItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  status: string;
  memberCount: number;
  projectCount: number;
  myRole: string;
  createdAt: string;
}

const ROLE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: { label: 'Owner', variant: 'default' },
  admin: { label: 'Admin', variant: 'secondary' },
  member: { label: 'Member', variant: 'outline' },
};

export default function TeamsPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiClient.get('/teams');
      setTeams(res.data.data || []);
    } catch {
      toast.error('获取团队列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5" />
            我的团队
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理你所在的团队，或创建新团队
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          创建团队
        </Button>
      </div>

      {/* 团队卡片列表 */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">你还没有加入任何团队</p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            创建第一个团队
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const badge = ROLE_BADGE[team.myRole] || ROLE_BADGE.member;
            return (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{team.displayName}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {team.description && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">{team.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {team.memberCount} 名成员 · {team.projectCount} 个项目 · 创建于{' '}
                    {new Date(team.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/teams/${team.id}`)}
                >
                  进入团队
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* 创建团队 Dialog */}
      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(teamId) => {
          setCreateOpen(false);
          navigate(`/teams/${teamId}`);
        }}
      />
    </div>
  );
}

// ============================================================
// 创建团队 Dialog
// ============================================================

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (teamId: string) => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNameError('');

    if (!name.match(/^[a-z][a-z0-9-]*$/) || name.length < 2 || name.length > 30) {
      setNameError('仅允许小写字母开头，包含小写字母、数字和连字符，2-30 字符');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/teams', { name, displayName, description: description || undefined });
      toast.success(`团队「${displayName}」已创建`);
      setName('');
      setDisplayName('');
      setDescription('');
      onCreated(res.data.data.id);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setNameError('该标识符已被使用');
      } else {
        toast.error(e.message || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建团队</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">团队标识符 *</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-team"
            />
            {nameError ? (
              <p className="text-xs text-destructive">{nameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">仅允许小写字母、数字和连字符</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-display">显示名称 *</Label>
            <Input
              id="team-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="我的团队"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-desc">团队描述</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !displayName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建团队
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
