"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Newsletter signup.
 *
 * Local validation and a success state only; there is no list to post to yet.
 * The submit handler is the single line Phase 8 replaces once the client picks
 * a provider.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  return (
    <div className="grid gap-8 py-12 md:grid-cols-[1fr_1fr] md:items-end md:gap-16">
      <div className="flex flex-col gap-3">
        <h2 className="text-white">Бюлетин</h2>
        <p className="max-w-[46ch] font-body text-nav text-white/70">
          Нови постъпления и намаления, веднъж месечно. Без спам.
        </p>
      </div>

      {done ? (
        <p role="status" className="font-body text-nav text-white">
          Готово. Проверете пощата си, за да потвърдите записването.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            // Deliberately loose: a stricter pattern rejects valid addresses
            // more often than it catches typos.
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              setError("Въведете валиден имейл адрес.");
              return;
            }
            setError(undefined);
            setDone(true);
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <Input
            label="Имейл"
            type="email"
            name="email"
            autoComplete="email"
            tone="inverted"
            value={email}
            error={error}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ivan@example.bg"
            className="sm:min-w-[18rem]"
          />
          <Button type="submit" variant="onImage" className="shrink-0">
            запиши ме
          </Button>
        </form>
      )}
    </div>
  );
}
