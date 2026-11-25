import * as React from "react"
import { cn } from "@/lib/utils"

// A plain `label`: pair it with its field through `htmlFor` and the field's `id`.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm font-semibold text-foreground", className)} {...props} />
}

export { Label }
