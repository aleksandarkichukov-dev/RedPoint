import type { Metadata } from "next";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";

export const metadata: Metadata = {
  title: "Любими · Red Point",
  /* Nothing here is the shop's own content — it is one shopper's list, and
     indexing it would put an empty page in the results under our name. */
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-display">Любими</h1>
      <WishlistGrid />
    </div>
  );
}
