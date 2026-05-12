/**
 * @module SectionHeading
 * @description 区块标题组件 — 统一各页面区块标题样式
 *
 * 样式：13px / 500 weight / secondary 色
 * 可选：图标（左侧）、计数 Badge（右侧）、操作按钮（右侧）
 */
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SectionHeadingProps {
  /** 区块标题文字 */
  title: string;
  /** 左侧图标（如 lucide-react 图标） */
  icon?: React.ReactNode;
  /** 右侧计数 Badge（如 "3"） */
  count?: number;
  /** 右侧操作区（如 "新建" 按钮） */
  action?: React.ReactNode;
  /** 额外 CSS class */
  className?: string;
}

/**
 * 渲染统一的区块标题 — 消除手写 h3 + flex 的不一致
 *
 * @example
 * ```tsx
 * <SectionHeading title="模块统计" icon={<Boxes />} />
 * <SectionHeading title="公司/组织" count={companies.length} action={<Button size="sm">新建</Button>} />
 * ```
 */
export function SectionHeading({ title, icon, count, action, className }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-3",
        className,
      )}
    >
      {/* 左侧：图标 + 标题 */}
      <div className="flex items-center gap-2">
        {icon && <span className="text-text-secondary">{icon}</span>}
        {/* §3 H3 子标题：13px / 500 weight / secondary 色 */}
        <h3 className="text-[13px] font-medium text-text-secondary">{title}</h3>
      </div>

      {/* 右侧：Badge + 操作 */}
      {(count !== undefined || action) && (
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
