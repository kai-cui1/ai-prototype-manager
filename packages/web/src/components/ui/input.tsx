import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

/** 原型 .search-icon: 14px × 14px, 细线（stroke 1.5 使小尺寸下视觉精致） */
const SearchIcon = () => <Search className="h-[14px] w-[14px]" strokeWidth={1.5} />

/**
 * §6.2 输入框 — 高度 32px（与按钮对齐）、圆角 rounded-input(--radius-input)
 * 字号 13px（原型 .input 规范，design-tokens.ts fontSize.bodySmall）
 * Focus: border primary + shadow-focus-primary token
 * Error: border destructive + shadow-focus-error token
 */
function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-input border border-border-strong bg-transparent px-2.5 py-1.5 text-[13px] transition-colors duration-150 ease outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground placeholder:text-text-tertiary focus-visible:border-primary focus-visible:shadow-focus-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-fill disabled:text-disabled disabled:border-border-strong disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-focus-error",
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
  icon = <SearchIcon />,
  iconPosition = "left",
  width,
  ...props
}: SearchInputProps) {
  return (
    <div className="relative" style={width ? { width: typeof width === 'number' ? `${width}px` : width } : undefined}>
      {iconPosition === "left" && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
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
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
          {icon}
        </span>
      )}
    </div>
  )
}

export { Input, SearchInput }
