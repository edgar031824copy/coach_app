import * as React from "react"

// Decorative icons, drawn inline (no icon library). They are hidden from screen readers because the text beside them
// carries the meaning. They take the surrounding text color; size them with a class such as `size-5`.
function Icon({ children, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Running. */
export function RouteIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </Icon>
  )
}

/** CrossFit. */
export function BarbellIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M3 12h18M6 7v10M9.5 9v6M14.5 9v6M18 7v10" />
    </Icon>
  )
}

/** Rest day. */
export function MoonIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </Icon>
  )
}

/** The safety note and failures. */
export function WarningIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </Icon>
  )
}

/** Delete (the trash can on the plan's summary card). */
export function TrashIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Icon>
  )
}

/** The week switcher: an earlier plan. */
export function ChevronLeftIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Icon>
  )
}

/** The week switcher: a later plan. */
export function ChevronRightIcon(props: React.ComponentProps<"svg">) {
  return (
    <Icon {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Icon>
  )
}
