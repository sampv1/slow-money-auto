import { revalidateTag } from "next/cache";
import { supabaseAdmin, adminUnavailable } from "@/lib/supabase-admin";
import { TAG_FA } from "@/lib/cached-data";
import { getUserRole } from "@/lib/supabase-server";
import { parseWorkbook, type ParseResult } from "@/lib/fa-import";

export const runtime = "nodejs";

const CHUNK = 500;

function summarize(parsed: ParseResult) {
  const base = {
    type: parsed.type,
    detected: parsed.detected,
    symbolCount: parsed.symbolCount,
    rowCount: parsed.rows.length,
    warnings: parsed.warnings,
  };
  return parsed.type === "financials"
    ? { ...base, periods: parsed.periods }
    : { ...base, years: parsed.years };
}

// Service role: migration 045 made anon read-only, and fa_quarterly /
// fa_annual_pe are pipeline tables.
//
// The two branches are written out rather than sharing one `.from(table)` call.
// supabase-js 2.112 tightened upsert typing (RejectExcessProperties), which
// rejected the previous shape: it passed a QuarterlyRow[] | AnnualPeRow[] union
// to a table name chosen at runtime, so the checker could only see "some union
// going somewhere". Narrowing per branch is what makes each row type actually
// checked against the table it lands in — the union was hiding that, not the
// new types being awkward.
async function upsertAll(
  admin: NonNullable<ReturnType<typeof supabaseAdmin>>,
  parsed: ParseResult,
): Promise<number> {
  let n = 0;
  if (parsed.type === "financials") {
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const chunk = parsed.rows.slice(i, i + CHUNK);
      const { error } = await admin.from("fa_quarterly").upsert(chunk, { onConflict: "symbol,period" });
      if (error) throw new Error(`fa_quarterly: ${error.message}`);
      n += chunk.length;
    }
  } else {
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const chunk = parsed.rows.slice(i, i + CHUNK);
      const { error } = await admin.from("fa_annual_pe").upsert(chunk, { onConflict: "symbol,year" });
      if (error) throw new Error(`fa_annual_pe: ${error.message}`);
      n += chunk.length;
    }
  }
  return n;
}

export async function POST(request: Request) {
  try {
    const role = await getUserRole();
    if (role !== "admin") {
      return Response.json({ error: "Unauthorized — admin access required" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const hintRaw = String(form.get("type") ?? "");
    const hint = hintRaw === "financials" || hintRaw === "pe" ? hintRaw : undefined;
    const commit = String(form.get("commit") ?? "") === "true";

    if (!(file instanceof Blob)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    let parsed: ParseResult;
    try {
      parsed = parseWorkbook(buf, hint);
    } catch (e) {
      return Response.json({ error: `Could not parse workbook: ${e}` }, { status: 400 });
    }

    if (parsed.rows.length === 0) {
      return Response.json(
        { error: "No data rows detected. Check the file format / type selection.", summary: summarize(parsed) },
        { status: 400 },
      );
    }

    if (!commit) {
      // Preview: parse only, no write.
      return Response.json({ preview: true, summary: summarize(parsed) });
    }

    const admin = supabaseAdmin();
    if (!admin) return adminUnavailable();

    const upserted = await upsertAll(admin, parsed);
    // Fresh quarterly financials → drop cached FA reads. (Scores themselves are
    // recomputed by refresh_fa.py, whose workflow revalidates fa-data too.)
    revalidateTag(TAG_FA, { expire: 0 });

    return Response.json({ success: true, upserted, summary: summarize(parsed) });
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}
