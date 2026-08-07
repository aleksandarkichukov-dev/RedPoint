import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCart } from "@/lib/cart";
import { getSelectedShippingOptionId, listShippingOptions } from "@/lib/checkout";
import { paymentMethods } from "@/lib/payment-methods";
import { formatBgn, formatEur } from "@/lib/price";

export const metadata: Metadata = {
  title: "Поръчка",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart || cart.lines.length === 0) redirect("/cart");

  const [options, selectedOptionId] = await Promise.all([
    listShippingOptions(cart.id),
    getSelectedShippingOptionId(cart.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-display">Поръчка</h1>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <CheckoutForm
          options={options}
          selectedOptionId={selectedOptionId}
          paymentMethods={paymentMethods()}
        />

        <aside className="flex h-fit flex-col gap-4 border-t border-border pt-6 lg:sticky lg:top-28">
          <h2 className="text-subhead font-bold text-primary uppercase">Вашата поръчка</h2>

          <ul className="flex flex-col divide-y divide-border">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="font-body text-body text-primary uppercase">{line.title}</span>
                  <span className="font-body text-body text-muted-text">
                    {line.variantTitle} · {line.quantity} бр.
                  </span>
                </span>
                <span className="font-body text-price whitespace-nowrap text-body-text">
                  {formatEur(line.total)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="font-body text-nav text-body-text">Артикули</dt>
              <dd className="font-body text-nav text-primary">{formatEur(cart.itemTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-body text-nav text-body-text">Доставка</dt>
              <dd className="font-body text-nav text-primary">
                {selectedOptionId ? (
                  formatEur(cart.shippingTotal)
                ) : (
                  <span className="text-body text-muted-text">изберете начин</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="font-headline text-subhead tracking-[0.06em] uppercase">Общо</span>
            <span className="flex flex-col items-end">
              <span className="font-body text-price text-body-text">{formatEur(cart.total)}</span>
              <span className="font-body text-body text-muted-text">({formatBgn(cart.total)})</span>
            </span>
          </div>

          <Link
            href="/cart"
            className="text-center font-body text-nav text-primary underline underline-offset-4"
          >
            обратно към количката
          </Link>
        </aside>
      </div>
    </div>
  );
}
