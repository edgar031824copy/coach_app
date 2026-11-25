import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva("flex gap-3 rounded-lg border px-4 py-3.5 text-base [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "border-border bg-secondary text-foreground",
      danger: "border-alert-border bg-alert text-alert-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

// The caller sets the role: "note" for the safety note, "alert" for a failure, "status" for progress text.
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export { Alert, alertVariants }
