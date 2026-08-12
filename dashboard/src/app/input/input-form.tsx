"use client";

import { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type PushResult = {
  success: true;
  trading_date: string;
  conclusion: string;
  daily_log_id: string;
  recommendations_inserted: number;
} | {
  error: string;
  details?: string[];
};

function getLocaleCookie(): Locale {
  const match = document.cookie.match(/locale=(en|vi)/);
  return (match?.[1] as Locale) ?? "vi";
}

export default function InputForm() {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [result, setResult] = useState<PushResult | null>(null);
  const [locale, setLocale] = useState<Locale>("vi");

  useEffect(() => {
    setLocale(getLocaleCookie());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!json.trim()) return;

    setStatus("submitting");
    setResult(null);

    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: json,
      });

      const data: PushResult = await res.json();
      setResult(data);
      setStatus(res.ok ? "success" : "error");

      if (res.ok) {
        setJson("");
      }
    } catch (err) {
      setResult({ error: `Network error: ${err}` });
      setStatus("error");
    }
  }

  function handleValidate() {
    try {
      let text = json.trim();
      const match = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
      if (match) text = match[1];
      const data = JSON.parse(text);

      const info = [
        `Trading date: ${data.trading_date}`,
        `Conclusion: ${data.conclusion}`,
        `Regime: ${data.market_context?.regime}`,
        `Recommendations: ${data.recommendations?.length ?? 0}`,
      ];

      if (data.recommendations?.length > 0) {
        for (const rec of data.recommendations) {
          info.push(`  #${rec.rank} ${rec.symbol} @ ${rec.entry_price} | SL ${rec.stop_loss} | TP1 ${rec.tp1} | R=${rec.r_multiple}`);
        }
      }

      setResult({ success: true, trading_date: data.trading_date, conclusion: data.conclusion, daily_log_id: "(preview)", recommendations_inserted: data.recommendations?.length ?? 0 });
      setStatus("idle");
      alert(info.join("\n"));
    } catch {
      alert("Invalid JSON");
    }
  }

  return (
    <div>
      <h1 className="text-display font-semibold mb-4">{t(locale, "pushRecommendation")}</h1>
      <p className="text-body-lg text-fg-muted mb-4">
        {t(locale, "inputDescription")}
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{"analysis_date": "2026-04-21", "trading_date": "2026-04-21", ...}'
          className="w-full h-80 p-3 text-body-lg font-mono bg-panel border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          spellCheck={false}
        />

        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 text-body-lg border border-line rounded-md hover:bg-canvas"
          >
            {t(locale, "validate")}
          </button>
          <button
            type="submit"
            disabled={status === "submitting" || !json.trim()}
            className="px-4 py-2 text-body-lg bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? t(locale, "pushing") : t(locale, "pushToSupabase")}
          </button>
        </div>
      </form>

      {/* Result */}
      {result && status === "success" && "success" in result && result.success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-body-lg">
          <div className="font-medium text-up">{t(locale, "pushedSuccessfully")}</div>
          <div className="text-up mt-1">
            {result.trading_date} | {result.conclusion} | {result.recommendations_inserted} {t(locale, "recommendations")}
          </div>
          <a href="/logs" className="text-accent hover:underline text-data mt-2 inline-block">
            {t(locale, "viewInDailyLogs")} &rarr;
          </a>
        </div>
      )}

      {result && status === "error" && "error" in result && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-body-lg">
          <div className="font-medium text-down">{result.error}</div>
          {"details" in result && result.details && (
            <ul className="mt-2 text-down text-data space-y-1">
              {result.details.map((d, i) => (
                <li key={i}>- {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
