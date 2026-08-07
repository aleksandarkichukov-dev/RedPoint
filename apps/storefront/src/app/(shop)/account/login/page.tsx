import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm, RegisterForm } from "@/components/account/account-forms";
import { getCustomer, googleSignInEnabled } from "@/lib/customer";

export const metadata: Metadata = {
  title: "Вход и регистрация",
  description: "Влезте в профила си или си направете нов, за да следите поръчките си.",
  /* A login page in search results is noise, and the one with a `?next=`
     on it is worse. */
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

/**
 * Log in and register, on one page.
 *
 * Two pages with a link between them makes somebody who guessed wrong type
 * their email twice. Both forms are here, and whichever they need is already
 * in front of them.
 *
 * An account is never required to buy anything. It is here so a returning
 * customer does not retype an address and can see what they ordered without
 * digging out an order number.
 */
export default async function LoginPage() {
  /* Already in — there is nothing to log into. */
  if (await getCustomer()) redirect("/account");

  const google = googleSignInEnabled();

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-display">Профил</h1>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-subhead font-bold text-primary uppercase">Вход</h2>
            <p className="font-body text-body text-muted-text">
              Имате профил? Влезте, за да видите поръчките си.
            </p>
          </div>
          <LoginForm googleEnabled={google} />
        </section>

        <section className="flex flex-col gap-6 border-t border-border pt-12 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-16">
          <div className="flex flex-col gap-2">
            <h2 className="text-subhead font-bold text-primary uppercase">Нов профил</h2>
            <p className="font-body text-body text-muted-text">
              За да не попълвате адреса си всеки път. Може и без профил — поръчката
              минава и така.
            </p>
          </div>
          <RegisterForm googleEnabled={google} />
        </section>
      </div>
    </div>
  );
}
