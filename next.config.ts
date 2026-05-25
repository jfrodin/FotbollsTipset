import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { hostname: "media.api-sports.io" },
      { hostname: "media-4.api-sports.io" },
    ],
  },
};

export default nextConfig;
