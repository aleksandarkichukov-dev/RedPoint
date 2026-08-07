import type { NextConfig } from "next";
import { CATEGORY_REDIRECTS, PRODUCT_REDIRECTS } from "./src/lib/old-urls.generated";

/**
 * The old site's URLs, permanently moved.
 *
 * red-point.bg is ten years old and everything it ranks for points at addresses
 * this site does not have. Without these the launch throws that away, and it is
 * the one part of a migration that cannot be repaired later by working harder.
 *
 * Matched on the numeric id alone — `/product/16370/:rest*` — so no Cyrillic
 * ever appears in a match pattern. The old URLs carry percent-encoded Cyrillic
 * in their later segments, and making that match reliably through a proxy is a
 * fight worth not having. The id belongs to the product rather than to the
 * colour, so one rule catches every colour variant, including the ones the
 * scraper never visited.
 *
 * Regenerate with `medusa exec ./src/scripts/build-redirects.ts` after the
 * catalogue changes shape.
 */
function oldUrlRedirects() {
  return [
    ...PRODUCT_REDIRECTS.map((rule) => ({
      source: `/product/${rule.id}/:rest*`,
      destination: rule.to,
      /* 301 rather than `permanent: true`, which Next answers with 308.
         Google treats the two the same, but 308 is younger than this domain
         and the assorted directories, price comparators and forums that link
         to it are not all modern. 301 is understood by everything, and these
         are GET pages where 308's one advantage — preserving the method —
         buys nothing. */
      statusCode: 301,
    })),
    ...CATEGORY_REDIRECTS.map((rule) => ({
      source: `/category/${rule.id}/:rest*`,
      destination: rule.to,
      /* 301 rather than `permanent: true`, which Next answers with 308.
         Google treats the two the same, but 308 is younger than this domain
         and the assorted directories, price comparators and forums that link
         to it are not all modern. 301 is understood by everything, and these
         are GET pages where 308's one advantage — preserving the method —
         buys nothing. */
      statusCode: 301,
    })),
  ];
}

const nextConfig: NextConfig = {
  async redirects() {
    return oldUrlRedirects();
  },
  reactStrictMode: true,
  /* `next dev` and `next build` share `.next` and overwrite each other, which
     on this machine showed up as a production server answering 500 on every
     route while the dev server was running. Setting NEXT_DIST_DIR lets a
     production build sit beside a running dev server — used for the VPS
     sizing measurement, and for anything else that needs both at once. */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The design-system package ships raw CSS from the workspace.
  transpilePackages: ["@redpoint/design-system"],
  images: {
    remotePatterns: [
      // Product photography, served by Medusa's local file provider. On the VPS
      // this becomes the real host or an object-storage domain.
      { protocol: "http", hostname: "localhost", port: "9000" },
      // Placeholder photography for the design-system gallery and the editorial
      // parts of the home page that have no product behind them.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
