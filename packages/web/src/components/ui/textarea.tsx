import * as React from "react"

import { cn } from "@/lib/utils"

/* React 18 下 ref 不能作为普通 prop 传递，需 forwardRef（调用方需要 textarea DOM 做自动增高/聚焦） */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        /* §6.1 Textarea：对齐原型 .input（height:auto/min-height:80px 由调用方控制） */
        "flex w-full rounded-input border border-border-strong bg-card px-2.5 text-[13px] transition-colors outline-none placeholder:text-text-tertiary focus-visible:border-primary focus-visible:shadow-[0_0_0_2px_rgba(8,151,156,0.10)] disabled:cursor-not-allowed disabled:bg-fill disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
})

export { Textarea }
