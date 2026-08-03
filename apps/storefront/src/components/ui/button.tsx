import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "solid" | "onImage" | "outline";

/* Lowercase labels against uppercase headlines is a deliberate rhythm in this
   system, not an inconsistency. Never uppercase a button. */
const base =
  "inline-flex items-center justify-center whitespace-nowrap rounded-sharp " +
  "font-body text-control lowercase h-(--control-height) px-4 " +
  "transition-colors duration-(--duration-fast) " +
  "active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  /* On white surfaces. Black fill, white label. */
  solid: "bg-primary text-white hover:bg-secondary",
  /* Over photography or video. The 2px stroke is what keeps the label legible
     against an unpredictable background, so it is not optional. */
  onImage: "border-2 border-white text-white hover:bg-white hover:text-primary",
  /* Secondary action on white. */
  outline:
    "border-2 border-primary text-primary hover:bg-primary hover:text-white",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Class string for the same three variants, for use on `next/link` anchors. */
export function buttonClasses(variant: ButtonVariant = "solid", className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "solid",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
