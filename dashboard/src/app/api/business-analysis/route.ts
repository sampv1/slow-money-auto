import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin, adminUnavailable } from "@/lib/supabase-admin";
import { TAG_BUSINESS } from "@/lib/cached-data";
import { canWriteBusinessAnalysis, getUserAndRole } from "@/lib/supabase-server";

/**
 * Read and write the desk's Business Analysis reports (migrations 053, 058).
 *
 * A SYMBOL HOLDS MANY REPORTS AND `id` IS THE KEY. Every write names the report
 * it means: POST without an `id` creates one, POST with an `id` revises that
 * one, DELETE takes an `id` and nothing else. Keying a write on the SYMBOL —
 * which is what this route did before 058 — would now mean "do this to whatever
 * that company has", i.e. an upsert that silently replaced the wrong quarter
 * and a delete that took the whole archive with it.
 *
 * ADMIN OR ANALYST, every verb — the analyst role (migration 054) exists for
 * exactly this and carries nothing else. GET is gated too even though the
 * content itself is public on the Analysis page: this route is the EDITOR's
 * view, and it answers for a symbol that has no report yet — which is exactly
 * how you would enumerate what the desk has and has not covered. That is not
 * something to hand out.
 *
 * The write goes through the service-role client because migration 045 left
 * anon read-only; a denied PostgREST write answers 204 with zero rows affected,
 * so a route using the anon client here would report success and save nothing.
 */
export const runtime = "nodejs";
export const revalidate = 0;

// The same shape the chart API and the scanner's symbol box enforce.
const SYMBOL_RE = /^[A-Z0-9]{2,10}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A generous ceiling rather than none. This is prose an admin pastes, so the
// limit exists to stop an accidental paste of something enormous reaching the
// database, not to shape what can be written — a long report is a few tens of
// thousands of characters.
const MAX_CONTENT = 100_000;
// The header is one line, shown whole in the collapsed list. The longest of the
// 57 headlines migration 058 lifted out of the existing notes is 150
// characters, so this is roughly double the observed worst case — wide enough
// never to truncate real work, narrow enough that the body cannot be pasted
// into the wrong box unnoticed.
const MAX_TITLE = 300;


function symbolFrom(request: Request): string | null {
  const raw = (new URL(request.url).searchParams.get("symbol") ?? "").toUpperCase().trim();
  return SYMBOL_RE.test(raw) ? raw : null;
}

function idFrom(request: Request): string | null {
  const raw = (new URL(request.url).searchParams.get("id") ?? "").trim();
  return UUID_RE.test(raw) ? raw : null;
}

// The editor's list columns. `content` is deliberately absent: the index exists
// to pick a report, the reports run to tens of thousands of characters each,
// and shipping all of them to draw a list of headlines would be silly.
const LIST_COLUMNS = "id,symbol,title,created_at,updated_at";

/**
 * With `?symbol=`, that company's reports, newest first, WITH their text.
 * WITHOUT it, the index: every report on the site, headers only.
 *
 * The index is what makes editing a posted report possible at all. Without it
 * the editor could only reach a report whose ticker the analyst already
 * remembered, which is not a way to find something you wrote weeks ago — and
 * there is no other surface anywhere that lists what has been written.
 */
export async function GET(request: Request) {
  const { role } = await getUserAndRole();
  if (!canWriteBusinessAnalysis(role)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Read through the anon client throughout: these are SELECTs and RLS already
  // allows them. The service-role key is for writes only — reaching for it here
  // would widen where a full-access credential is used, for no gain.
  const raw = new URL(request.url).searchParams.get("symbol");
  if (raw === null) {
    const { data, error } = await supabase
      .from("business_analysis")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ items: data ?? [] });
  }

  const symbol = symbolFrom(request);
  if (!symbol) return Response.json({ error: "invalid symbol" }, { status: 400 });

  // Same ordering as the Analysis page's own read, so the editor's list and the
  // published page can never disagree about which report is the latest.
  const { data, error } = await supabase
    .from("business_analysis")
    .select("id,title,content,created_at,updated_at")
    .eq("symbol", symbol)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ symbol, reports: data ?? [] });
}

/**
 * Create a report (no `id`) or revise one (`?id=`).
 *
 * `symbol` comes from the query on both paths, so revising a report can also
 * MOVE it — which is the fix for the one mistake this editor can make that
 * cannot be undone from the UI, filing a report under the wrong ticker.
 */
