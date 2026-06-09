/**
 * @module CustomLaneDialog
 * @description 自定义泳道管理 Dialog — 重命名/删除/排序。
 *
 * 交互设计 §5.2:
 * - 显示所有自定义泳道列表
 * - 支持重命名、删除、拖拽排序
 */

import { useState, useCallback } from 'react';
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
import { GripVertical, Trash2, Pencil } from 'lucide-react';
import type { CustomLane } from '@apm/shared';

interface CustomLaneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomLaneDialog({ open, onOpenChange }: CustomLaneDialogProps) {
  const { layout, updateLayout } = useProcessEditorContext();
  const [lanes, setLanes] = useState<CustomLane[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  // 打开时同步
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && layout) {
        setLanes([...layout.customLanes]);
      }
      onOpenChange(newOpen);
    },
    [layout, onOpenChange],
  );

  const handleRename = useCallback((laneId: string, newLabel: string) => {
    setLanes((prev) =>
      prev.map((l) => (l.id === laneId ? { ...l, label: newLabel, name: newLabel.toLowerCase().replace(/\s+/g, '-') } : l)),
    );
    setEditingId(null);
  }, []);

  const handleDelete = useCallback((laneId: string) => {
    setLanes((prev) => prev.filter((l) => l.id !== laneId));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setLanes((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((l, i) => ({ ...l, order: i }));
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setLanes((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((l, i) => ({ ...l, order: i }));
    });
  }, []);

  const handleSave = useCallback(async () => {
    await updateLayout({ customLanes: lanes });
    onOpenChange(false);
  }, [lanes, updateLayout, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理自定义泳道</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 p-6">
          {lanes.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              暂无自定义泳道
            </div>
          ) : (
            lanes.map((lane, index) => (
              <div
                key={lane.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                {/* 排序控制 */}
                <div className="flex flex-col gap-0.5">
                  <button
                    className="h-4 w-4 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    ▲
                  </button>
                  <button
                    className="h-4 w-4 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === lanes.length - 1}
                  >
                    ▼
                  </button>
                </div>

                {/* 泳道名称 */}
                {editingId === lane.id ? (
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel((e.target as HTMLInputElement).value)}
                    onBlur={() => handleRename(lane.id, editingLabel)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(lane.id, editingLabel);
                    }}
                    className="h-7 text-xs flex-1"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm">{lane.label}</span>
                )}

                {/* 重命名按钮 */}
                <button
                  className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
                  onClick={() => {
                    setEditingId(lane.id);
                    setEditingLabel(lane.label);
                  }}
                  title="重命名"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>

                {/* 删除按钮 */}
                <button
                  className="h-6 w-6 rounded hover:bg-red-50 flex items-center justify-center"
                  onClick={() => handleDelete(lane.id)}
                  title="删除"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
