import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  /* 基础样式：圆角使用 --radius-tag（§6.5 Badge 圆角 4px），尺寸 12px / h:8px v:4px */
  "group/badge inline-flex shrink-0 items-center justify-center gap-1 overflow-hidden rounded-tag border px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-150 ease focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        /* ===== §6.5 状态 Badge / Tag — 8 种类型 ===== */

        /* Active（活跃）：teal 浅底 + teal 文字 */
        active: "bg-status-active-bg text-status-active-text border border-status-active-border",
        /* Archived（归档）：橙浅底 + 橙文字 */
        archived: "bg-status-archived-bg text-status-archived-text border border-status-archived-border",
        /* Draft（草稿）：灰底 + 灰文字 */
        draft: "bg-status-draft-bg text-status-draft-text border border-status-draft-border",

        /* Info：蓝浅底 + 蓝文字 */
        info: "bg-status-info-bg text-status-info-text border border-status-info-border",
        /* Success：绿浅底 + 绿文字 */
        success: "bg-status-success-bg text-status-success-text border border-status-success-border",
        /* Warning：黄浅底 + 黄文字 */
        warning: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
        /* Error / Danger：红浅底 + 红文字 */
        error: "bg-status-error-bg text-status-error-text border border-status-error-border",

        /* shadcn 默认变体（保留兼容） */
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-fill [a]:hover:text-text-secondary",
        ghost:
          "hover:bg-fill hover:text-text-secondary dark:hover:bg-fill/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
