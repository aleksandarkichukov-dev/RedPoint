import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { getOrder } from "@/lib/checkout";
import { formatBgn, formatEur } from "@/lib/price";

export const metadata: Metadata = {
  title: "Поръчката е приета",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Order confirmation.
 *
 * Reached by redirect straight after checkout, and it is the only record a
 * guest has until the email arrives, so it repeats everything: what was
 * ordered, where it goes, how it is paid and what it costs.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [order, query] = await Promise.all([getOrder(id), searchParams]);
  if (!order) notFound();

  /* myPOS send a shopper who backed out to this page. The order exists and is
     unpaid, so the page cannot open with "Благодарим!" — that would tell
     somebody who chose not to pay that their payment went through. */
  const cancelled = query.payment === "cancelled";

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-display">{cancelled ? "Плащането е прекъснато" : "Благодарим!"}</h1>
        {cancelled ? (
          <p className="max-w-[52ch] font-body text-nav text-body-text">
            Поръчка <span className="font-semibold">№ {order.displayId}</span> е запазена, но
            още не е платена. Нищо не е удържано от картата ви.
          </p>
        ) : (
          <p className="max-w-[52ch] font-body text-nav text-body-text">
            Поръчка <span className="font-semibold">№ {order.displayId}</span> е приета.
            Изпратихме потвърждение на {order.email}.
          </p>
        )}
      </header>

      {/* A way forward, not just an explanation. Somebody who abandoned a
          payment page usually did it because something went wrong with the
          card, and their order is sitting here intact — so the two things they
          might want are one button apart. */}
      {cancelled && (
        <div className="flex flex-col gap-4 border border-primary p-4 md:p-6">
          <p className="max-w-[60ch] font-body text-body text-body-text">
            Можете да опитате плащането отново, или да се обадите в магазина, за
            да я оставим с наложен платеж — тогава плащате на куриера при
            получаване.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/checkout/pay/${id}`} className={buttonClasses("solid")}>
              опитай плащането отново
            </Link>
            <a
              href="tel:+359892475402"
              className="font-body text-nav text-primary underline underline-offset-4"
            >
              +359 89 247 5402
            </a>
          </div>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <section className="flex flex-col gap-4">
          <h2 className="text-subhead font-bold text-primary uppercase">Артикули</h2>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {order.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4 py-4">
                <span className="flex flex-col gap-0.5">
                  <span className="font-body text-nav text-primary uppercase">{line.title}</span>
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

          <Link href="/men" className={buttonClasses("outline", "self-start")}>
            обратно в магазина
          </Link>
        </section>

        <aside className="flex h-fit flex-col gap-6 border-t border-border pt-6">
          {order.address && (
            <div className="flex flex-col gap-1">
              <h2 className="mb-1 text-subhead font-bold text-primary uppercase">Доставка</h2>
              <p className="font-body text-body text-body-text">{order.address.name}</p>
              <p className="font-body text-body text-body-text">
                {order.address.postalCode} {order.address.city}
              </p>
              <p className="font-body text-body text-body-text">{order.address.address}</p>
              <p className="font-body text-body text-muted-text">{order.address.phone}</p>
              {order.shippingMethod && (
                <p className="mt-2 font-body text-body text-body-text">{order.shippingMethod}</p>
              )}
            </div>
          )}

          {order.paymentMethod && (
            <div className="flex flex-col gap-1">
              <h2 className="mb-1 text-subhead font-bold text-primary uppercase">Плащане</h2>
              <p className="font-body text-body text-body-text">{order.paymentMethod}</p>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="font-headline text-subhead tracking-[0.06em] uppercase">Общо</span>
            <span className="flex flex-col items-end">
              <span className="font-body text-price text-body-text">{formatEur(order.total)}</span>
              <span className="font-body text-body text-muted-text">({formatBgn(order.total)})</span>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
