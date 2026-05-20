/**
 * @module ProjectTable
 * @description 项目列表数据表格 — §6.3 + §7.1 模板
 *
 * 列结构（6 列，§6.3.1 列宽参考）：
 *   名称(280px) / ID(CodeCell 160px) / 状态(80px) / 版本(80px) / 更新时间(170px) / 操作(120px)
 *
 * 操作列：文字链接 "编辑"(primary) + "归档"/"恢复"(danger/green)，归档项编辑置灰
 * 排序列头：名称 + 更新时间使用 SortableTableHead（静态箭头示意）
 */
import {
  Table,
  TableBody,
  TableCell,
  CodeCell,
  TableHead,
  SortableTableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { ProjectListItem } from '@apm/shared';
import { formatDateTime } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ProjectTableProps {
  data: ProjectListItem[];
  onArchive: (project: ProjectListItem) => void;
}

/**
 * 渲染项目数据表格。空数组时返回 null（由父组件处理 EmptyState）。
 *
 * §7.1 列表页模板数据区域：DataTableContainer 内的 Table + Pagination
 */
export function ProjectTable({ data, onArchive }: ProjectTableProps) {
  const navigate = useNavigate();

  if (data.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead style={{ width: 280 }}>项目名称</SortableTableHead>
          <TableHead style={{ width: 160 }}>标识符</TableHead>
          <TableHead style={{ width: 80 }}>状态</TableHead>
          <TableHead style={{ width: 80 }}>版本</TableHead>
          <SortableTableHead style={{ width: 170 }} sortDir="desc">更新时间</SortableTableHead>
          <TableHead style={{ width: 120 }} className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((project) => (
          <TableRow key={project.id}>
            {/* 名称列 — 左对齐、medium weight */}
            <TableCell className="font-medium">{project.displayName}</TableCell>

            {/* 标识符列 — CodeCell monospace 展示项目 name（非 UUID） */}
            <CodeCell value={project.name} />

            {/* 状态列 */}
            <TableCell>
              <StatusBadge status={project.status} />
            </TableCell>

            {/* 版本列 */}
            <TableCell>v{project.version}</TableCell>

            {/* 更新时间列 */}
            <TableCell>{formatDateTime(project.updatedAt)}</TableCell>

            {/* 操作列 — 文字链接（§6.3 注释：操作列右对齐） */}
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-3">
                <button
                  className="text-[13px] text-primary hover:text-primary-hover hover:underline disabled:text-text-disabled disabled:no-underline cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  disabled={project.status === 'archived'}
                >
                  编辑
                </button>
                <button
                  className={`text-[13px] hover:underline cursor-pointer ${
                    project.status === 'archived'
                      ? 'text-success hover:text-success/80'
                      : 'text-danger hover:text-danger-hover'
                  }`}
                  onClick={() => onArchive(project)}
                >
                  {project.status === 'archived' ? '恢复' : '归档'}
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
