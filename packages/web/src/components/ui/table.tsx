import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * §6.3 表格容器 — 圆角 8px、border #f0f0f0、overflow-x auto
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      /* §6.3 容器：圆角 --radius-card(8px)、border divider、overflow-x */
      className="relative w-full overflow-x-auto rounded-card border border-divider shadow-card"
    >
      <table
        data-slot="table"
        /* §6.3.1 铁律1：内容自适应零留白（width: auto + table-layout: auto） */
        className={cn("w-auto table-auto caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      /* §6.3 表头区域：底部 border */
      className={cn("[&_tr]:border-b border-divider", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-divider bg-fill font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * §6.3 表格行 — hover 背景 #fafafa(fill)、选中背景 #e6fffb(primary-bg)
 * 行高 44px（含 padding）
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-divider transition-colors duration-150 ease hover:bg-fill has-aria-expanded:bg-fill/50 data-[state=selected]:bg-primary-bg",
        className
      )}
      {...props}
    />
  )
}

/**
 * §6.3 表头单元格 — 居中、13px、600 weight、bg fill、padding 10px 16px
 * 文字禁止截断（th 不设 text-overflow: ellipsis）
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-center align-middle text-[13px] font-semibold whitespace-nowrap text-text-primary bg-fill [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * §6.3 数据单元格 — 14px、padding 12px 16px、文字溢出省略号
 * 文字列左对齐、状态/数字居中、操作列右对齐
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle text-sm text-text-primary overflow-hidden text-ellipsis whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * §6.3 + Code/数据规格 — 可排序表头（静态箭头示意）
 * 按 §11.2 铁律：仅展示视觉箭头，不实现实际排序逻辑
 */
function SortableTableHead({
  className,
  sortDir,
  children,
  ...props
}: React.ComponentProps<"th"> & {
  /** 当前排序方向：'asc' | 'desc' | null(无排序) */
  sortDir?: "asc" | "desc" | null
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 cursor-pointer select-none text-center align-middle text-[13px] font-semibold whitespace-nowrap text-text-primary bg-fill hover:text-primary [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      <div className="inline-flex items-center gap-1">
        {children}
        {sortDir && (
          <span className={cn(
            "text-[10px] leading-none",
            sortDir ? "text-primary font-bold" : "text-text-tertiary"
          )}>
            {sortDir === "asc" ? "\u2191" : "\u2193"}
          </span>
        )}
      </div>
    </th>
  )
}

/**
 * §6.3 + Code/数据规格 — monospace ID 单元格
 * 等宽字体 13px、灰底 #fafafa(fill)、圆角 3px(--radius-code)
 * 用于表格中的标识符/ID 列（如项目 name 字段）
 */
function CodeCell({
  value,
  className,
  title,
  ...props
}: {
  value: string
  title?: string
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle text-sm overflow-hidden text-ellipsis whitespace-nowrap",
        className
      )}
      title={title || value}
      {...props}
    >
      <span className="inline-block rounded-code bg-fill px-1.5 py-0.5 font-mono text-[13px] text-text-tertiary leading-none">
        {value}
      </span>
    </td>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-text-tertiary", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  /* 新增：排序列头 + Code 单元格 */
  SortableTableHead,
  CodeCell,
}
