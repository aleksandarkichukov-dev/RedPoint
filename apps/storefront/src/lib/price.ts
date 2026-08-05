/**
 * Re-exported from the shared package.
 *
 * The peg and the rounding rule moved to `@redpoint/catalog` when the backend
 * started rendering order emails that quote both currencies. This file stays
 * so every `@/lib/price` import across the storefront keeps working, and so
 * there is still one obvious place to look for the conversion.
 */
export {
  EUR_TO_BGN,
  eurToBgn,
  formatEur,
  formatBgn,
  discountPercent,
} from "@redpoint/catalog";
