/**
 * Shared catalogue domain: the category tree of the old site and the shape of
 * `seed/products.json`.
 *
 * Both the scraper (which writes that file) and the Medusa seed (which reads
 * it) depend on this, so it lives in one place. Duplicating either would let
 * the two drift, and the failure mode is a silently mis-seeded catalogue.
 */
export * from "./categories";
export * from "./colors";
export * from "./schema";
