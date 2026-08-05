"use client";

import { Minus, Plus, Trash } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeLineAction, setQuantityAction } from "@/lib/cart-actions";
import type { CartLine } from "@/lib/cart";
import { formatBgn, formatEur } from "@/lib/price";

/**
 * The editable half of the basket.
 *
 * Quantity changes go through server actions and the page re-renders from the
 * server, so the totals a shopper reads are always the ones Medusa calculated
 * rather than arithmetic done twice in two places.
 */
export function CartLines({ lines }: { lines: CartLine[] }) {
  const [pendingLine, setPendingLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const run = (lineId: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    setPendingLine(lineId);
    setError(null);
    startTransition(async () => {
      const result = await action();
      setPendingLine(null);
      if (!result.ok) {
        setError(result.error ?? "Нещо се обърка.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col">
      {error && (
        <p role="alert" className="mb-4 font-body text-nav font-semibold text-primary">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {lines.map((line) => {
          const busy = pendingLine === line.id;
          return (
            <li
              key={line.id}
              className={`flex gap-4 py-5 transition-opacity duration-(--duration-fast) ${
                busy ? "opacity-50" : ""
              }`}
            >
              <div className="relative aspect-[502/616] w-24 shrink-0 overflow-hidden bg-neutral">
                {line.thumbnail && (
                  <Image
                    src={line.thumbnail}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-body text-nav font-normal text-primary uppercase">
                      {line.productHandle ? (
                        <Link href={`/p/${line.productHandle}`} className="hover:underline">
                          {line.title}
                        </Link>
                      ) : (
                        line.title
                      )}
                    </h2>
                    {line.variantTitle && (
                      <p className="font-body text-body text-muted-text">{line.variantTitle}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label={`Премахни ${line.title}`}
                    disabled={busy}
                    onClick={() => run(line.id, () => removeLineAction(line.id))}
                    className="grid size-9 shrink-0 place-items-center text-muted-text transition-colors duration-(--duration-fast) hover:text-primary"
                  >
                    <Trash size={18} aria-hidden />
                  </button>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                  {/* Square steppers, no rounded pill. The count between them is
                      the live value, so it never disagrees with the total. */}
                  <div className="flex items-center border border-border">
                    <button
                      type="button"
                      aria-label="Намали количеството"
                      disabled={busy}
                      onClick={() =>
                        run(line.id, () => setQuantityAction(line.id, line.quantity - 1))
                      }
                      className="grid size-10 place-items-center transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <Minus size={14} aria-hidden />
                    </button>
                    <span
                      aria-live="polite"
                      className="grid min-w-10 place-items-center font-body text-nav tabular-nums"
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Увеличи количеството"
                      disabled={busy}
                      onClick={() =>
                        run(line.id, () => setQuantityAction(line.id, line.quantity + 1))
                      }
                      className="grid size-10 place-items-center transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <Plus size={14} aria-hidden />
                    </button>
                  </div>

                  <p className="flex items-baseline gap-2">
                    <span className="font-body text-price text-body-text">
                      {formatEur(line.total)}
                    </span>
                    <span className="font-body text-body text-muted-text">
                      ({formatBgn(line.total)})
                    </span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
