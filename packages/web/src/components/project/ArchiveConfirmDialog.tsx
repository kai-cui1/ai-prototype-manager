/**
 * @module ArchiveConfirmDialog
 * @description 归档/恢复确认对话框：二次确认 + 显示项目 displayName。
 *              对应 B-M1-06（前端确认对话框）。
 *              原型规格：docs/03-prd-ux/prototypes/m1-project-list.html（Archive Confirm Dialog）
 */
import {
  Dialog,
  DialogContent,
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
 * 布局严格对齐原型：
 * - 弹窗宽度 400px（size="sm"）
 * - 正文居中对齐，padding 32px 24px
 * - 归档模式：红色警告文字 + 红色实心确认按钮
 * - 恢复模式：普通提示 + 主色确认按钮
 *
 * @param props - 对话框属性
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
  // 判断当前操作类型：归档 or 恢复
  const isArchiving = targetStatus === 'archived';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* §6.6 Dialog 尺寸：sm=400px（原型 .dialog: width:400px） */}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{isArchiving ? '确认归档' : '确认恢复'}</DialogTitle>
        </DialogHeader>

        {/* 对话框正文：居中布局（原型 .dialog-body: text-align:center; padding:32px 24px） */}
        <div className="flex flex-col items-center px-6 py-8 text-center">
          {/* 第一行：操作提示语 */}
          <p className="text-sm text-foreground mb-2">
            你确定要{isArchiving ? '归档' : '恢复'}以下项目吗？
          </p>

          {/* 第二行：项目名称（加粗突出显示） */}
          <p className="text-base font-semibold text-foreground mb-3">
            {displayName}
          </p>

          {/* 第三行：红色警告文字 — 仅归档模式显示（原型 #ff4d4f, 13px, 500 weight） */}
          {isArchiving && (
            <p className="text-[13px] font-medium text-destructive mt-2">
              归档后该项目不可编辑，数据保留。
            </p>
          )}

          {/* 第四行：补充说明文字（原型 .text-muted, 12px） */}
          <p className="text-xs text-muted-foreground mt-1.5">
            {isArchiving
              ? '归档后该项目将不再出现在默认列表中，可在筛选"已归档"中查看。'
              : '恢复后该项目将重新出现在活跃列表中。'}
          </p>
        </div>

        {/* 底部按钮区：居中对齐（原型 .dialog-footer: justify-content:center） */}
        <DialogFooter className="justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          {/* 归档用 destructive（红底白字），恢复用 default（主色） */}
          <Button variant={isArchiving ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? '处理中...' : isArchiving ? '确认归档' : '确认恢复'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