export async function POST(request: Request) {
  const { user, role } = await getUserAndRole();
  if (!canWriteBusinessAnalysis(role)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = symbolFrom(request);
  if (!symbol) return Response.json({ error: "invalid symbol" }, { status: 400 });

  const rawId = new URL(request.url).searchParams.get("id");
  const id = rawId === null ? null : idFrom(request);
  if (rawId !== null && !id) return Response.json({ error: "invalid id" }, { status: 400 });

  const admin = supabaseAdmin();
  if (!admin) return adminUnavailable();

  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.content !== "string" || typeof body.title !== "string") {
    return Response.json({ error: "title and content must be strings" }, { status: 400 });
  }
  const title = body.title.trim();
  const content = body.content.trim();
  if (title.length > MAX_TITLE) {
    return Response.json(
      { error: `header is ${title.length} characters, over the ${MAX_TITLE} limit` },
      { status: 413 },
    );
  }
  if (content.length > MAX_CONTENT) {
    return Response.json(
      { error: `content is ${content.length} characters, over the ${MAX_CONTENT} limit` },
      { status: 413 },
    );
  }

  // Emptying the body still DELETES, but only for a report that already exists.
  // Before 058 that rule was unambiguous — a symbol had one note, and a blank
  // row and no row rendered identically. It is not unambiguous now: "save an
  // empty box" against a symbol holding four reports names none of them, so it
  // is refused rather than guessed at.
  if (content === "") {
    if (!id) return Response.json({ error: "nothing to save" }, { status: 400 });
    const { data, error } = await admin
      .from("business_analysis")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    revalidateTag(TAG_BUSINESS, { expire: 0 });
    return Response.json({ symbol, saved: false, deleted: (data ?? []).length > 0 });
  }

  // A report with no header would be an unidentifiable row in the collapsed
  // list — the one thing on that list a reader cannot skip past informed.
  if (title === "") return Response.json({ error: "header is required" }, { status: 400 });

  const now = new Date().toISOString();
  const row = { symbol, title, content, updated_at: now, updated_by: user?.id ?? null };

  // Insert and update, not upsert. An upsert keyed on `id` would happily CREATE
  // a report at a client-supplied id when the update matched nothing — which is
  // how a stale editor tab resurrects a report someone else just deleted.
  const query = id
    ? admin.from("business_analysis").update(row).eq("id", id)
    : admin.from("business_analysis").insert({ ...row, created_at: now });

  const { data, error } = await query.select("id,created_at,updated_at").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) {
    // An update that matched nothing. The report was deleted while this editor
    // had it open; saying so is the only way the author learns their text is
    // now unattached to anything.
    return Response.json({ error: "that report no longer exists" }, { status: 404 });
  }

  // Without this the Analysis page would serve the previous text for up to the
  // cache TTL — an hour of an analyst looking at a save that appears not to
  // have happened.
  revalidateTag(TAG_BUSINESS, { expire: 0 });
  return Response.json({
    symbol,
    saved: true,
    id: data.id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}

/**
 * Remove one report, BY ID.
 *
 * POSTing an empty body already deletes, and still does — but that is a side
 * effect of "there is nothing to show", not something an analyst would find. A
 * verb that says what it does is what makes removal a feature rather than a
 * trick, and it is the one action here that cannot be undone: the table keeps
 * no history, so the UI asks twice before calling this.
 *
 * There is deliberately no `?symbol=` form. It would read as "delete this
 * company's report" and do something else entirely now that a company has
 * several — the archive would go with the one the author meant.
 */
export async function DELETE(request: Request) {
  const { role } = await getUserAndRole();
  if (!canWriteBusinessAnalysis(role)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = idFrom(request);
  if (!id) return Response.json({ error: "invalid id" }, { status: 400 });

  const admin = supabaseAdmin();
  if (!admin) return adminUnavailable();

  // `select()` so the count is real. A delete that matched nothing returns 204
  // with no rows, which would otherwise report as a successful removal of a
  // report that was never there — and the analyst would have no way to tell.
  const { data, error } = await admin
    .from("business_analysis")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  revalidateTag(TAG_BUSINESS, { expire: 0 });
  return Response.json({ id, deleted: (data ?? []).length > 0 });
}
