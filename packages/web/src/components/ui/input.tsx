import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * §6.2 输入框 — 高度 32px（与按钮对齐）、圆角 6px(--radius-btn)
 * Focus: border primary + shadow 0 0 0 2px rgba(8,151,156,0.1)
 * Error: border destructive + shadow 0 0 0 2px rgba(255,77,79,0.1)
 */
function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLElement>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-btn border border-border-strong bg-transparent px-3 py-1.5 text-sm transition-colors duration-150 ease outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-text-tertiary focus-visible:border-primary focus-visible:shadow-[0_0_0_2px_rgba(8,151,156,0.1)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-fill disabled:text-disabled disabled:border-border-strong disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_2px_rgba(255,77,79,0.1)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * 搜索输入框 — 带 Search 图标的复合组件（§6 + 列表页 Filter Bar）
 * 默认宽度 240px，图标位置可配置
 */
interface SearchInputProps {
  className?: string;
  /** 搜索框 value */
  value?: string;
  /** 搜索框 defaultValue */
  defaultValue?: string;
  /** 搜索框 placeholder */
  placeholder?: string;
  /** 搜索回调 */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** 图标组件（默认 Search） */
  icon?: React.ReactNode;
  /** 图标位置：'left' | 'right' */
  iconPosition?: "left" | "right";
  /** 固定宽度（如 FilterBar 中默认 240px） */
  width?: string | number;
}

function SearchInput({
  className,
  icon = <Search />,
  iconPosition = "left",
  width,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", width ? `w-[${width}]` : "w-full")}>
      {iconPosition === "left" && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none">
          {icon}
        </span>
      )}
      <Input
        className={cn(
          iconPosition === "left" ? "pl-[30px]" : "pr-8",
          className
        )}
        {...props}
      />
      {iconPosition === "right" && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none">
          {icon}
        </span>
      )}
    </div>
  )
}

export { Input, SearchInput }
