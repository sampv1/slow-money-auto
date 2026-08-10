import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ALL_TAGS } from "@/lib/cached-data";

export const runtime = "nodejs"; // timingSafeEqual is not in the edge runtime

// On-demand cache invalidation, called by the data pipelines (GitHub Actions)
// as their final step after writing to Supabase:
//
//   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
//        "https://<host>/api/revalidate?tags=ta-data,macro-data"
//
// `tags` is optional (defaults to all). Requires REVALIDATE_SECRET to be set in
// the deployment environment; without it the endpoint always rejects.
//
// THE SECRET GOES IN A HEADER, NEVER THE QUERY STRING. It used to be
// `?secret=…`, which leaks it into Vercel's request logs, any intermediate
// proxy's logs, and browser history — none of which are places a shared
// credential should end up. Query-string auth is refused outright rather than
// accepted-and-deprecated: leaving the old path working would keep writing the
// secret to logs, which is the whole problem.

function authorized(req: NextRequest): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) return false;

  const provided = req.headers.get("x-revalidate-secret");
  if (!provided) return false;

  // Constant-time compare so response latency can't be used to recover the
  // secret byte by byte. timingSafeEqual throws on a length mismatch, so the
  // lengths are checked first — that leaks only the length, not the content.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
  }

  const tagsParam = req.nextUrl.searchParams.get("tags");
  const requested = tagsParam ? tagsParam.split(",").map((s) => s.trim()) : ALL_TAGS;
  const applied = requested.filter((t) => ALL_TAGS.includes(t));

  // expire: 0 → entries are expired immediately, so the very next page view
  // blocks on fresh data (what "reload after the pipeline ran" should show)
  // instead of serving one more stale response.
  for (const tag of applied) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ ok: true, revalidated: applied, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// GET is still supported for a manual refresh, but it needs the same header —
// so it is a curl one-liner, not something you can trigger from the URL bar.
export async function GET(req: NextRequest) {
  return handle(req);
}
