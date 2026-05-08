/**
 * @module StatusBadge
 * @description 项目状态标签组件：active=绿色默认 / archived=灰色次要。
 */
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '@apm/shared';

const STATUS_MAP: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: '活跃', variant: 'default' },
  archived: { label: '已归档', variant: 'secondary' },
};

interface StatusBadgeProps {
  status: ProjectStatus;
}

/**
 * 渲染项目状态为彩色 Badge。
 *
 * @param status - 项目状态值（'active' | 'archived'）
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
