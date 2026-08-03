import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The design-system package ships raw CSS from the workspace.
  transpilePackages: ["@redpoint/design-system"],
  images: {
    remotePatterns: [
      // Placeholder photography for the design-system gallery only.
      // Remove once Phase 1 has seeded real product images.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
