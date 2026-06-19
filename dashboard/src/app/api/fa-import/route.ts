import { supabase } from "@/lib/supabase";
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

async function upsertAll(parsed: ParseResult): Promise<number> {
  const table = parsed.type === "financials" ? "fa_quarterly" : "fa_annual_pe";
  const onConflict = parsed.type === "financials" ? "symbol,period" : "symbol,year";
  let n = 0;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
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

    const upserted = await upsertAll(parsed);
    return Response.json({ success: true, upserted, summary: summarize(parsed) });
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}
