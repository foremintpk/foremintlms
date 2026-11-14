import { cn } from "cn"

/** Loading placeholder. Styles (tint + sweep) live in globals.css `.skeleton`. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
