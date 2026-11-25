import * as React from "react"
import { cn } from "@/lib/utils"

// 44 px high on touch screens, 36 px with a mouse; an invalid field (aria-invalid) gets the error border.
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "box-border block h-11 pointer-fine:h-9 w-full rounded-md border border-border bg-card px-3 text-base text-foreground font-[family-name:inherit] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
