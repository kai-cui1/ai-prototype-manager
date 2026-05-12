/**
 * @module DataTableContainer
 * @description 数据表格容器 — §7.1 列表页模板数据区域
 *
 * 布局：Card 包裹（无内边距、overflow-hidden、8px 圆角、shadow-card）
 * 内容：Table + Pagination（分页在 Card 内部底部，p-3）
 *
 * @example
 * ```tsx
 * <DataTableContainer loading={loading} empty={<EmptyState ... />}>
 *   <ProjectTable data={data} />
 *   <PaginationComponent total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setSize} />
 * </DataTableContainer>
 * ```
 */
import { cn } from "@/lib/utils";

interface DataTableContainerProps {
  /** 子内容（Table + Pagination） */
  children: React.ReactNode;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 空状态内容 */
  empty?: React.ReactNode;
  /** 额外 CSS class */
  className?: string;
}

/**
 * 渲染数据表格容器 — Card 包裹的 Table + Pagination 组合
 *
 * 对应原型 `.card` > `.table-wrap` + pagination 结构（§7.1 列表页模板数据区域）
 */
export function DataTableContainer({
  children,
  loading,
  empty,
  className,
}: DataTableContainerProps) {
  if (loading) {
    return (
      /* §6.9 骨架屏占位：Card 容器 + 居中 loading 提示 */
      <div
        className={cn(
          "rounded-card bg-card shadow-card overflow-hidden p-8 text-center",
          className,
        )}
      >
        <div className="text-sm text-text-tertiary">加载中...</div>
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          "rounded-card bg-card shadow-card overflow-hidden",
          className,
        )}
      >
        {empty}
      </div>
    );
  }

  return (
    /* §6.4 Card 容器：无 padding(让 table 自行管理)、overflow-hidden、圆角 8px、shadow */
    <div
      className={cn(
        "rounded-card bg-card shadow-card overflow-hidden",
        className,
      )}
    >
      {/* 表格区域 */}
      {children}
    </div>
  );
}
