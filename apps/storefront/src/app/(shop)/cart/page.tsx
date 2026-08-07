import type { Metadata } from "next";
import Link from "next/link";
import { CartLines } from "@/components/cart/cart-lines";
import { buttonClasses } from "@/components/ui/button";
import { getCart } from "@/lib/cart";
import { formatBgn, formatEur } from "@/lib/price";

export const metadata: Metadata = {
  title: "Количка",
  robots: { index: false },
};

/** A cart is per-shopper, so it can never be prerendered or cached. */
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getCart();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-(--container-page) flex-col items-start justify-center gap-6 px-4 py-16 md:px-8">
        <h1 className="text-display">Количката е празна</h1>
        <p className="max-w-[52ch] font-body text-nav text-body-text">
          Разгледайте мъжката колекция и добавете нещо, което ви харесва.
        </p>
        <Link href="/men" className={buttonClasses("solid")}>
          разгледай колекцията
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-display">
        Количка{" "}
        <span className="font-body text-subhead text-muted-text">
          {cart.itemCount} {cart.itemCount === 1 ? "артикул" : "артикула"}
        </span>
      </h1>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <CartLines lines={cart.lines} />

        {/* Sticky on desktop: the totals are what a shopper checks against
            while editing quantities further up the list. */}
        <aside className="flex h-fit flex-col gap-4 border-t border-border pt-6 lg:sticky lg:top-28">
          <h2 className="text-subhead font-bold text-primary uppercase">Общо</h2>

          <dl className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-body text-nav text-body-text">Артикули</dt>
              <dd className="font-body text-nav text-primary">{formatEur(cart.itemTotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-body text-nav text-body-text">Доставка</dt>
              {/* The real figure arrives once a delivery method is picked in
                  checkout. Showing 0,00 € here would read as free shipping. */}
              <dd className="font-body text-body text-muted-text">
                изчислява се при поръчка
              </dd>
            </div>
          </dl>

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="font-headline text-subhead tracking-[0.06em] uppercase">
              Общо
            </span>
            <span className="flex flex-col items-end">
              <span className="font-body text-price text-body-text">
                {formatEur(cart.total)}
              </span>
              <span className="font-body text-body text-muted-text">
                ({formatBgn(cart.total)})
              </span>
            </span>
          </div>

          <Link href="/checkout" className={buttonClasses("solid", "w-full")}>
            към поръчката
          </Link>

          <Link
            href="/men"
            className="text-center font-body text-nav text-primary underline underline-offset-4"
          >
            продължи пазаруването
          </Link>
        </aside>
      </div>
    </div>
  );
}
