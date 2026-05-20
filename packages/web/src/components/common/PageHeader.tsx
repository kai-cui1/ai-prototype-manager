/**
 * @module PageHeader
 * @description 页面标题栏 — §7.1 列表页模板第一行
 *
 * 布局：flex row，space-between，margin-bottom 5(20px)
 * 标题：20px / 600 weight (§3 H1 页面标题)
 * 操作区：右侧插槽（通常放 "+ 新建" 大按钮 lg 尺寸）
 */
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** 页面标题文字 */
  title: string;
  /** 右侧操作区（如 "+ 新建项目" 按钮） */
  action?: React.ReactNode;
  /** 额外 CSS class */
  className?: string;
}

/**
 * 渲染页面级标题栏 — 对齐 §7.1 Page Header 区域
 *
 * @example
 * ```tsx
 * <PageHeader title="项目管理" action={<Button size="lg"><Plus /> 新建项目</Button>} />
 * ```
 */
export function PageHeader({ title, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-5",
        className,
      )}
    >
      {/* §3 H1 页面标题：20px / 600 weight */}
      <h1 className="text-[20px] font-semibold text-text-primary leading-snug">
        {title}
      </h1>
      {/* 操作区：右侧 */}
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
