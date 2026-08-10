/**
 * Minimal fixed-window rate limiter, in process memory.
 *
 * HONEST ABOUT WHAT THIS IS: serverless functions scale horizontally and each
 * instance keeps its own counter, so the real ceiling is roughly
 * `limit × active instances`, and it resets whenever an instance is recycled.
 * It is a spam speed-bump, not a security control.
 *
 * That is still worth having for /api/feedback — the one endpoint an anonymous
 * caller can write through. Migration 045 removed the anon INSERT policy that
 * previously let people bypass this route entirely, so this is now the single
 * chokepoint, which is exactly what makes limiting it meaningful.
 *
 * If real enforcement is ever needed (distributed and durable), the shape to
 * move to is a Postgres or Upstash counter keyed the same way; keep this
 * signature so call sites don't change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of unique keys can't grow it without limit — the
// limiter itself must not become the memory-exhaustion vector.
const MAX_KEYS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets — surfaced as Retry-After. */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      // Cheap eviction: drop everything already expired; if that frees nothing,
      // clear outright. Correctness here is "don't grow forever", not precision.
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort client identity. On Vercel, x-forwarded-for is set by the proxy
 * and its FIRST entry is the real client; later entries are appended hops. A
 * client-supplied header can still lie, which is another reason this is a
 * speed-bump rather than a control.
 */
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
