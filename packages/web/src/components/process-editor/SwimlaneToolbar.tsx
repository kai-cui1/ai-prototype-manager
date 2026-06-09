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
  ZoomIn,
  ZoomOut,
  Maximize,
  LayoutGrid,
  ChevronDown,
  Plus,
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const { layout, updateLayout, rfInstanceRef } = useProcessEditorContext();

  const participantLanes = layout?.participantLanes ?? [];
  const customLanes = layout?.customLanes ?? [];

  // ---- 添加 Participant Dialog ----
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  // ---- 缩放控制 ----
  const handleZoomIn = () => {
    rfInstanceRef.current?.zoomIn({ duration: 200 });
  };
  const handleZoomOut = () => {
    rfInstanceRef.current?.zoomOut({ duration: 200 });
  };
  const handleFitView = () => {
    rfInstanceRef.current?.fitView({ duration: 200, padding: 0.1 });
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

  // ---- 移除自定义泳道 ----
  const handleRemoveCustomLane = useCallback(async (laneId: string) => {
    const updated = customLanes.filter((l) => l.id !== laneId);
    await updateLayout({ customLanes: updated });
  }, [customLanes, updateLayout]);

  // ---- 移除 Participant 泳道 ----
  const handleRemoveParticipantLane = useCallback(async (participantId: string) => {
    const updated = participantLanes.filter((l) => l.participantId !== participantId);
    await updateLayout({ participantLanes: updated });
  }, [participantLanes, updateLayout]);

  // ---- 移动自定义泳道顺序 ----
  const handleMoveCustomLane = useCallback(async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= customLanes.length) return;
    const updated = [...customLanes];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    await updateLayout({ customLanes: updated });
  }, [customLanes, updateLayout]);

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

      {/* 缩放控制 */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomOut}
          title="缩小"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleFitView}
          title="适配视图"
        >
          <Maximize className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomIn}
          title="放大"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
