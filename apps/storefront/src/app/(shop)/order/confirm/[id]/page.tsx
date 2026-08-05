import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Плащането е прието · Red Point",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Where myPOS send the shopper back after a successful payment.
 *
 * Deliberately says nothing about the order being paid. myPOS are explicit
 * that this redirect must never be treated as authorisation — the browser can
 * be closed before it arrives, and anyone can type this URL. The payment is
 * recorded only when their signed server-to-server notification reaches
 * /hooks/mypos/notify.
 *
 * So this page thanks the shopper, tells them what happens next, and links to
 * the order, which shows the real state.
 *
 * `[id]` here is the display number myPOS echoed back, not the order's ULID,
 * which is why it does not link straight into the order page.
 */
export default async function PaymentConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-(--container-page) flex-col items-start justify-center gap-6 px-4 py-16 md:px-8">
      <h1 className="text-display">Благодарим!</h1>

      <p className="max-w-[52ch] font-body text-nav text-body-text">
        Плащането за поръчка <span className="font-semibold">№ {id}</span> е прието
        от myPOS. Потвърждаваме го в момента и ще получите имейл, щом е готово —
        обикновено до минута.
      </p>

      <p className="max-w-[52ch] font-body text-body text-muted-text">
        Ако имейлът не пристигне до час, обадете се на{" "}
        <a href="tel:+359892475402" className="underline underline-offset-4">
          +359 89 247 5402
        </a>{" "}
        и кажете номера на поръчката.
      </p>

      <Link href="/men" className={buttonClasses("solid")}>
        обратно в магазина
      </Link>
    </div>
  );
}
