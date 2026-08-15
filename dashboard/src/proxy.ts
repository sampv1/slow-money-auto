import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy that (1) refreshes the Supabase auth session on every request so expired
 * tokens are renewed before pages render, and (2) sets a per-request Content
 * Security Policy with a fresh nonce.
 *
 * The CSP lives here rather than in next.config.ts because a nonce must be
 * unique per request — a static header cannot carry one. Next stamps the nonce
 * onto its own inline bootstrap scripts by reading it back off the REQUEST
 * headers, which is why the policy is set on both the request and the response.
 * (Per node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.)
 * The static, request-independent headers stay in next.config.ts.
 */

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  // Supabase REST/auth over https, realtime over wss.
  const supabase = SUPABASE_ORIGIN
    ? `${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace(/^https:/, "wss:")}`
    : "https://*.supabase.co wss://*.supabase.co";

  return [
    `default-src 'self'`,
    // Nonce covers Next's inline bootstrap; the googletagmanager host covers GA.
    // Deliberately NOT 'strict-dynamic': it makes browsers IGNORE host
    // allowlists, which would block the GA tag (loaded by @next/third-parties,
    // which does not thread our nonce through). 'unsafe-eval' is dev-only —
    // React uses eval there to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' is required and cannot be nonce'd away: a nonce applies to
    // <style> elements, NOT to style attributes, and 12 components render React
    // `style={{…}}` props (every macro chart, which positions elements from
    // computed data). Low risk — style injection needs an HTML sink, and this
    // app has none (no dangerouslySetInnerHTML anywhere).
    `style-src 'self' 'unsafe-inline'`,
    // The last host serves company logos on the Analysis page (symbol_profile
    // .logo_url, migration 050). Named EXACTLY rather than as an
    // `https://*.amazonaws.com` wildcard, which would allow every S3 bucket on
    // the internet. Widening img-src is the mildest of the CSP relaxations — an
    // image cannot execute — and the alternative, proxying each logo through our
    // own origin to keep `img-src 'self'`, costs a function invocation per view
    // for a 36px icon.
    `img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://vietcap-website.s3.ap-southeast-1.amazonaws.com`,
    `font-src 'self' data:`,
    // The browser talks to Supabase directly from two client components
    // (signal-pro-client, trade-actions), so 'self' alone would break them.
    `connect-src 'self' ${supabase} https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Clickjacking: this is the modern control, X-Frame-Options in
    // next.config.ts is the fallback for older browsers.
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Rebuilt on each call rather than captured once: Supabase's setAll mutates
  // request.cookies, and the forwarded headers must carry those updates.
  const forwardedHeaders = () => {
    const h = new Headers(request.headers);
    h.set("x-nonce", nonce);
    h.set("Content-Security-Policy", csp);
    return h;
  };

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Recreate response with updated request cookies
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } });
          // Set cookies on the response (for the browser)
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh session (this triggers setAll if tokens need updating)
  await supabase.auth.getUser();

  supabaseResponse.headers.set("Content-Security-Policy", csp);
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
