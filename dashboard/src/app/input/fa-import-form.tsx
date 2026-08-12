"use client";

import { useRef, useState } from "react";
import { type Locale, t } from "@/lib/i18n";

type DetectedField = { field: string; sheet: string; columns: number; periods: string[] };
type Summary = {
  type: "financials" | "pe";
  detected: DetectedField[];
  symbolCount: number;
  rowCount: number;
  warnings: string[];
  periods?: string[];
  years?: number[];
};
type PreviewResp = { preview: true; summary: Summary };
type CommitResp = { success: true; upserted: number; summary: Summary };
type ErrResp = { error: string; summary?: Summary };

export default function FaImportForm({ locale }: { locale: Locale }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<"" | "financials" | "pe">("");
  const [busy, setBusy] = useState<"" | "preview" | "commit">("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(commit: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t(locale, "faImportNoFile"));
      return;
    }
    setBusy(commit ? "commit" : "preview");
    setError(null);
    if (!commit) { setSummary(null); setDone(null); }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    fd.append("commit", commit ? "true" : "false");

    try {
      const res = await fetch("/api/fa-import", { method: "POST", body: fd });
      const data = (await res.json()) as PreviewResp | CommitResp | ErrResp;
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Import failed");
        if ("summary" in data && data.summary) setSummary(data.summary);
        return;
      }
      setSummary(data.summary);
      if ("success" in data) setDone(`${data.upserted} ${t(locale, "faImportRows")}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="bg-panel rounded-lg border border-line p-4 mt-6">
      <h2 className="font-semibold">{t(locale, "faImportTitle")}</h2>
      <p className="text-body-lg text-fg-muted mb-3">{t(locale, "faImportSubtitle")}</p>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          onChange={() => { setSummary(null); setError(null); setDone(null); }}
          className="text-body-lg"
        />
        <label className="text-body-lg">
          <span className="block text-fg-muted mb-1">{t(locale, "faImportType")}</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="border border-line rounded px-2 py-1">
            <option value="">{t(locale, "faImportTypeAuto")}</option>
            <option value="financials">{t(locale, "faImportTypeFin")}</option>
            <option value="pe">{t(locale, "faImportTypePe")}</option>
          </select>
        </label>
        <button
          onClick={() => send(false)}
          disabled={busy !== ""}
          className="px-3 py-1.5 text-body-lg rounded bg-panel-2 hover:bg-line disabled:opacity-50"
        >
          {busy === "preview" ? t(locale, "faImportPreviewing") : t(locale, "faImportPreview")}
        </button>
        <button
          onClick={() => send(true)}
          disabled={busy !== "" || !summary || (summary?.rowCount ?? 0) === 0}
          className="px-3 py-1.5 text-body-lg rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy === "commit" ? t(locale, "faImportImporting") : t(locale, "faImportConfirm")}
        </button>
      </div>

      {error && <div className="text-body-lg text-down mb-2">{error}</div>}
      {done && <div className="text-body-lg text-up mb-2">✓ {done} · {t(locale, "faImportNote")}</div>}

      {summary && (
        <div className="text-body-lg border-t border-line-faint pt-3">
          <div className="mb-2">
            <span className="font-medium">{summary.type}</span> · {summary.symbolCount} {t(locale, "faImportSymbols")} · {summary.rowCount} {t(locale, "faImportRows")}
            {summary.periods && <> · {summary.periods.join(", ")}</>}
            {summary.years && <> · {summary.years.join(", ")}</>}
          </div>
          <div className="text-data text-fg-muted mb-1">{t(locale, "faImportDetected")}:</div>
          <ul className="text-data font-mono text-fg grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {summary.detected.map((d) => (
              <li key={d.field}>{d.field} ← {d.sheet} ({d.columns})</li>
            ))}
          </ul>
          {summary.warnings.length > 0 && (
            <div className="mt-2 text-data text-amber-700">
              {t(locale, "faImportWarnings")}: {summary.warnings.join("; ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
