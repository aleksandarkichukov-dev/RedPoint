import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { getCustomer, listMyOrders } from "@/lib/customer";
import { logoutAction } from "@/lib/customer-actions";
import { formatEur } from "@/lib/price";

export const metadata: Metadata = {
  title: "Моят профил",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Medusa's own words for a state, in the words a customer uses. */
const STATUS: Record<string, string> = {
  pending: "Приготвяме я",
  completed: "Приключена",
  canceled: "Отказана",
  requires_action: "Чака действие",
};

export default async function AccountPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/account/login");

  const orders = await listMyOrders();
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">{name || "Моят профил"}</h1>
          <p className="font-body text-body text-muted-text">{customer.email}</p>
        </div>

        {/* A form rather than a link: logging out changes something, and a
            crawler following a link must not be able to do it. */}
        <form action={logoutAction}>
          <button type="submit" className={buttonClasses("outline")}>
            излез
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-subhead font-bold text-primary uppercase">Поръчки</h2>

        {orders.length === 0 ? (
          <div className="flex flex-col items-start gap-4 border-y border-border py-8">
            <p className="font-body text-body text-body-text">
              Още нямате поръчки.
            </p>
            <Link href="/men" className={buttonClasses("solid")}>
              разгледай колекцията
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/order/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 hover:bg-surface"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-body text-nav text-primary">
                      Поръчка № {order.displayId}
                    </span>
                    <span className="font-body text-body text-muted-text">
                      {new Date(order.createdAt).toLocaleDateString("bg-BG", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {" · "}
                      {STATUS[order.status] ?? order.status}
                    </span>
                  </span>
                  <span className="font-body text-price text-body-text">
                    {formatEur(order.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
