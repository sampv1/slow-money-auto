import { revalidateTag } from "next/cache";
import { supabaseAdmin, adminUnavailable } from "@/lib/supabase-admin";
import { TAG_REC } from "@/lib/cached-data";
import { todayVn } from "@/lib/format";
import { getUserRole } from "@/lib/supabase-server";

/**
 * PATCH — write the two editable halves of a position's Trading Journal.
 *
 * The buy thesis is NOT accepted here, by design. It lives in `note`, is fixed
 * at entry, and an endpoint that could rewrite it would defeat the only reason
 * the journal is worth keeping: that the entry reasoning cannot be edited once
 * the outcome is known. Sending `note` is ignored rather than rejected — there
 * is nothing for a caller to correct, the field simply is not writable here.
 *
 * Admin-only and service-role, like every other write in the app: the page
 * itself is anonymous-readable, so the gate is what stops a visitor from
 * PATCHing someone else's journal straight through the route.
 */

interface JournalInput {
  id?: string;
  sell_thesis?: string | null;
  lesson_learned?: string | null;
}

/** Trim to null. An empty textarea means "erase this", not "store a blank". */
function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

export async function PATCH(request: Request) {
  try {
    const role = await getUserRole();
    if (role !== "admin") {
      return Response.json({ error: "Unauthorized — admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as JournalInput;
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const admin = supabaseAdmin();
    if (!admin) return adminUnavailable();

    // Read the row first: the dates below depend on what is already stored, and
    // a PATCH against a missing id must 404 rather than silently affect nothing
    // (PostgREST answers an update matching no rows with 204, not an error).
    const { data: rec, error: readErr } = await admin
      .from("recommendations")
      .select("id, closed_at, sell_thesis, sell_thesis_at, lesson_learned, lesson_learned_at")
      .eq("id", id)
      .maybeSingle();
    if (readErr) {
      return Response.json({ error: readErr.message }, { status: 500 });
    }
    if (!rec) return Response.json({ error: "Recommendation not found" }, { status: 404 });

    const today = todayVn();
    const updates: Record<string, string | null> = {};

    // Only touch a field the caller actually sent, so saving one half cannot
    // blank the other.
    if ("sell_thesis" in body) {
      const v = text(body.sell_thesis);
      updates.sell_thesis = v;
      // The date tracks the TEXT, not the exit. Cleared with the text; seeded
      // from closed_at on first write because that is the honest date for a
      // thesis about an exit that already happened; otherwise today.
      updates.sell_thesis_at =
        v === null ? null : (rec.sell_thesis_at as string | null) ?? (rec.closed_at as string | null) ?? today;
    }
    if ("lesson_learned" in body) {
      const v = text(body.lesson_learned);
      updates.lesson_learned = v;
      // No closed_at fallback: a lesson is written when it is understood, which
      // is by definition after the outcome, so today is the only honest date.
      updates.lesson_learned_at =
        v === null ? null : (rec.lesson_learned_at as string | null) ?? today;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("recommendations")
      .update(updates)
      .eq("id", id)
      .select("id, sell_thesis, sell_thesis_at, lesson_learned, lesson_learned_at");

    if (error) {
      // The most likely cause by far is migration 049 not being applied yet.
      const missing = /column .* does not exist/i.test(error.message);
      return Response.json(
        { error: missing ? "Trading Journal needs migration 049" : error.message },
        { status: missing ? 501 : 500 },
      );
    }
    // Zero rows from a write that matched a row on read means the write was
    // refused, which with the service role should be impossible — surface it
    // rather than reporting success.
    if (!data || data.length === 0) {
      return Response.json({ error: "Update affected no rows" }, { status: 500 });
    }

    // The Portfolio page reads through the rec-data cache; without this the
    // journal would show the old text until the TTL expired.
    // `{ expire: 0 }` is required in Next 16 and is what every other write route
    // here passes — without it the entry is refreshed in the background and the
    // next read can still serve the pre-save text.
    revalidateTag(TAG_REC, { expire: 0 });

    return Response.json({ ok: true, recommendation: data[0] });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
