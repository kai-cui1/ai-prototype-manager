/**
 * @module ProjectTable
 * @description 项目列表数据表格：Name / ID(截断) / StatusBadge / Version /
 *              摘要统计(B-M1-88 内嵌) / UpdatedAt / 操作列。
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoreHorizontal, Archive, RotateCcw, Eye } from 'lucide-react';
import type { ProjectListItem } from '@apm/shared';
import { formatDateTime } from '@/lib/utils';

interface ProjectTableProps {
  data: ProjectListItem[];
  onArchive: (project: ProjectListItem) => void;
  onView?: (project: ProjectListItem) => void;
}

/**
 * 渲染项目数据表格。空数组时返回 null（由父组件处理 EmptyState）。
 *
 * ID 列仅显示前 8 位，完整 ID 可在详情页查看。
 * B-M1-88: 摘要统计列展示后端内嵌的 6 个模块计数 Badge。
 */
export function ProjectTable({ data, onArchive, onView }: ProjectTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>项目名称</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>摘要统计</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.displayName}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {project.id.slice(0, 8)}…
              </TableCell>
              <TableCell>
                <StatusBadge status={project.status} />
              </TableCell>
              <TableCell>v{project.version}</TableCell>
              {/* B-M1-88: 内嵌摘要统计 — 6 个模块计数 Badge */}
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">{project.summary.domainEntityCount} 实体</Badge>
                  <Badge variant="secondary" className="text-xs">{project.summary.processCount} 流程</Badge>
                  <Badge variant="secondary" className="text-xs">{project.summary.companyCount} 公司</Badge>
                  <Badge variant="secondary" className="text-xs">{project.summary.departmentCount} 部门</Badge>
                  <Badge variant="secondary" className="text-xs">{project.summary.roleCount} 角色</Badge>
                  <Badge variant="secondary" className="text-xs">{project.summary.externalEntityCount} 外部</Badge>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(project.updatedAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView(project)}
                      title="查看详情"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onArchive(project)}
                    title={project.status === 'archived' ? '恢复' : '归档'}
                  >
                    {project.status === 'archived'
                      ? <RotateCcw className="h-4 w-4" />
                      : <Archive className="h-4 w-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
