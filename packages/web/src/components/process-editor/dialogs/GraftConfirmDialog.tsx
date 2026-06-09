/**
 * @module GraftConfirmDialog
 * @description 行为嫁接确认 Dialog — 跨 Participant 泳道拖拽时弹出。
 *
 * 交互设计 §4.1:
 * - 三选项：取消 / 仅移动节点 / 确认嫁接
 * - 取消：撤销拖拽，节点回到原位置
 * - 仅移动节点：只更新位置，不改变 holder
 * - 确认嫁接：删除原 Action + 在目标创建新 Action
 */

import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export interface GraftConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeName: string;
  sourceLane: string;
  targetLane: string;
  onCancel: () => void;
  onMoveOnly: () => void;
  onConfirmGraft: () => void;
}

export default function GraftConfirmDialog({
  open,
  onOpenChange,
  nodeName,
  sourceLane,
  targetLane,
  onCancel,
  onMoveOnly,
  onConfirmGraft,
}: GraftConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            行为嫁接确认
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 text-sm">
          <p>
            你将「<strong>{nodeName}</strong>」从「{sourceLane}」迁移到「{targetLane}」。
          </p>

          <p className="text-muted-foreground">
            此操作将：
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>在「{sourceLane}」上删除 Action「{nodeName}」</li>
            <li>在「{targetLane}」上创建新的 Action「{nodeName}」（复制元数据）</li>
          </ol>

          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>引用此 Action 的其他流程可能受到影响。</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={onMoveOnly}>
            仅移动节点
          </Button>
          <Button onClick={onConfirmGraft}>
            确认嫁接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
