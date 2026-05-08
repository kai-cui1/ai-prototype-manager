/**
 * @module ArchiveConfirmDialog
 * @description 归档/恢复确认对话框：二次确认 + 显示项目 displayName。
 *              对应 B-M1-06（前端确认对话框）。
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ArchiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  currentStatus: string;
  targetStatus: string;
  onConfirm: () => void;
  loading?: boolean;
}

/**
 * 渲染归档/恢复确认弹窗，含取消和确认按钮。
 *
 * 归档时使用 destructive 样式（红色强调），恢复时使用 default 样式。
 */
export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  displayName,
  currentStatus,
  targetStatus,
  onConfirm,
  loading = false,
}: ArchiveConfirmDialogProps) {
  const isArchiving = targetStatus === 'archived';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isArchiving ? '确认归档' : '确认恢复'}</DialogTitle>
          <DialogDescription>
            你确定要{isArchiving ? '归档' : '恢复'}项目「<strong>{displayName}</strong>」吗？
            {isArchiving
              ? ' 归档后该项目将在默认列表中隐藏，但数据不会被删除。'
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button variant={isArchiving ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? '处理中...' : isArchiving ? '确认归档' : '确认恢复'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
