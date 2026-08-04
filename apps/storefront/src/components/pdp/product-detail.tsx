"use client";

import { X } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { cn } from "@/lib/cn";
import { discountPercent, formatBgn, formatEur } from "@/lib/price";

export interface PdpColor {
  name: string;
  images: string[];
  sizes: { label: string; inStock: boolean; variantId: string }[];
}

export interface ProductDetailProps {
  title: string;
  articleNo: string | null;
  price: number;
  compareAtPrice?: number;
  material: string | null;
  description: string | null;
  colors: PdpColor[];
  sizeChart: { size: string; a_cm: number | null; b_cm: number | null }[];
}

/**
 * The interactive half of a product page.
 *
 * Colour and size are local state rather than URL state: they are a choice
 * inside one product, not a different page, and putting them in the address bar
 * would fill the back button with steps the shopper never thought of as
 * navigation.
 */
export function ProductDetail({
  title,
  articleNo,
  price,
  compareAtPrice,
  material,
  description,
  colors,
  sizeChart,
}: ProductDetailProps) {
  const [colorIndex, setColorIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const errorId = useId();

  const color = colors[colorIndex] ?? colors[0];
  const discount = discountPercent(price, compareAtPrice);

  useEffect(() => {
    if (!chartOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChartOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [chartOpen]);

  if (!color) return null;

  const everySizeGone = color.sizes.every((entry) => !entry.inStock);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
      {/* Gallery. Stacked on mobile, a column on desktop that scrolls past the
          sticky details rather than the other way round: the photographs are
          what a shopper came to look at. */}
      <div className="flex flex-col gap-2">
        {color.images.map((src, index) => (
          <div key={src} className="relative aspect-[502/616] overflow-hidden bg-neutral">
            <Image
              src={src}
              alt={index === 0 ? `${title}, ${color.name}` : ""}
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority={index === 0}
              className="object-cover"
            />
            {index === 0 && discount !== null && (
              <Badge variant="sale" className="absolute top-0 left-0">
                {discount}%
              </Badge>
            )}
          </div>
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-6">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-display">{title}</h1>
              {articleNo && (
                <p className="font-body text-body text-muted-text">
                  Артикул {articleNo}
                </p>
              )}
            </div>
            <WishlistButton productName={title} className="-mr-2 shrink-0" />
          </header>

          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-body text-[1.375rem] font-bold text-body-text">
              {formatEur(price)}
            </span>
            <span className="font-body text-nav text-muted-text">
              ({formatBgn(price)})
            </span>
            {compareAtPrice && discount !== null && (
              <span className="font-body text-nav font-semibold text-muted-text line-through">
                {formatEur(compareAtPrice)}
              </span>
            )}
          </p>

          {colors.length > 1 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="font-body text-nav text-primary">
                Цвят: <span className="text-muted-text">{color.name}</span>
              </legend>
              <ul className="flex flex-wrap items-center gap-3">
                {colors.map((entry, index) => (
                  <li key={entry.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setColorIndex(index);
                        setSize(null);
                      }}
                      aria-pressed={index === colorIndex}
                      aria-label={entry.name}
                      className={cn(
                        "relative block size-14 overflow-hidden bg-neutral",
                        "outline-offset-2 transition-[outline-color] duration-(--duration-fast)",
                        index === colorIndex ? "outline-2 outline-primary" : "outline-transparent",
                      )}
                    >
                      {entry.images[0] && (
                        <Image src={entry.images[0]} alt="" fill sizes="56px" className="object-cover" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <legend className="font-body text-nav text-primary">Размер</legend>
              {sizeChart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setChartOpen(true)}
                  className="font-body text-nav lowercase text-primary underline underline-offset-4"
                >
                  виж таблицата с размери
                </button>
              )}
            </div>

            <ul className="flex flex-wrap gap-2">
              {color.sizes.map((entry) => (
                <li key={entry.label}>
                  <button
                    type="button"
                    disabled={!entry.inStock}
                    aria-pressed={size === entry.label}
                    onClick={() => {
                      setSize(entry.label);
                      setSizeError(false);
                    }}
                    className={cn(
                      "relative grid h-11 min-w-14 place-items-center px-3",
                      "rounded-sharp border-2 font-body text-nav transition-colors duration-(--duration-fast)",
                      size === entry.label
                        ? "border-primary bg-primary text-white"
                        : "border-border text-primary hover:border-primary",
                      /* Sold-out sizes stay visible and struck through. Removing
                         them would leave a shopper wondering whether the shop
                         stocks that size at all. */
                      !entry.inStock &&
                        "cursor-not-allowed border-border text-muted-text line-through hover:border-border",
                    )}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>

            {everySizeGone && (
              <p className="font-body text-body text-muted-text">
                Този цвят е изчерпан. Опитайте друг или проверете в магазин.
              </p>
            )}
            {sizeError && (
              <p id={errorId} role="alert" className="font-body text-body font-semibold text-primary">
                Изберете размер.
              </p>
            )}
          </fieldset>

          <Button
            variant="solid"
            className="w-full"
            disabled={everySizeGone}
            aria-describedby={sizeError ? errorId : undefined}
            onClick={() => {
              if (!size) {
                setSizeError(true);
                return;
              }
              // Cart wiring lands in Phase 5.
            }}
          >
            добави в количката
          </Button>

          <dl className="flex flex-col divide-y divide-border border-y border-border">
            {material && (
              <div className="flex justify-between gap-4 py-3">
                <dt className="font-body text-body text-muted-text">Състав</dt>
                <dd className="font-body text-body text-primary">{material}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-3">
              <dt className="font-body text-body text-muted-text">Доставка</dt>
              <dd className="font-body text-body text-primary">
                Следващ работен ден със Спиди или Еконт
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="font-body text-body text-muted-text">Връщане</dt>
              <dd className="font-body text-body text-primary">До 14 дни</dd>
            </div>
          </dl>

          {description && (
            <p className="max-w-[65ch] font-body text-body text-body-text">{description}</p>
          )}
        </div>
      </div>

      {chartOpen && (
        <SizeChartDialog rows={sizeChart} onClose={() => setChartOpen(false)} />
      )}
    </div>
  );
}

/**
 * The measurements the shop's own staff took, which is the single most useful
 * thing on the old site and the reason this is a dialog rather than a link to a
 * generic chart.
 */
function SizeChartDialog({
  rows,
  onClose,
}: {
  rows: { size: string; a_cm: number | null; b_cm: number | null }[];
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      {/* Flat fill and a hard edge, never a soft shadow. */}
      <div
        className="max-h-[80dvh] w-full max-w-xl overflow-y-auto bg-background p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId}>Таблица с размери</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори"
            className="grid size-8 shrink-0 place-items-center"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <p className="mt-2 max-w-[52ch] font-body text-body text-muted-text">
          Мерките са снети от служители в магазина за този конкретен артикул, в
          сантиметри.
        </p>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 font-body text-body font-semibold">Размер</th>
              <th className="py-2 font-body text-body font-semibold">Ширина (см)</th>
              <th className="py-2 font-body text-body font-semibold">Дължина (см)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.size} className="border-b border-border">
                <td className="py-2 font-body text-body text-primary">{row.size}</td>
                <td className="py-2 font-body text-body text-body-text">{row.a_cm ?? "-"}</td>
                <td className="py-2 font-body text-body text-body-text">{row.b_cm ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
