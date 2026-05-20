/**
 * @module StatusBadge
 * @description 项目状态标签组件：active=teal活跃 / archived=橙色已归档。
 *
 * 使用 §6.5 Badge 状态变体（active / archived），直接渲染 <span> 确保 CSS 变量颜色正确应用。
 */
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@apm/shared';

const STATUS_MAP: Record<ProjectStatus, { label: string; className: string }> = {
  active: {
    label: '活跃',
    className: 'bg-status-active-bg text-status-active-text border border-status-active-border',
  },
  archived: {
    label: '已归档',
    className: 'bg-status-archived-bg text-status-archived-text border border-status-archived-border',
  },
};

interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-status-draft-bg text-status-draft-text border border-status-draft-border',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-tag border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
