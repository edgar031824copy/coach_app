import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva("rounded-xl border p-4", {
  variants: {
    variant: {
      default: "border-border bg-card text-card-foreground shadow-card",
      // Rest days: flat, dashed and see-through, so they read as quieter than a training day.
      quiet: "border-dashed border-border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

function Card({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
}

export { Card, cardVariants }
