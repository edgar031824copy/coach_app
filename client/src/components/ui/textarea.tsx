import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground font-[family-name:inherit] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
