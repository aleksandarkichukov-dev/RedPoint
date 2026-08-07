import type { NextConfig } from "next";
import { join } from "node:path";
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

/**
 * The shop's own domain, as an image host.
 *
 * Product photography is served by Medusa from /static on this same domain, so
 * whatever SITE_URL says is where the pictures come from. Empty when SITE_URL
 * is unset, which is the development case that the localhost entry covers.
 */
function siteImageHost() {
  const url = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) return [];

  try {
    const { protocol, hostname, port } = new URL(url);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        ...(port ? { port } : {}),
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  /* A self-contained server plus only the files it actually imports, instead of
     the whole workspace and its node_modules. The runtime image drops from
     something over a gigabyte to a couple of hundred megabytes, which matters
     on a 60 GB disk shared with product photography and database backups.

     `outputFileTracingRoot` is required in a pnpm workspace: without it Next
     traces from apps/storefront and misses the hoisted node_modules at the
     repo root, producing an image that builds cleanly and then cannot start. */
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../.."),

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
    /* Next refuses to optimise an image from a host that is not listed here,
       with a bare 400 and nothing in any log that names the host. On the first
       deploy every product photograph came back 400 while the same file served
       fine from /static — because the list said localhost:9000 and the shop had
       moved to redpointbg.com.

       So the site's own host is derived rather than written down. It follows
       SITE_URL, which is the same variable the sitemap and the canonical tags
       use, and cannot fall out of step with the domain the shop is on. */
    remotePatterns: [
      ...siteImageHost(),
      // The local file provider during development.
      { protocol: "http" as const, hostname: "localhost", port: "9000" },
      // Placeholder photography for the design-system gallery and the editorial
      // parts of the home page that have no product behind them.
      { protocol: "https" as const, hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
