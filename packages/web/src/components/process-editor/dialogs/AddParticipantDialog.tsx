/**
 * @module AddParticipantDialog
 * @description 添加 Participant 泳道 Dialog — 从项目已有的 Role/App/ExternalEntity 中选择。
 *
 * 交互设计 §5.1:
 * - 搜索参与者
 * - 多选已添加/未添加的参与者
 * - 确认后新增泳道
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Check, Users, Monitor, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParticipantLane, HolderType } from '@apm/shared';
import { apiClient } from '@/lib/api-client';

interface AddParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 项目参与者选项 */
interface ParticipantOption {
  id: string;
  name: string;
  displayName: string;
  type: HolderType;
}

/** HolderType → 显示标签映射 */
const TYPE_LABELS: Record<HolderType, string> = {
  role: '角色',
  service: '应用',
  external_entity: '外部实体',
};

/** HolderType → 图标颜色 */
const TYPE_COLORS: Record<HolderType, string> = {
  role: 'text-blue-500',
  service: 'text-green-500',
  external_entity: 'text-amber-500',
};

export default function AddParticipantDialog({ open, onOpenChange }: AddParticipantDialogProps) {
  const { projectId, layout, updateLayout } = useProcessEditorContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [loading, setLoading] = useState(false);

  // ---- 从 API 加载项目参与者（Roles + Applications + ExternalEntities）----
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rolesRes, appsRes, eeRes] = await Promise.all([
          apiClient.get<{ data: Array<{ id: string; name: string; displayName: string }> }>(
            `/projects/${projectId}/roles`,
          ),
          apiClient.get<{ data: Array<{ id: string; name: string; displayName: string }> }>(
            `/projects/${projectId}/applications`,
          ),
          apiClient.get<{ data: Array<{ id: string; name: string; displayName: string }> }>(
            `/projects/${projectId}/external-entities`,
          ),
        ]);
        if (cancelled) return;
        const all: ParticipantOption[] = [
          ...(rolesRes.data?.data ?? []).map((r) => ({
            id: r.id, name: r.name, displayName: r.displayName, type: 'role' as HolderType,
          })),
          ...(appsRes.data?.data ?? []).map((a) => ({
            id: a.id, name: a.name, displayName: a.displayName, type: 'service' as HolderType,
          })),
          ...(eeRes.data?.data ?? []).map((e) => ({
            id: e.id, name: e.name, displayName: e.displayName, type: 'external_entity' as HolderType,
          })),
        ];
        setParticipants(all);
      } catch {
        if (!cancelled) setParticipants([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  const existingIds = useMemo(
    () => new Set((layout?.participantLanes ?? []).map((l) => l.participantId)),
    [layout],
  );

  const availableParticipants = useMemo(() => {
    return participants.filter((p) => !existingIds.has(p.id));
  }, [participants, existingIds]);

  const filtered = useMemo(() => {
    if (!search) return availableParticipants;
    const q = search.toLowerCase();
    return availableParticipants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
    );
  }, [availableParticipants, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!layout || selected.size === 0) return;

    const newLanes: ParticipantLane[] = [...layout.participantLanes];
    for (const id of selected) {
      const p = participants.find((pp) => pp.id === id);
      if (!p) continue;
      newLanes.push({
        participantId: p.id,
        participantType: p.type,
        label: p.displayName,
        order: newLanes.length,
        size: 200,
      });
    }

    await updateLayout({ participantLanes: newLanes });
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  }, [layout, selected, participants, updateLayout, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加 Participant 泳道</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-6">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
              placeholder="搜索参与者..."
              className="pl-8"
            />
          </div>

          {/* 参与者列表 */}
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? '没有匹配的参与者' : participants.length === 0 ? '项目中暂无参与者' : '所有参与者已添加'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer',
                    selected.has(p.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50',
                  )}
                  onClick={() => toggleSelect(p.id)}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center',
                      selected.has(p.id) ? 'bg-primary border-primary' : 'border-gray-300',
                    )}
                  >
                    {selected.has(p.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {p.type === 'role' && <Users className="h-3.5 w-3.5 text-blue-500" />}
                  {p.type === 'service' && <Monitor className="h-3.5 w-3.5 text-green-500" />}
                  {p.type === 'external_entity' && <Globe className="h-3.5 w-3.5 text-amber-500" />}
                  <span className="flex-1 text-left">{p.displayName}</span>
                  <span className={cn('text-[10px] uppercase', TYPE_COLORS[p.type])}>
                    {TYPE_LABELS[p.type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            添加 ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
