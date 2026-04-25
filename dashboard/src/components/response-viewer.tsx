"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface LogEntry {
  trading_date: string;
  conclusion: string;
  full_response: string | null;
  num_recommendations: number;
  confidence: number | null;
}

const conclusionStyle: Record<string, string> = {
  KB1: "bg-green-100 text-green-700",
  KB2: "bg-amber-100 text-amber-700",
  KB3: "bg-red-100 text-red-700",
};

export function ResponseViewer({ logs, locale }: { logs: LogEntry[]; locale: Locale }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        {t(locale, "noAnalysisYet")}
      </div>
    );
  }

  const current = logs[selectedIndex];

  return (
    <div>
      {/* Day selector — wraps to multiple lines on mobile */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <h1 className="text-lg sm:text-xl font-semibold">{t(locale, "dailyAnalysis")}</h1>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="flex-1 min-w-0 sm:flex-none px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          {logs.map((log, i) => (
            <option key={log.trading_date} value={i}>
              {log.trading_date} — {log.conclusion} ({log.num_recommendations} {t(locale, "recs")})
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedIndex(Math.min(selectedIndex + 1, logs.length - 1))}
            disabled={selectedIndex >= logs.length - 1}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title={t(locale, "previousDay")}
          >
            &larr;
          </button>
          <button
            onClick={() => setSelectedIndex(Math.max(selectedIndex - 1, 0))}
            disabled={selectedIndex <= 0}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title={t(locale, "nextDay")}
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Header bar — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 text-sm">
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${conclusionStyle[current.conclusion] ?? "bg-gray-100 text-gray-600"}`}>
            {current.conclusion}
          </span>
          <span className="text-gray-500">{current.num_recommendations} {t(locale, current.num_recommendations !== 1 ? "recommendations" : "recommendation")}</span>
          {current.confidence !== null && (
            <span className="text-gray-500">{t(locale, "confidence")}: {current.confidence}/10</span>
          )}
        </div>

        {/* Powered by badge — emphasizes top-tier reasoning model */}
        <div className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200/60 shadow-sm hover:shadow-md transition-all self-start">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-br from-amber-500 to-orange-600"></span>
          </span>
          <span className="text-xs font-semibold bg-gradient-to-r from-amber-700 via-orange-700 to-rose-700 bg-clip-text text-transparent">
            {t(locale, "poweredBy")}
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">·</span>
          <span className="text-xs text-gray-500 hidden sm:inline">{t(locale, "frontierModel")}</span>
        </div>
      </div>

      {/* Response content */}
      {current.full_response ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 prose prose-sm max-w-none break-words prose-headings:text-gray-800 prose-headings:break-words prose-p:text-gray-700 prose-strong:text-gray-800 prose-li:text-gray-700 prose-table:text-sm prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-1.5 prose-thead:border-b prose-thead:border-gray-300 prose-tr:border-b prose-tr:border-gray-100 prose-hr:border-gray-200 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Wrap every table in a horizontally scrollable container so
              // wide tables don't blow out the page width on mobile.
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table {...props}>{children}</table>
                </div>
              ),
            }}
          >
            {current.full_response.replace(/#+\s*📋?\s*PH(?:ẦN|AN)\s*10\s*[—–-]\s*(?:STRUCTURED\s+)?JSON\s+OUTPUT[^\n]*/gi, "")}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          {t(locale, "noFullResponse")}
        </div>
      )}
    </div>
  );
}
