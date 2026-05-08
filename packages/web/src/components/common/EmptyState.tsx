/**
 * @module EmptyState
 * @description 空状态占位组件：无数据时展示提示文案 + 可选操作按钮。
 */
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * 渲染空状态占位 UI（居中图标 + 文案 + 可选按钮）。
 */
export function EmptyState({
  title = '暂无项目',
  description = '点击下方按钮创建你的第一个项目',
  actionLabel = '新建项目',
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
      {onAction && (
        <Button className="mt-4" onClick={onAction}>
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
