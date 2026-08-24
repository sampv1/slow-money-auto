import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /implied-risk became a panel on /macro (?c= is the tab MacroTabs opens on).
  // /active and /history were merged into /portfolio (one row per position,
  // open and closed together). Kept as permanent redirects so old links and
  // bookmarks still land somewhere useful — query strings are passed through,
  // so /history?symbol=FPT keeps its filter.
  async redirects() {
    return [
      { source: "/active", destination: "/portfolio", permanent: true },
      { source: "/history", destination: "/portfolio", permanent: true },
      { source: "/implied-risk", destination: "/macro?c=implied", permanent: true },
    ];
  },

  // Static security headers. The Content-Security-Policy is NOT here — it needs
  // a per-request nonce, so it is set in src/proxy.ts. Everything below is
  // request-independent and cheaper to serve from the config.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Was max-age only. includeSubDomains closes the sibling-subdomain
          // hole; preload makes the very first visit HTTPS too. Two years is the
          // value the preload list requires.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Clickjacking fallback for browsers predating CSP frame-ancestors.
          // The admin pages are the ones worth protecting: framed, they could be
          // clicked through invisibly.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser second-guessing Content-Type — the classic way a
          // user-supplied upload gets reinterpreted as a script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the full URL only same-origin; bare origin cross-origin. Keeps
          // paths like /analysis/<symbol> out of third-party referer logs.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here uses these; deny them rather than inherit the defaults.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // The write/authenticated surface must never be cached by a shared proxy.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
