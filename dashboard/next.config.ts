import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /active and /history were merged into /portfolio (one row per position,
  // open and closed together). Kept as permanent redirects so old links and
  // bookmarks still land somewhere useful — query strings are passed through,
  // so /history?symbol=FPT keeps its filter.
  async redirects() {
    return [
      { source: "/active", destination: "/portfolio", permanent: true },
      { source: "/history", destination: "/portfolio", permanent: true },
    ];
  },
};

export default nextConfig;
