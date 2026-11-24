import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

// 44 px high on touch screens, 36 px with a mouse (design.md, decision 4). Colors come from the tokens only.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border px-5 text-base font-semibold whitespace-nowrap font-[family-name:inherit] cursor-pointer transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-border bg-card text-foreground hover:bg-secondary",
        secondary: "border-border bg-secondary text-foreground hover:bg-secondary/70",
      },
      size: {
        default: "h-11 pointer-fine:h-9 min-w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
