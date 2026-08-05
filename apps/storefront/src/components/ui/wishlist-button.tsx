"use client";

import { Heart } from "@phosphor-icons/react";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { cn } from "@/lib/cn";

export interface WishlistButtonProps {
  /** The product's handle — what the favourites list stores it under. */
  handle: string;
  productName: string;
  className?: string;
}

/**
 * Plain outline glyph with no background chrome, per the product-card spec.
 *
 * The filled state comes from the shared list, not from local state, so the
 * heart on a card, the one on the product page and the count in the header all
 * say the same thing, and all of them survive a reload.
 */
export function WishlistButton({ handle, productName, className }: WishlistButtonProps) {
  const { has, ready, toggle } = useWishlist();
  const pressed = ready && has(handle);

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
        toggle(handle);
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
