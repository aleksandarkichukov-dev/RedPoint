"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard, type ProductCardProps } from "@/components/ui/product-card";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { getWishlistCards } from "@/lib/wishlist-actions";

/**
 * The favourites page.
 *
 * The list is in the browser and the prices are behind the API, so the cards
 * are fetched after mount. Prices and stock are read fresh every time rather
 * than stored alongside the handles: a favourite kept for a month would
 * otherwise show what it cost a month ago, which is the one number a shopper
 * came back to check.
 */
export function WishlistGrid() {
  const { handles, keepOnly, ready } = useWishlist();
  const [cards, setCards] = useState<ProductCardProps[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;

    if (handles.length === 0) {
      setCards([]);
      return;
    }

    let current = true;
    getWishlistCards(handles)
      .then((result) => {
        if (current) {
          setCards(result);
          setFailed(false);
          /* Anything that did not come back is gone from the shop. Dropping it
             here is what keeps the header's count and this page in agreement. */
          keepOnly(result.map((card) => card.handle));
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });

    return () => {
      current = false;
    };
  }, [handles, keepOnly, ready]);

  if (!ready || (cards === null && !failed)) {
    return (
      <p className="font-body text-body text-muted-text" role="status">
        Зареждаме…
      </p>
    );
  }

  if (failed) {
    return (
      <p className="font-body text-body text-primary" role="alert">
        Списъкът не се зареди. Презаредете страницата.
      </p>
    );
  }

  if (cards!.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="font-body text-body text-muted-text">
          Няма нищо в любими. Натиснете сърцето върху дреха, която ви харесва, и
          тя ще се появи тук.
        </p>
        <Link href="/men" className="font-body text-control text-primary underline">
          разгледай колекцията
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      {cards!.map((card) => (
        <ProductCard key={card.handle} {...card} />
      ))}
    </div>
  );
}
