/**
 * @module SelectBehaviorDialog
 * @description 节点创建行为选择 Dialog — 从对应参与者的 actions/decisions 中选择引用。
 *
 * 交互设计：
 * - 从节点池拖拽节点到画布后弹出
 * - 根据 nodeType 显示 actions 或 decisions 供选择
 * - 选择后创建节点
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Search, Zap, GitBranch, Check, Users, Monitor, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HolderType, ParticipantLane } from '@apm/shared';
import type { BehaviorOption } from '@/hooks/useProcess';
import { apiClient } from '@/lib/api-client';

interface SelectBehaviorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: 'action' | 'decision';
  /** 泳道落点对应的参与者信息 */
  participantLane: ParticipantLane | null;
  /** 节点在泳道中的位置索引 */
  participantLaneIndex: number;
  customLaneIndex: number;
}

const HOLDER_LABELS: Record<HolderType, string> = {
  role: '角色',
  service: '应用',
  external_entity: '外部实体',
};

const HOLDER_ICONS: Record<HolderType, typeof Users> = {
  role: Users,
  service: Monitor,
  external_entity: Globe,
};

export default function SelectBehaviorDialog({
  open,
  onOpenChange,
  nodeType,
  participantLane,
  participantLaneIndex,
  customLaneIndex,
}: SelectBehaviorDialogProps) {
  const { projectId, createNode, updateLayout, layout, selectNode } = useProcessEditorContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [behaviors, setBehaviors] = useState<BehaviorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // 对话框打开时加载行为列表
  useEffect(() => {
    if (!open || !participantLane) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { participantType: ht, participantId } = participantLane;
        const basePath =
          ht === 'role'
            ? `/projects/${projectId}/roles/${participantId}`
            : ht === 'service'
              ? `/projects/${projectId}/applications/${participantId}`
              : `/projects/${projectId}/external-entities/${participantId}`;

        const endpoint = nodeType === 'action' ? `${basePath}/actions` : `${basePath}/decisions`;
        const res = await apiClient.get<{ data: { items: BehaviorOption[] } }>(endpoint);

        if (!cancelled) {
          setBehaviors(res.data.data?.items ?? []);
        }
      } catch {
        if (!cancelled) setBehaviors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, participantLane, projectId, nodeType]);

  // 搜索过滤
  const filtered = useMemo(() => {
    if (!search) return behaviors;
    const q = search.toLowerCase();
    return behaviors.filter(
      (b) => b.name.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q),
    );
  }, [behaviors, search]);

  // 确认创建
  const handleCreate = useCallback(async () => {
    if (!selected || !participantLane || !layout) return;
    setCreating(true);
    try {
      const ref = selected;
      const node = await createNode({
        nodeType,
        name: ref,
        displayName: behaviors.find((b) => b.name === ref)?.displayName ?? ref,
        holderType: participantLane.participantType as 'role' | 'external_entity' | 'service',
        holderId: participantLane.participantId,
        actionRef: nodeType === 'action' ? ref : undefined,
        decisionRef: nodeType === 'decision' ? ref : undefined,
      });

      // 根据泳道尺寸计算节点初始偏移（确保节点完全在泳道内）
      const customLaneSize = layout.customLanes[customLaneIndex]?.size ?? 200;
      const participantLaneSize = layout.participantLanes[participantLaneIndex]?.size ?? 200;
      const nodeWidth = nodeType === 'action' ? 160 : 120;
      const nodeHeight = nodeType === 'action' ? 80 : 120;
      const offsetX = Math.max(8, Math.min(20, customLaneSize - nodeWidth - 8));
      const offsetY = Math.max(8, Math.min(20, participantLaneSize - nodeHeight - 8));

      // 更新布局 nodePositions
      const nodePositions = { ...layout.nodePositions };
      nodePositions[node.id] = {
        participantLaneIndex,
        customLaneIndex,
        offsetX,
        offsetY,
      };
      await updateLayout({ nodePositions });

      selectNode(node.id);
      setSearch('');
      setSelected(null);
      onOpenChange(false);
    } catch (err) {
      // error handled by toast in hook
    } finally {
      setCreating(false);
    }
  }, [selected, participantLane, layout, nodeType, behaviors, createNode, updateLayout, selectNode, participantLaneIndex, customLaneIndex, onOpenChange]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(null);
    }
  }, [open]);

  if (!participantLane) return null;

  const HolderIcon = HOLDER_ICONS[participantLane.participantType] ?? Users;
  const refLabel = nodeType === 'action' ? 'Action' : 'Decision';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            选择{refLabel} — {participantLane.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-6">
          {/* 参与者信息 */}
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <HolderIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {HOLDER_LABELS[participantLane.participantType]}: {participantLane.label}
            </span>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
              placeholder={`搜索${refLabel}...`}
              className="pl-8"
            />
          </div>

          {/* 行为列表 */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? `没有匹配的${refLabel}` : `该参与者暂未定义${refLabel}，请先在行为管理中添加`}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filtered.map((b) => (
                <button
                  key={b.name}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer',
                    selected === b.name
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50',
                  )}
                  onClick={() => setSelected(b.name)}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center',
                      selected === b.name ? 'bg-primary border-primary' : 'border-gray-300',
                    )}
                  >
                    {selected === b.name && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {nodeType === 'action' ? (
                    <Zap className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <GitBranch className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className="flex-1 text-left">{b.displayName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!selected || creating}>
            {creating ? '创建中...' : '创建节点'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
