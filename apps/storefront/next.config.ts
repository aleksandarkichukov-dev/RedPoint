import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
