import clsx, { type ClassValue } from "clsx";

/**
 * Deliberately clsx only, with no tailwind-merge.
 *
 * tailwind-merge resolves conflicts by recognising Tailwind's stock class
 * names. This project resets almost every Tailwind namespace and replaces it
 * with its own (`text-hero`, `rounded-sharp`, `bg-neutral`), so tailwind-merge
 * would not recognise them and could drop the wrong class silently. Explicit
 * variant maps beat automatic conflict resolution here.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
