import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ALL_TAGS } from "@/lib/cached-data";

// On-demand cache invalidation, called by the data pipelines (GitHub Actions)
// as their final step after writing to Supabase:
//
//   curl -X POST "https://<host>/api/revalidate?secret=***&tags=ta-data,macro-data"
//
// `tags` is optional (defaults to all). Requires REVALIDATE_SECRET to be set
// in the deployment environment; without it the endpoint always rejects.

function handle(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
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

// GET supported too, so a browser/curl one-liner works for manual refreshes.
export async function GET(req: NextRequest) {
  return handle(req);
}
