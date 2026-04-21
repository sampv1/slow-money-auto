"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

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

export function ResponseViewer({ logs }: { logs: LogEntry[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No daily analysis yet. Push data via the Input page or run the prompt script.
      </div>
    );
  }

  const current = logs[selectedIndex];

  return (
    <div>
      {/* Day selector */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold">Daily Analysis</h1>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          {logs.map((log, i) => (
            <option key={log.trading_date} value={i}>
              {log.trading_date} — {log.conclusion} ({log.num_recommendations} recs)
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedIndex(Math.min(selectedIndex + 1, logs.length - 1))}
            disabled={selectedIndex >= logs.length - 1}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous day"
          >
            &larr;
          </button>
          <button
            onClick={() => setSelectedIndex(Math.max(selectedIndex - 1, 0))}
            disabled={selectedIndex <= 0}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next day"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${conclusionStyle[current.conclusion] ?? "bg-gray-100 text-gray-600"}`}>
          {current.conclusion}
        </span>
        <span className="text-gray-500">{current.num_recommendations} recommendation{current.num_recommendations !== 1 ? "s" : ""}</span>
        {current.confidence !== null && (
          <span className="text-gray-500">Confidence: {current.confidence}/10</span>
        )}
      </div>

      {/* Response content */}
      {current.full_response ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-li:text-gray-700 prose-table:text-sm">
          <ReactMarkdown>{current.full_response}</ReactMarkdown>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No full analysis text stored for this day. Push the complete Claude response (not just JSON) to see the analysis here.
        </div>
      )}
    </div>
  );
}
