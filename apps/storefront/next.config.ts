import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
