"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * What a shopper sees when a catalogue page cannot load.
 *
 * Almost always this is the backend being unreachable, which on a listing or a
 * product page means there is nothing to render at all. Next's default is a
 * blank screen with a digest hash, which tells a shopper nothing and tells
 * them it in English.
 *
 * The two things that matter here are a way out and a way back: retrying costs
 * one click, and if it keeps failing there is somewhere else to go.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only thing tying this screen to a server log line, so
    // it goes to the console rather than in front of the shopper.
    console.error("Catalogue page failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-(--container-page) flex-col items-start justify-center gap-6 px-4 py-16 md:px-8">
      <h1 className="text-display">Страницата не се зареди</h1>

      <p className="max-w-[52ch] font-body text-nav text-body-text">
        Възникна временен проблем при зареждането на продуктите. Опитайте
        отново след момент.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="solid" onClick={reset}>
          опитай отново
        </Button>
        <Link href="/" className="font-body text-nav text-primary underline underline-offset-4">
          към началната страница
        </Link>
      </div>

      <p className="font-body text-body text-muted-text">
        Ако проблемът продължава, обадете се на{" "}
        <a href="tel:+359892475402" className="underline underline-offset-4">
          +359 89 247 5402
        </a>{" "}
        или заповядайте в някой от трите магазина.
      </p>
    </div>
  );
}
