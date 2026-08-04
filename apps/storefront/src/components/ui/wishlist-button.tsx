"use client";

import { Heart } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface WishlistButtonProps {
  productName: string;
  defaultPressed?: boolean;
  className?: string;
}

/**
 * Plain outline glyph with no background chrome, per the product-card spec.
 * Local state only for now; it gets wired to the customer account in Phase 5.
 */
export function WishlistButton({
  productName,
  defaultPressed = false,
  className,
}: WishlistButtonProps) {
  const [pressed, setPressed] = useState(defaultPressed);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={
        pressed
          ? `Премахни ${productName} от любими`
          : `Добави ${productName} в любими`
      }
      onClick={(event) => {
        // The card is a link; the heart must not navigate.
        event.preventDefault();
        setPressed((current) => !current);
      }}
      className={cn(
        "grid size-11 place-items-center text-primary",
        /* 0.97, not 0.9. Press feedback should register as the interface
           acknowledging the tap, not as the icon shrinking away from it. */
        "transition-transform duration-(--duration-fast) active:scale-[0.97]",
        className,
      )}
    >
      <Heart size={20} weight={pressed ? "fill" : "regular"} aria-hidden />
    </button>
  );
}
