import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  /* 基础样式：圆角使用 --radius-btn（§4.1 按钮 6px） */
  "group/button inline-flex shrink-0 items-center justify-center rounded-btn border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 ease outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:bg-fill disabled:text-disabled disabled:border-border-strong aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* §6.1 Primary：主色背景 + 白色文字 + 可见同色边框（原型 .btn-primary） */
        default: "bg-primary text-primary-foreground border-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active",
        /* §6.1 Default / Soft：白底 + 强边框，hover 时文字+边框变主色（原型 .btn-default:hover） */
        soft:
          "bg-card text-text-primary border border-border-strong hover:border-primary hover:text-primary active:border-primary-active",
        /* §6.1 Ghost：透明 + 次要文字 + fill 背景 hover */
        ghost:
          "bg-transparent text-text-secondary hover:bg-fill hover:text-text-primary active:bg-fill/80",
        /* §6.1 Danger Ghost：透明 + 红色文字 + 红淡背景 hover */
        dangerGhost:
          "bg-transparent text-danger hover:bg-[var(--danger-bg)] active:bg-[var(--danger-bg)]",
        /* §6.1 Link：透明 + 主色文字 + 下划线 hover */
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-hover",
        /* Destructive：红色系（保留用于危险操作确认按钮） */
        destructive:
          "bg-danger text-white border border-status-error-bg hover:bg-danger-hover focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        /* Outline：边框按钮（保留 shadcn 默认） */
        outline:
          "border-border bg-background hover:bg-fill hover:text-foreground aria-expanded:bg-fill aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        /* Secondary：次要按钮（保留 shadcn 默认） */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
      },
      size: {
        /* §6.1 尺寸规范：Large 36px / Middle(default) 32px / Small 24px */
        default:
          "h-8 gap-1.5 px-4 text-[13px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",   /* 32px = Middle, 字号 13px（原型 .btn） */
        sm:
          "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",  /* 24px = Small */
        lg:
          "h-9 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",  /* 36px = Large */
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-btn [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-btn [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
