"use client";

import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Posts the signed myPOS form and takes the shopper to their payment page.
 *
 * The submit button is real markup, not a fallback bolted on: the form works
 * without JavaScript, and the effect below only saves a click when scripts do
 * run. A payment page that needs JavaScript to be reachable strands anyone
 * whose script failed to load, at the worst possible moment.
 *
 * Field order is preserved exactly as the backend signed it. Reordering these
 * inputs would invalidate the signature and myPOS would reject the payment.
 */
export function MyposRedirect({
  url,
  fields,
}: {
  url: string;
  fields: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    // React 18 mounts effects twice in development; a double submit would send
    // the shopper to myPOS twice and log a confusing second request.
    if (submitted.current) return;
    submitted.current = true;
    form.current?.submit();
  }, []);

  return (
    <form ref={form} action={url} method="POST" className="contents">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <button type="submit" className={buttonClasses("solid")}>
        продължи към плащането
      </button>
    </form>
  );
}
