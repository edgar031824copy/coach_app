import * as React from "react"
import { cn } from "@/lib/utils"

// A short text chip: intensity, "from your plan", "coach suggestion". It carries words, never color alone.
function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn("inline-block rounded-sm border border-border px-2 text-xs/5 font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Badge }
