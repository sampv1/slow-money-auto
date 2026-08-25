import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin, adminUnavailable } from "@/lib/supabase-admin";
import { TAG_BUSINESS } from "@/lib/cached-data";
import { getUserAndRole } from "@/lib/supabase-server";

/**
 * Read and write one symbol's Business Analysis note (migration 053).
 *
 * ADMIN ONLY, both verbs. GET is gated too even though the content itself is
 * public on the Analysis page: this route is the EDITOR's view, and it answers
 * for a symbol that has no note yet — which is exactly how you would enumerate
 * what the desk has and has not covered. That is not something to hand out.
 *
 * The write goes through the service-role client because migration 045 left
 * anon read-only; a denied PostgREST write answers 204 with zero rows affected,
 * so a route using the anon client here would report success and save nothing.
 */
export const runtime = "nodejs";
export const revalidate = 0;

// The same shape the chart API and the scanner's symbol box enforce.
const SYMBOL_RE = /^[A-Z0-9]{2,10}$/;

// A generous ceiling rather than none. This is prose an admin pastes, so the
// limit exists to stop an accidental paste of something enormous reaching the
// database, not to shape what can be written — a long note is a few thousand
// characters.
const MAX_CONTENT = 100_000;

function symbolFrom(request: Request): string | null {
  const raw = (new URL(request.url).searchParams.get("symbol") ?? "").toUpperCase().trim();
  return SYMBOL_RE.test(raw) ? raw : null;
}

/**
 * With `?symbol=`, one note. WITHOUT it, the index: every symbol that has one,
 * newest first.
 *
 * The index is what makes editing a posted note possible at all. Without it the
 * editor could only reach a note whose ticker the admin already remembered,
 * which is not a way to find something you wrote weeks ago — and there is no
 * other surface anywhere that lists what has been written.
 */
export async function GET(request: Request) {
  const { role } = await getUserAndRole();
  if (role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("symbol");
  if (raw === null) {
    // No content column: the index is a picker, and the notes are long enough
    // that shipping all of them to render a list of tickers would be silly.
    const { data, error } = await supabase
      .from("business_analysis")
      .select("symbol,updated_at")
      .order("updated_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ items: data ?? [] });
  }

  const symbol = symbolFrom(request);
  if (!symbol) return Response.json({ error: "invalid symbol" }, { status: 400 });

  // Read through the anon client: this is a SELECT and RLS already allows it.
  // The service-role key is for writes only — reaching for it here would widen
  // where a full-access credential is used, for no gain.
  const { data, error } = await supabase
    .from("business_analysis")
    .select("content,updated_at")
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    symbol,
    content: data?.content ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole();
  if (role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = symbolFrom(request);
  if (!symbol) return Response.json({ error: "invalid symbol" }, { status: 400 });

  const admin = supabaseAdmin();
  if (!admin) return adminUnavailable();

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content must be a string" }, { status: 400 });
  }
  const content = body.content.trim();
  if (content.length > MAX_CONTENT) {
    return Response.json(
      { error: `content is ${content.length} characters, over the ${MAX_CONTENT} limit` },
      { status: 413 },
    );
  }

  // Empty content DELETES rather than storing "". The page shows the block only
  // when there is something to show, so a blank row and no row would render
  // identically — and keeping the blank one would leave a symbol that reads as
  // covered when it is not.
  if (content === "") {
    const { error } = await admin.from("business_analysis").delete().eq("symbol", symbol);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    revalidateTag(TAG_BUSINESS, { expire: 0 });
    return Response.json({ symbol, saved: false, deleted: true });
  }

  const { data, error } = await admin
    .from("business_analysis")
    .upsert(
      { symbol, content, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
      { onConflict: "symbol" },
    )
    .select("updated_at")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Without this the Analysis page would serve the previous note for up to the
  // cache TTL — an hour of an admin looking at a save that appears not to have
  // happened.
  revalidateTag(TAG_BUSINESS, { expire: 0 });
  return Response.json({ symbol, saved: true, updated_at: data?.updated_at ?? null });
}

/**
 * Remove a note outright.
 *
 * POSTing an empty body already deletes, and still does — but that is a side
 * effect of "there is nothing to show", not something an admin would find. A
 * verb that says what it does is what makes removal a feature rather than a
 * trick, and it is the one action here that cannot be undone: the table keeps
 * no history, so the UI asks twice before calling this.
 */
export async function DELETE(request: Request) {
  const { role } = await getUserAndRole();
  if (role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = symbolFrom(request);
  if (!symbol) return Response.json({ error: "invalid symbol" }, { status: 400 });

  const admin = supabaseAdmin();
  if (!admin) return adminUnavailable();

  // `select()` so the count is real. A delete that matched nothing returns 204
  // with no rows, which would otherwise report as a successful removal of a
  // note that was never there — and the admin would have no way to tell.
  const { data, error } = await admin
    .from("business_analysis")
    .delete()
    .eq("symbol", symbol)
    .select("symbol");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  revalidateTag(TAG_BUSINESS, { expire: 0 });
  return Response.json({ symbol, deleted: (data ?? []).length > 0 });
}
