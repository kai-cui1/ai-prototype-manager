/**
 * @module PaginationComponent
 * @description 分页器组件 — §6.7 完整规格 + 高保真原型对齐
 *
 * 布局结构（§6.7.1 固定顺序，原型一致）：
 *   [共 N 条记录] [pageSize <select>] | [<] [1] [2] [>] | 跳至 [_] 页
 *
 * 原型风格：页码导航使用 < > 文字按钮（非图标）
 */
import { PAGINATION } from "@/tokens";

interface PaginationComponentProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** §6.7 新增：pageSize 切换回调 */
  onPageSizeChange?: (size: number) => void;
}

/**
 * 渲染完整分页器 — 对齐 §6.7 全部子章节规格 + 原型视觉
 *
 * 总页数 ≤ 1 时自动隐藏。
 */
export function PaginationComponent({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationComponentProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && total === 0) return null;

  const goTo = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    if (clamped !== page) onPageChange(clamped);
  };

  /* §6.7.4 跳页输入处理：边界保护 */
  const handleJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(e.currentTarget.value, 10);
      if (!isNaN(val)) goTo(val);
    }
  };

  const handleJumpBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = parseInt(e.currentTarget.value, 10);
    if (!isNaN(val)) goTo(val);
  };

  // Generate page numbers with ellipsis（最多显示 5 个页码）
  const pages: (number | "...")[] = [];
  if (totalPages <= PAGINATION.MAX_VISIBLE_PAGES) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    /* §6.7.1 布局容器 — border-top 分隔线 + 圆角底部 */
    <div className="flex items-center gap-3 border-t border-divider px-4 py-3 text-xs rounded-b-card">
      {/* 元素 #1：总数信息 */}
      <span className="text-text-tertiary whitespace-nowrap">
        共 {total} 条记录
      </span>

      {/* 元素 #2：pageSize 选择器（§6.7.2） */}
      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          /* §6.7.2：28px 高、12px 字号、圆角 6px */
          className="h-7 rounded-btn border border-border-strong bg-card px-1.5 py-0 text-[12px] text-text-primary outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(8,151,156,0.1)]"
        >
          {PAGINATION.PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} 条/页
            </option>
          ))}
        </select>
      )}

      {/* 元素 #3：分隔线 */}
      <div className="h-5 w-px bg-divider" />

      {/* 元素 #4：页码按钮组（§6.7.3）— 原型风格：< > 文字按钮 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          className={`h-[30px] w-[30px] rounded-btn border text-xs font-family-inherit transition-all duration-150 ease ${
            page <= 1
              ? "border-border-strong text-disabled cursor-not-allowed"
              : "border-border-strong text-text-primary hover:border-primary hover:text-primary cursor-pointer"
          }`}
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          &lt;
        </button>

        {/* 页码按钮 */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-text-tertiary">
              &#8230;
            </span>
          ) : (
            <button
              key={p}
              className={`h-[30px] min-w-[30px] rounded-btn border text-xs font-family-inherit transition-all duration-150 ease cursor-pointer ${
                p === page
                  ? "bg-primary text-white border-primary"
                  : "border-border-strong text-text-primary hover:border-primary hover:text-primary"
              }`}
              onClick={() => goTo(p)}
            >
              {p}
            </button>
          ),
        )}

        {/* 下一页 */}
        <button
          className={`h-[30px] w-[30px] rounded-btn border text-xs font-family-inherit transition-all duration-150 ease ${
            page >= totalPages
              ? "border-border-strong text-disabled cursor-not-allowed"
              : "border-border-strong text-text-primary hover:border-primary hover:text-primary cursor-pointer"
          }`}
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
        >
          &gt;
        </button>
      </div>

      {/* 元素 #5：分隔线 */}
      <div className="h-5 w-px bg-divider" />

      {/* 元素 #6：跳页输入（§6.7.4） */}
      <div className="flex items-center gap-1.5 text-text-secondary whitespace-nowrap">
        <span>跳至</span>
        <input
          type="text"
          defaultValue={page}
          onKeyDown={handleJump}
          onBlur={handleJumpBlur}
          /* §6.7.4：44px 宽 × 28px 高、居中文字、圆角 6px */
          className="h-7 w-11 rounded-btn border border-border-strong bg-card px-1.5 py-0 text-center text-[12px] text-text-primary outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(8,151,156,0.1)]"
        />
        <span>页</span>
      </div>
    </div>
  );
}
