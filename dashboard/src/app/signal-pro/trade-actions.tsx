"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { formatPrice, formatPnl, pnlColor } from "@/lib/format";

// Admin-only BUY/SELL controls for a single Signal Pro row (long-only paper
// trades). When the symbol has no open manual position we show BUY (opens a
// position on the Active page at the latest close). When it does, we show SELL,
// which finalizes the position — P/L is computed and it moves to History.
// Both open a review popup with a Yes/No confirmation.
export function TradeActions({
  symbol,
  isActive,
  locale,
}: {
  symbol: string;
  isActive: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"BUY" | "SELL" | null>(null);
  const [close, setClose] = useState<{ price: number; date: string } | null>(null);
  const [entry, setEntry] = useState<number | null>(null); // open-position entry (SELL)
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry (BUY) / exit (SELL) price — editable, prefilled with the latest close.
  const [price, setPrice] = useState("");
  // Optional BUY inputs (strings so empty = omitted).
  const [sl, setSl] = useState("");
  const [tp1, setTp1] = useState("");
  const [tp2, setTp2] = useState("");
  const [holding, setHolding] = useState("");
  const [winRate, setWinRate] = useState("");
  const [sharpe, setSharpe] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setPrice(""); setSl(""); setTp1(""); setTp2(""); setHolding(""); setWinRate(""); setSharpe(""); setNote("");
    setError(null); setClose(null); setEntry(null);
  }

  async function latestClose() {
    const { data } = await supabase
      .from("ta_ohlcv")
      .select("date,close")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { price: Number(data.close), date: data.date as string } : null;
  }

  async function openBuy() {
    reset();
    setMode("BUY");
    setLoading(true);
    const c = await latestClose();
    setClose(c);
    setPrice(c ? String(c.price) : "");
    setLoading(false);
  }

  async function openSell() {
    reset();
    setMode("SELL");
    setLoading(true);
    const [c, pos] = await Promise.all([
      latestClose(),
      supabase
        .from("recommendations")
        .select("entry_price")
        .eq("symbol", symbol)
        .in("status", ["OPEN", "TP1_HIT"])
        .order("trading_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setClose(c);
    setPrice(c ? String(c.price) : "");
    setEntry(pos.data ? Number(pos.data.entry_price) : null);
    setLoading(false);
  }

  function cancel() {
    setMode(null);
    reset();
  }

  async function submit() {
    if (!mode) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "BUY"
            ? { symbol, action: "BUY", price, stop_loss: sl, tp1, tp2, holding, win_rate_est: winRate, sharpe, note }
            : { symbol, action: "SELL", price, note },
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      cancel();
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const priceNum = Number(price);
  const priceValid = price.trim() !== "" && Number.isFinite(priceNum) && priceNum > 0;
  const pnl = mode === "SELL" && entry !== null && priceValid
    ? Number((((priceNum - entry) / entry) * 100).toFixed(2))
    : null;

  return (
    <>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {isActive ? (
          <button
            type="button"
            onClick={openSell}
            className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
          >
            {t(locale, "spSell")}
          </button>
        ) : (
          <button
            type="button"
            onClick={openBuy}
            className="px-2 py-0.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
          >
            {t(locale, "spBuy")}
          </button>
        )}
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={cancel}>
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">
                <span className={mode === "BUY" ? "text-green-700" : "text-red-700"}>
                  {mode === "BUY" ? t(locale, "spBuy") : t(locale, "spSell")}
                </span>{" "}
                {symbol}
              </h3>
              <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-700 text-2xl leading-none" aria-label="Close">×</button>
            </div>

            {/* Entry (BUY) / Exit (SELL) — editable, prefilled with latest close. */}
            <div className="bg-gray-50 rounded border border-gray-200 px-3 py-2 mb-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-500">{mode === "BUY" ? t(locale, "entry") : t(locale, "spExit")}</span>
                {loading ? (
                  <span className="text-sm text-gray-400">{t(locale, "loading")}…</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm font-mono text-right"
                    />
                    {close && <span className="text-xs text-gray-400 font-mono whitespace-nowrap">{close.date}</span>}
                  </span>
                )}
              </div>
              {mode === "SELL" && entry !== null && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t(locale, "entry")}</span>
                  <span className="font-mono text-gray-600">{formatPrice(entry)}</span>
                </div>
              )}
              {mode === "SELL" && pnl !== null && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t(locale, "pnl")}</span>
                  <span className={`font-mono font-semibold ${pnlColor(pnl)}`}>{formatPnl(pnl)}</span>
                </div>
              )}
            </div>

            {mode === "BUY" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t(locale, "sl")} value={sl} onChange={setSl} type="number" />
                <Field label={t(locale, "tp1")} value={tp1} onChange={setTp1} type="number" />
                <Field label={t(locale, "tp2")} value={tp2} onChange={setTp2} type="number" />
                <Field label={t(locale, "holding")} value={holding} onChange={setHolding} type="text" />
                <Field label={t(locale, "winRateEst")} value={winRate} onChange={setWinRate} type="number" />
                <Field label={t(locale, "sharpe")} value={sharpe} onChange={setSharpe} type="number" />
              </div>
            )}

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">{t(locale, "spNote")}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                placeholder={t(locale, "spNotePlaceholder")}
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <p className="mt-4 text-sm text-gray-600">
              {mode === "BUY" ? t(locale, "spConfirmAdd") : t(locale, "spConfirmSell")}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t(locale, "no")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || loading || !close || !priceValid}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? `${t(locale, "loading")}…` : t(locale, "yes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: "number" | "text";
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
      />
    </label>
  );
}
