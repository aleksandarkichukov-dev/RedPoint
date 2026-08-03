/**
 * EUR is the store currency. BGN is never stored, only derived at render time
 * from the fixed peg, so the two can never drift out of sync.
 */
export const EUR_TO_BGN = 1.95583;

/** Converts and rounds UP to the nearest stotinka, so the shown BGN price is
 *  never lower than the EUR price actually charged. */
export function eurToBgn(eur: number): number {
  return Math.ceil(eur * EUR_TO_BGN * 100) / 100;
}

const eurFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const bgnFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "BGN",
  minimumFractionDigits: 2,
});

export function formatEur(eur: number): string {
  return eurFormatter.format(eur);
}

export function formatBgn(eur: number): string {
  return bgnFormatter.format(eurToBgn(eur));
}

/** Discount as a whole negative percentage, e.g. -30. Returns null when there
 *  is no genuine reduction, so callers cannot render a 0% sale badge. */
export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return -Math.round(((compareAt - price) / compareAt) * 100);
}
