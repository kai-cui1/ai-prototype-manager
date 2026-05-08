/**
 * @module PaginationComponent
 * @description 分页器组件：首页/上一页/页码(含省略号)/下一页/末页 + 总条数。
 */
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationComponentProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * 渲染分页控件：左侧显示总条数，右侧为页码导航按钮组。
 *
 * 总页数 ≤ 1 时自动隐藏。
 */
export function PaginationComponent({
  total,
  page,
  pageSize,
  onPageChange,
}: PaginationComponentProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const goTo = (p: number) => {
    if (p >= 1 && p <= totalPages) onPageChange(p);
  };

  // Generate page numbers with ellipsis
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-2">
      <span className="text-sm text-muted-foreground">
        共 {total} 条
      </span>
      <div className="flex items-center space-x-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => goTo(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">...</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8"
              onClick={() => goTo(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => goTo(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
