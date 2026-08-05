"use client";

import { useActionState, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { placeOrderAction, setDeliveryAction, type CheckoutState } from "@/lib/checkout-actions";
import type { ShippingOption } from "@/lib/checkout";
import { formatEur } from "@/lib/price";
import { useRouter } from "next/navigation";

const PAYMENT_METHODS = [
  { value: "cod", label: "Наложен платеж", note: "без такса" },
  { value: "card", label: "Плащане с карта", note: "чрез myPOS" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

/**
 * One page, three sections, no steps.
 *
 * A three-screen wizard hides the total until the end, which is exactly what a
 * shopper is trying to find out. Everything is visible at once and the summary
 * beside it updates as soon as a delivery method is picked.
 */
export function CheckoutForm({
  options,
  selectedOptionId,
}: {
  options: ShippingOption[];
  selectedOptionId: string | null;
}) {
  const [state, formAction, submitting] = useActionState<CheckoutState, FormData>(
    placeOrderAction,
    {},
  );
  const [delivery, setDelivery] = useState(selectedOptionId ?? "");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const chooseDelivery = (optionId: string) => {
    setDelivery(optionId);
    // Sets it on the cart too, so the totals beside the form are the real ones.
    startTransition(async () => {
      await setDeliveryAction(optionId);
      router.refresh();
    });
  };

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="shippingOptionId" value={delivery} />

      <section className="flex flex-col gap-4">
        <h2 className="text-subhead font-bold text-primary uppercase">1 · Контакти</h2>

        <Input
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fieldError("email")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Име" name="firstName" autoComplete="given-name" required error={fieldError("firstName")} />
          <Input label="Фамилия" name="lastName" autoComplete="family-name" required error={fieldError("lastName")} />
        </div>
        <Input
          label="Телефон"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          error={fieldError("phone")}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-subhead font-bold text-primary uppercase">2 · Доставка</h2>

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Input label="Град" name="city" autoComplete="address-level2" required error={fieldError("city")} />
          <Input label="Пощенски код" name="postalCode" autoComplete="postal-code" required error={fieldError("postalCode")} />
        </div>
        <Input
          label="Адрес или офис на куриера"
          name="address"
          autoComplete="street-address"
          required
          error={fieldError("address")}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-body text-body text-muted-text">Начин на доставка</legend>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {options.map((option) => (
              <li key={option.id}>
                <label
                  className={cn(
                    "group/opt flex cursor-pointer items-center gap-3 py-4 pr-4 pl-5 relative",
                    delivery === option.id && "font-semibold",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px] origin-left bg-primary",
                      "transition-transform duration-(--duration-fast)",
                      delivery === option.id ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                  <input
                    type="radio"
                    name="delivery"
                    value={option.id}
                    checked={delivery === option.id}
                    onChange={() => chooseDelivery(option.id)}
                    className="sr-only"
                  />
                  <span className="flex-1 font-body text-nav text-primary">{option.name}</span>
                  <span className="font-body text-price text-body-text">
                    {formatEur(option.amount)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-subhead font-bold text-primary uppercase">3 · Плащане</h2>

        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.value}>
              <label
                className={cn(
                  "relative flex cursor-pointer items-center gap-3 py-4 pr-4 pl-5",
                  payment === method.value && "font-semibold",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-[3px] origin-left bg-primary",
                    "transition-transform duration-(--duration-fast)",
                    payment === method.value ? "scale-x-100" : "scale-x-0",
                  )}
                />
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.value}
                  checked={payment === method.value}
                  onChange={() => setPayment(method.value)}
                  className="sr-only"
                />
                <span className="flex-1 font-body text-nav text-primary">{method.label}</span>
                <span className="font-body text-body text-muted-text">{method.note}</span>
              </label>
            </li>
          ))}
        </ul>

        <p className="font-body text-body text-muted-text">
          {payment === "card"
            ? "Ще ви прехвърлим към защитената страница на myPOS. Данните на картата не минават през нашия сайт."
            : "Плащате в брой на куриера при получаване."}
        </p>
      </section>

      {state.error && (
        <p role="alert" className="font-body text-nav font-semibold text-primary">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="solid" disabled={submitting || !delivery}>
        {submitting ? "изпращаме поръчката..." : "поръчай"}
      </Button>

      {!delivery && (
        <p className="-mt-6 font-body text-body text-muted-text">
          Изберете начин на доставка, за да продължите.
        </p>
      )}
    </form>
  );
}
