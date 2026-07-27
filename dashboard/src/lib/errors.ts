/**
 * Compact, safe descriptions of data-load failures.
 *
 * When the Supabase project is unhealthy, the Cloudflare edge in front of it
 * answers with a full HTML error page instead of JSON. supabase-js can't parse
 * that, so it hands the ENTIRE document back as `error.message` — and every
 * page that rendered `{e.message}` verbatim painted ~4 KB of raw markup across
 * the screen (seen live during a 522 on 2026-07-27, where /scanner showed the
 * whole Cloudflare "Connection timed out" document in red).
 *
 * Anything HTML-shaped is therefore collapsed to its <title>, which is the one
 * genuinely useful line ("supabase.co | 522: Connection timed out"), and every
 * message is flattened to one line and length-capped.
 */

const MAX_DETAIL = 160;

export function dataErrorDetail(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "")).trim();
  // head:true count queries have no body to parse, so supabase-js reports the
  // failure with an empty message — say something truthful rather than nothing.
  if (!raw) return "no response from data source";

  // An HTML document (Cloudflare 5xx page, a proxy's error page, an HTML 404).
  if (/^<(?:!doctype|html\b)/i.test(raw) || /<html[\s>]/i.test(raw)) {
    const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const cleaned = title?.replace(/\s+/g, " ").trim();
    return cleaned ? cleaned : "upstream returned an HTML error page";
  }

  const oneLine = raw.replace(/\s+/g, " ");
  return oneLine.length > MAX_DETAIL ? `${oneLine.slice(0, MAX_DETAIL)}…` : oneLine;
}
