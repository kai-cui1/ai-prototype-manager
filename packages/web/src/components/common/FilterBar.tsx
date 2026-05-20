/**
 * @module FilterBar
 * @description 筛选栏组件 — §7.1 列表页模板第二行
 *
 * 布局：Card 包裹（p-4 / 8px 圆角 / shadow-card）
 * 内容：SearchInput(240px) + 筛选 Badge 组 + 操作按钮
 *
 * @example
 * ```tsx
 * <FilterBar
 *   searchPlaceholder="搜索项目名称..."
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   filters={STATUS_FILTERS}
 *   activeFilter={status}
 *   onFilterChange={setStatus}
 *   action={<Button size="sm"><Plus /> 新建</Button>}
 * />
 * ```
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterOption {
  /** 筛选 key */
  key: string;
  /** 显示标签 */
  label: string;
  /** 当前值 */
  value: string;
}

interface FilterBarProps {
  /** 搜索框 placeholder */
  searchPlaceholder?: string;
  /** 搜索框当前值 */
  searchValue?: string;
  /** 搜索回调 */
  onSearchChange?: (value: string) => void;
  /** 筛选选项列表 */
  filters?: FilterOption[];
  /** 当前激活的筛选 key */
  activeFilter?: string;
  /** 筛选切换回调 */
  onFilterChange?: (key: string) => void;
  /** 右侧操作区（如 "+ 新建" 按钮） */
  action?: React.ReactNode;
  /** 额外 CSS class */
  className?: string;
}

/**
 * 渲染筛选栏 — Card 包裹的搜索 + 标签筛选 + 操作按钮
 *
 * 对应原型 `.filter-bar` in `.card` 结构（§7.1 列表页模板第二行）
 */
export function FilterBar({
  searchPlaceholder = "搜索...",
  searchValue,
  onSearchChange,
  filters = [],
  activeFilter,
  onFilterChange,
  action,
  className,
}: FilterBarProps) {
  return (
    /* §6.4 Card 包裹：p-4 内边距、8px 圆角、shadow-card */
    <div className={cn("rounded-card bg-card shadow-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索输入框 — 默认 240px 宽度 */}
        <SearchInput
          width={240}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />

        {/* 筛选 Badge 组 */}
        {filters.length > 0 && (
          <div className="flex gap-1">
            {filters.map((opt) => {
              const isActive = opt.key === activeFilter;
              return (
                <button
                  key={opt.key}
                  onClick={() => onFilterChange?.(opt.key)}
                  /* §6.5 Badge 样式：active 用 active 变体，非 active 用 outline */
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-tag border px-2 py-1 text-xs font-medium whitespace-nowrap transition-all duration-150 ease cursor-pointer select-none",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-text-secondary border-border-strong hover:text-primary hover:border-primary",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 右侧操作区 */}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
