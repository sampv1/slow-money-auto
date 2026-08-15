"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { formatPrice, formatPnl, pnlColor, todayVn } from "@/lib/format";

// Admin-only BUY/SELL controls for a single Signal Pro row (long-only paper
// trades). When the symbol has no open manual position we show BUY (opens a
// position on the Active page at the latest close). When it does, we show SELL,
// which finalizes the position — P/L is computed and it moves to History.
// Both open a review popup with a Yes/No confirmation.
export function TradeActions({
  symbol,
  isActive,
  locale,
  sellOnly = false,
  recId,
  entryPrice = null,
}: {
  symbol: string;
  isActive: boolean;
  locale: Locale;
  // When true, render only the SELL control (used on the Active page, where
  // every row is already an open position).
  sellOnly?: boolean;
  // When set, SELL closes ONLY this recommendation (single-close, Active page)
  // instead of every open position for the symbol. `entryPrice` is that row's
  // own entry, used for the P/L preview.
  recId?: string;
  entryPrice?: number | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"BUY" | "SELL" | null>(null);
  const [close, setClose] = useState<{ price: number; date: string } | null>(null);
  const [entry, setEntry] = useState<number | null>(null); // avg entry across open positions (SELL)
  const [posCount, setPosCount] = useState(0); // number of open positions being finalized (SELL)
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
  // BUY writes `note` (the buy thesis); SELL writes the two journal halves.
  // Kept as separate state rather than one reused box so switching modes cannot
  // carry an exit reason into an entry thesis.
  const [note, setNote] = useState("");
  const [sellThesis, setSellThesis] = useState("");
  const [lessonLearned, setLessonLearned] = useState("");

  function reset() {
    setPrice(""); setSl(""); setTp1(""); setTp2(""); setHolding(""); setWinRate(""); setSharpe(""); setNote("");
    setSellThesis(""); setLessonLearned("");
    setError(null); setClose(null); setEntry(null); setPosCount(0);
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
    // Single-close (Active page): only this recommendation, entry passed in — no
    // need to aggregate the symbol's other open positions.
    if (recId) {
      const c = await latestClose();
      setClose(c);
      setPrice(c ? String(c.price) : "");
      setPosCount(1);
      setEntry(entryPrice);
      setLoading(false);
      return;
    }
    const [c, pos] = await Promise.all([
      latestClose(),
      supabase
        .from("recommendations")
        .select("entry_price")
        .eq("symbol", symbol)
        .in("status", ["OPEN", "TP1_HIT"]),
    ]);
    setClose(c);
    setPrice(c ? String(c.price) : "");
    // Equal-weight average entry across all open positions (same volume each).
    const openRows = pos.data ?? [];
    setPosCount(openRows.length);
    setEntry(
      openRows.length > 0
        ? Number((openRows.reduce((s, r) => s + Number(r.entry_price), 0) / openRows.length).toFixed(2))
        : null,
    );
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
            : {
                symbol,
                action: "SELL",
                price,
                sell_thesis: sellThesis,
                lesson_learned: lessonLearned,
                ...(recId ? { id: recId } : {}),
              },
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

  // BUY-only: reject targets on the wrong side of entry before they ever reach
  // the server (mirrors the check in /api/recommendations/manual). An empty
  // field is fine (SL/TP are optional) — only a filled-in, wrong-side value
  // blocks submit.
  const buyIssues: string[] = [];
  if (mode === "BUY" && priceValid) {
    const slNum = Number(sl), tp1Num = Number(tp1), tp2Num = Number(tp2);
    if (sl.trim() !== "" && Number.isFinite(slNum) && slNum >= priceNum) buyIssues.push(t(locale, "spSlMustBeBelowEntry"));
    if (tp1.trim() !== "" && Number.isFinite(tp1Num) && tp1Num <= priceNum) buyIssues.push(t(locale, "spTpMustBeAboveEntry"));
    if (tp2.trim() !== "" && Number.isFinite(tp2Num) && tp2Num <= priceNum) buyIssues.push(t(locale, "spTpMustBeAboveEntry"));
  }

  return (
    <>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {!sellOnly && (
          <button
            type="button"
            onClick={openBuy}
            className="px-2 py-0.5 text-data rounded bg-green-600 text-white hover:bg-green-700"
          >
            {t(locale, "spBuy")}
          </button>
        )}
        <button
          type="button"
          onClick={openSell}
          disabled={!isActive}
          title={!isActive ? t(locale, "spSellDisabled") : undefined}
          className="px-2 py-0.5 text-data rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600"
        >
          {t(locale, "spSell")}
        </button>
      </div>

      {/* Portalled to <body> ON PURPOSE — do not inline it back into this tree.
          An ancestor with backdrop-filter / filter / transform becomes the
          containing block for position:fixed descendants, so `fixed inset-0`
          would resolve against that ancestor instead of the viewport. The
          Analysis page renders these buttons inside its sticky `backdrop-blur`
          header (~50px tall), which centred the dialog in that strip and pushed
          its top half off-screen. The portal also frees the overlay from the
          header's z-20 stacking context. */}
      {mode && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={cancel}>
          <div
            className="bg-panel rounded-lg shadow-xl border border-line p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-title font-semibold">
                <span className={mode === "BUY" ? "text-up" : "text-down"}>
                  {mode === "BUY" ? t(locale, "spBuy") : t(locale, "spSell")}
                </span>{" "}
                {symbol}
              </h3>
              <button type="button" onClick={cancel} className="text-fg-label hover:text-fg text-display leading-none" aria-label="Close">×</button>
            </div>

            {/* Entry (BUY) / Exit (SELL) — editable, prefilled with latest close. */}
            <div className="bg-canvas rounded border border-line px-3 py-2 mb-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-lg text-fg-muted">{mode === "BUY" ? t(locale, "entry") : t(locale, "spExit")}</span>
                {loading ? (
                  <span className="text-body-lg text-fg-label">{t(locale, "loading")}…</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-28 border border-line rounded px-2 py-1 text-body-lg font-mono text-right"
                    />
                    {close && <span className="text-data text-fg-label font-mono whitespace-nowrap">{close.date}</span>}
                  </span>
                )}
              </div>
              {/* The bare date beside the price is the BAR the price came from;
                  the trade itself happens TODAY (VN). Showing both stops the
                  two being read as one. Same value the server stores — computed
                  from the same formula, just off the browser clock. */}
              <div className="mt-1 flex items-center justify-between text-body-lg">
                <span className="text-fg-muted">
                  {t(locale, mode === "BUY" ? "spEntryDate" : "spExitDate")}
                </span>
                <span className="font-mono text-fg-muted">{todayVn()}</span>
              </div>
              {mode === "SELL" && entry !== null && (
                <div className="mt-1 flex items-center justify-between text-body-lg">
                  <span className="text-fg-muted">
                    {posCount > 1
                      ? `${t(locale, "spAvgEntry")} (${posCount} ${t(locale, "positions")})`
                      : t(locale, "entry")}
                  </span>
                  <span className="font-mono text-fg-muted">{formatPrice(entry)}</span>
                </div>
              )}
              {mode === "SELL" && pnl !== null && (
                <div className="mt-1 flex items-center justify-between text-body-lg">
                  <span className="text-fg-muted">{t(locale, "pnl")}</span>
                  <span className={`font-mono font-semibold ${pnlColor(pnl)}`}>{formatPnl(pnl)}</span>
                </div>
              )}
            </div>

            {mode === "BUY" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t(locale, "tp1")} value={tp1} onChange={setTp1} type="number" />
                <Field label={t(locale, "tp2")} value={tp2} onChange={setTp2} type="number" />
                <Field label={t(locale, "sl")} value={sl} onChange={setSl} type="number" />
                <Field label={t(locale, "holding")} value={holding} onChange={setHolding} type="text" />
                <Field label={t(locale, "winRateEst")} value={winRate} onChange={setWinRate} type="number" />
                <Field label={t(locale, "sharpe")} value={sharpe} onChange={setSharpe} type="number" />
              </div>
            )}

            {buyIssues.length > 0 && (
              <ul className="mt-2 text-data text-down list-disc list-inside">
                {[...new Set(buyIssues)].map((msg) => <li key={msg}>{msg}</li>)}
              </ul>
            )}

            {/* The journal, captured at the moment the decision is made rather
                than reconstructed later. BUY writes the buy thesis (which is
                then fixed forever); SELL writes the two halves of the exit.
                All three surface in the Trading Journal on the Portfolio page.

                SELL deliberately asks TWO questions. Why you sold and what the
                trade taught are different claims, and one box for both is what
                let them be conflated — the reason to keep the lesson separate is
                that it is written knowing the outcome, and the exit reason must
                not be quietly rewritten by hindsight. */}
            {mode === "BUY" ? (
              <div className="mt-3">
                <label className="block text-data text-fg-muted mb-1">
                  {t(locale, "journalBuyThesis")}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full border border-line rounded px-2 py-1 text-body-lg"
                  placeholder={t(locale, "spBuyThesisPlaceholder")}
                />
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <label className="block text-data text-fg-muted mb-1">
                    {t(locale, "journalSellThesis")}
                  </label>
                  <textarea
                    value={sellThesis}
                    onChange={(e) => setSellThesis(e.target.value)}
                    rows={3}
                    className="w-full border border-line rounded px-2 py-1 text-body-lg"
                    placeholder={t(locale, "journalSellPlaceholder")}
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-data text-fg-muted mb-1">
                    {t(locale, "journalLesson")}
                  </label>
                  <textarea
                    value={lessonLearned}
                    onChange={(e) => setLessonLearned(e.target.value)}
                    rows={3}
                    className="w-full border border-line rounded px-2 py-1 text-body-lg"
                    placeholder={t(locale, "journalLessonPlaceholder")}
                  />
                </div>
              </>
            )}

            {error && <p className="mt-3 text-body-lg text-down">{error}</p>}

            <p className="mt-4 text-body-lg text-fg-muted">
              {mode === "BUY" ? t(locale, "spConfirmAdd") : t(locale, "spConfirmSell")}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="px-3 py-1.5 text-body-lg rounded border border-line text-fg-muted hover:bg-canvas disabled:opacity-50"
              >
                {t(locale, "no")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || loading || !close || !priceValid || buyIssues.length > 0}
                className="px-3 py-1.5 text-body-lg rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? `${t(locale, "loading")}…` : t(locale, "yes")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
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
    <label className="block text-body-lg">
      <span className="block text-data text-fg-muted mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line rounded px-2 py-1 text-body-lg font-mono"
      />
    </label>
  );
}
