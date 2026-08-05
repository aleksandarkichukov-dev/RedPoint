import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MyposRedirect } from "@/components/checkout/mypos-redirect";
import { buildMyposPurchase } from "@/lib/mypos";

export const metadata: Metadata = {
  title: "Прехвърляме ви към плащането · Red Point",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * The hop between our checkout and the myPOS payment page.
 *
 * myPOS take a signed POST, not a link, so this renders their fields as a form
 * and submits it. The signing happens on the backend — the private key never
 * comes near the browser — and this page only ever receives what to post and
 * where.
 *
 * It renders a visible submit button as well as auto-submitting. Nothing here
 * may depend on JavaScript running: a shopper who has just been charged
 * nothing yet, staring at a blank page because a script failed, has no way
 * forward.
 */
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await buildMyposPurchase(id);

  if (!purchase) notFound();

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-(--container-page) flex-col items-start justify-center gap-6 px-4 py-16 md:px-8">
      <h1 className="text-display">Прехвърляме ви към плащането</h1>

      <p className="max-w-[52ch] font-body text-nav text-body-text">
        Изчакайте момент. Ако страницата не се смени сама, натиснете бутона.
      </p>

      <MyposRedirect url={purchase.url} fields={purchase.fields} />

      <Link
        href={`/order/${id}`}
        className="font-body text-body text-muted-text underline underline-offset-4"
      >
        обратно към поръчката
      </Link>
    </div>
  );
}
