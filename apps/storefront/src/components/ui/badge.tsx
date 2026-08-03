import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "sale" | "dark";

const variants: Record<BadgeVariant, string> = {
  /* The only sanctioned use of the accent colour anywhere on the site. If a
     badge is not communicating a price reduction, it is not this variant. */
  sale: "bg-accent text-white",
  /* For non-price labels ("НОВО", "ПОСЛЕДЕН РАЗМЕР"). Uses the existing black
     so the red keeps carrying exactly one meaning. */
  dark: "bg-primary text-white",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "sale", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-none px-2 py-0.5 font-body text-badge uppercase",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
