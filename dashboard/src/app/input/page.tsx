"use client";

import { useState } from "react";

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

export default function InputPage() {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [result, setResult] = useState<PushResult | null>(null);

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
      alert("Invalid JSON — check for syntax errors");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Push Recommendation</h1>
      <p className="text-sm text-gray-500 mb-4">
        Paste Claude&apos;s JSON output (Ph&#7847;n K) below. Supports raw JSON or markdown code blocks.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{"analysis_date": "2026-04-21", "trading_date": "2026-04-21", ...}'
          className="w-full h-80 p-3 text-sm font-mono bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          spellCheck={false}
        />

        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Validate
          </button>
          <button
            type="submit"
            disabled={status === "submitting" || !json.trim()}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Pushing..." : "Push to Supabase"}
          </button>
        </div>
      </form>

      {/* Result */}
      {result && status === "success" && "success" in result && result.success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-green-700">Pushed successfully</div>
          <div className="text-green-600 mt-1">
            {result.trading_date} | {result.conclusion} | {result.recommendations_inserted} recommendation(s)
          </div>
          <a href="/logs" className="text-blue-600 hover:underline text-xs mt-2 inline-block">
            View in Daily Logs &rarr;
          </a>
        </div>
      )}

      {result && status === "error" && "error" in result && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-red-700">{result.error}</div>
          {"details" in result && result.details && (
            <ul className="mt-2 text-red-600 text-xs space-y-1">
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
