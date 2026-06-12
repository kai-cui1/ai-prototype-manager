/**
 * @module SwimlaneToolbar
 * @description 泳道工具栏。
 *
 * 交互设计 §3.4:
 * - Participant 下拉：管理 Participant 泳道（增删，顺序固定）
 * - 自定义泳道下拉：管理自定义泳道（增删改排序）
 * - 自动布局按钮：Dagre 重排（Phase 2 预留）
 * - 缩放控制
 */

import { useState, useCallback } from 'react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import {
  LayoutGrid,
  ChevronDown,
  Plus,
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
  Pencil,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import AddParticipantDialog from './dialogs/AddParticipantDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export default function SwimlaneToolbar() {
  const { layout, nodes, deleteNode, updateLayout, rfInstanceRef, setCanvasSettingsOpen } = useProcessEditorContext();

  const participantLanes = layout?.participantLanes ?? [];
  const customLanes = layout?.customLanes ?? [];

  // ---- 添加 Participant Dialog ----
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  // ---- Canvas 设置 ----
  const openCanvasSettings = () => {
    setCanvasSettingsOpen(true);
  };

  // ---- 添加自定义泳道 ----
  const [newLaneName, setNewLaneName] = useState('');

  const handleAddCustomLane = useCallback(async () => {
    if (!newLaneName.trim()) return;
    const newLane = {
      id: `lane-${Date.now()}`,
      name: newLaneName.trim().toLowerCase().replace(/\s+/g, '-'),
      label: newLaneName.trim(),
      order: customLanes.length,
      size: 200,
    };
    await updateLayout({ customLanes: [...customLanes, newLane] });
    setNewLaneName('');
  }, [newLaneName, customLanes, updateLayout]);

  // ---- 重命名自定义泳道 ----
  const [renamingLaneId, setRenamingLaneId] = useState<string | null>(null);
  const [renamingLabel, setRenamingLabel] = useState('');

  const handleStartRename = useCallback((laneId: string, currentLabel: string) => {
    setRenamingLaneId(laneId);
    setRenamingLabel(currentLabel);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renamingLaneId || !renamingLabel.trim()) return;
    const updated = customLanes.map((l) =>
      l.id === renamingLaneId
        ? { ...l, label: renamingLabel.trim(), name: renamingLabel.trim().toLowerCase().replace(/\s+/g, '-') }
        : l,
    );
    await updateLayout({ customLanes: updated });
    setRenamingLaneId(null);
  }, [renamingLaneId, renamingLabel, customLanes, updateLayout]);

  // ---- 移除自定义泳道 ----
  const handleRemoveCustomLane = useCallback(async (laneId: string) => {
    // 至少保留一个自定义泳道
    if (customLanes.length <= 1) {
      toast.error('至少保留一个自定义泳道');
      return;
    }

    const deletedIdx = customLanes.findIndex((l) => l.id === laneId);
    const updated = customLanes.filter((l) => l.id !== laneId);

    // 确定迁移目标：优先右侧，其次左侧
    let migrateToIdx = deletedIdx < updated.length ? deletedIdx : deletedIdx - 1;

    // 构建 oldIdx→newIdx 映射（基于 lane ID），被删泳道的节点迁入目标泳道
    const indexMap: Record<number, number> = {};
    customLanes.forEach((lane, oldIdx) => {
      if (lane.id === laneId) {
        indexMap[oldIdx] = migrateToIdx; // 被删泳道节点迁入目标
      } else {
        const newIdx = updated.findIndex((l) => l.id === lane.id);
        if (newIdx !== -1) indexMap[oldIdx] = newIdx;
      }
    });
    const nodePositions = layout?.nodePositions ?? {};
    const updatedPositions = Object.fromEntries(
      Object.entries(nodePositions).map(([nodeId, pos]) => [
        nodeId,
        { ...pos, customLaneIndex: indexMap[pos.customLaneIndex] ?? pos.customLaneIndex },
      ]),
    );

    await updateLayout({ customLanes: updated, nodePositions: updatedPositions });
  }, [customLanes, layout, updateLayout]);

  // ---- 移除 Participant 泳道（二次确认 + 同步删除节点 + 索引映射） ----
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<{ id: string; label: string; nodeCount: number } | null>(null);

  const handleRemoveParticipantLane = useCallback(async (participantId: string) => {
    const lane = participantLanes.find((l) => l.participantId === participantId);
    if (!lane) return;

    // 至少保留一个角色泳道
    if (participantLanes.length <= 1) {
      toast.error('至少保留一个角色泳道');
      return;
    }

    // 计算该泳道下节点数量
    const deletedIdx = participantLanes.findIndex((l) => l.participantId === participantId);
    const nodePositions = layout?.nodePositions ?? {};
    const nodeIdsInLane = Object.entries(nodePositions)
      .filter(([, pos]) => pos.participantLaneIndex === deletedIdx)
      .map(([nodeId]) => nodeId);

    if (nodeIdsInLane.length > 0) {
      // 有节点，弹出二次确认
      setConfirmRemoveParticipant({ id: participantId, label: lane.label, nodeCount: nodeIdsInLane.length });
      return;
    }

    // 无节点，直接删除 + 索引映射
    await doRemoveParticipantLane(participantId);
  }, [participantLanes, layout, updateLayout]);

  const doRemoveParticipantLane = useCallback(async (participantId: string) => {
    const deletedIdx = participantLanes.findIndex((l) => l.participantId === participantId);
    const updated = participantLanes.filter((l) => l.participantId !== participantId);

    // 构建 participantIdx 映射
    const indexMap: Record<number, number> = {};
    participantLanes.forEach((lane, oldIdx) => {
      const newIdx = updated.findIndex((l) => l.participantId === lane.participantId);
      if (newIdx !== -1) indexMap[oldIdx] = newIdx;
    });
    const nodePositions = layout?.nodePositions ?? {};
    const updatedPositions = Object.fromEntries(
      Object.entries(nodePositions)
        .filter(([nodeId]) => nodeId !== '__placeholder__') // 过滤掉占位符
        .filter(([, pos]) => pos.participantLaneIndex !== deletedIdx) // 移除被删泳道的节点
        .map(([nodeId, pos]) => [
          nodeId,
          { ...pos, participantLaneIndex: indexMap[pos.participantLaneIndex] ?? pos.participantLaneIndex },
        ]),
    );

    await updateLayout({ participantLanes: updated, nodePositions: updatedPositions });

    // 同步删除被删泳道下的所有节点
    const nodesToDelete = nodes.filter((n) => {
      const pos = nodePositions[n.id];
      return pos && pos.participantLaneIndex === deletedIdx;
    });
    for (const node of nodesToDelete) {
      await deleteNode(node.id);
    }
  }, [participantLanes, nodes, layout, deleteNode, updateLayout]);

  // ---- 移动自定义泳道顺序 ----
  const handleMoveCustomLane = useCallback(async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= customLanes.length) return;
    const updated = [...customLanes];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    // 构建 oldIdx→newIdx 映射（基于 lane ID），同步更新 nodePositions
    const indexMap: Record<number, number> = {};
    customLanes.forEach((lane, oldIdx) => {
      const newIdx = updated.findIndex((l) => l.id === lane.id);
      if (newIdx !== -1) indexMap[oldIdx] = newIdx;
    });
    const nodePositions = layout?.nodePositions ?? {};
    const updatedPositions = Object.fromEntries(
      Object.entries(nodePositions).map(([nodeId, pos]) => [
        nodeId,
        { ...pos, customLaneIndex: indexMap[pos.customLaneIndex] ?? pos.customLaneIndex },
      ]),
    );

    await updateLayout({ customLanes: updated, nodePositions: updatedPositions });
  }, [customLanes, layout, updateLayout]);

  return (
    <div className="flex h-9 items-center gap-2 border-b bg-gray-50 px-4">
      {/* Participant 泳道管理 */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center justify-center rounded-md border border-input bg-background h-7 gap-1 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
        >
          Participant 泳道 ({participantLanes.length})
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">当前 Participant 泳道</DropdownMenuLabel>
          </DropdownMenuGroup>
          {participantLanes.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              暂无 Participant 泳道
            </div>
          ) : (
            participantLanes.map((lane) => (
              <DropdownMenuItem
                key={lane.participantId}
                className="flex items-center gap-1 text-xs"
                onSelect={(e) => e.preventDefault()}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="flex-1 truncate">{lane.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {lane.participantType}
                </span>
                <div className="flex items-center">
                  <button
                    className="h-5 w-5 rounded p-0 hover:bg-muted inline-flex items-center justify-center"
                    onClick={() => handleRemoveParticipantLane(lane.participantId)}
                    title="删除"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-primary gap-1"
            onSelect={(e) => e.preventDefault()}
            onClick={() => setShowAddParticipant(true)}
          >
            <Plus className="h-3 w-3" />
            添加 Participant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 添加 Participant Dialog */}
      <AddParticipantDialog
        open={showAddParticipant}
        onOpenChange={setShowAddParticipant}
      />

      {/* 删除角色泳道二次确认 AlertDialog */}
      <AlertDialog
        open={confirmRemoveParticipant !== null}
        onOpenChange={(open) => { if (!open) setConfirmRemoveParticipant(null); }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除角色泳道</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{confirmRemoveParticipant?.label}」角色泳道吗？
              该泳道下有 {confirmRemoveParticipant?.nodeCount} 个节点，删除后这些节点及其引用的 Action 将一并移除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemoveParticipant) {
                  doRemoveParticipantLane(confirmRemoveParticipant.id);
                  setConfirmRemoveParticipant(null);
                }
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 自定义泳道管理 */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center justify-center rounded-md border border-input bg-background h-7 gap-1 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
        >
          自定义泳道 ({customLanes.length})
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">当前自定义泳道</DropdownMenuLabel>
          </DropdownMenuGroup>
          {customLanes.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              暂无自定义泳道
            </div>
          ) : (
            customLanes.map((lane, index) => (
              <DropdownMenuItem
                key={lane.id}
                className="flex items-center gap-1 text-xs"
                onSelect={(e) => e.preventDefault()}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                <span className="flex-1 truncate">{lane.label}</span>
                <div className="flex items-center">
                  <button
                    className="h-5 w-5 rounded p-0 hover:bg-muted inline-flex items-center justify-center"
                    onClick={() => handleStartRename(lane.id, lane.label)}
                    title="重命名"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    className="h-5 w-5 rounded p-0 hover:bg-muted inline-flex items-center justify-center disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => handleMoveCustomLane(index, -1)}
                    title="左移"
                  >
                    <ArrowUp className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    className="h-5 w-5 rounded p-0 hover:bg-muted inline-flex items-center justify-center disabled:opacity-30"
                    disabled={index === customLanes.length - 1}
                    onClick={() => handleMoveCustomLane(index, 1)}
                    title="右移"
                  >
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    className="h-5 w-5 rounded p-0 hover:bg-muted inline-flex items-center justify-center"
                    onClick={() => handleRemoveCustomLane(lane.id)}
                    title="删除"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Input
              value={newLaneName}
              onChange={(e) => setNewLaneName((e.target as HTMLInputElement).value)}
              placeholder="泳道名称"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                e.stopPropagation(); // 阻止 DropdownMenu type-ahead 拦截键盘事件
                if (e.key === 'Enter') handleAddCustomLane();
              }}
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAddCustomLane}
              disabled={!newLaneName.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 重命名自定义泳道 Dialog */}
      <Dialog open={renamingLaneId !== null} onOpenChange={(open) => { if (!open) setRenamingLaneId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名泳道</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="text-sm font-medium mb-1.5 block">泳道名称</label>
            <Input
              value={renamingLabel}
              onChange={(e) => setRenamingLabel((e.target as HTMLInputElement).value)}
              placeholder="请输入泳道名称"
              className="h-8"
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renamingLabel.trim()) handleConfirmRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingLaneId(null)}>取消</Button>
            <Button onClick={handleConfirmRename} disabled={!renamingLabel.trim()}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-4 w-px bg-border" />

      {/* 自动布局（Phase 2 预留） */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        disabled
        title="自动布局（开发中）"
      >
        <LayoutGrid className="h-3 w-3" />
        自动布局
      </Button>

      <div className="flex-1" />

      {/* Canvas 设置按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={openCanvasSettings}
        title="Canvas 设置"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
