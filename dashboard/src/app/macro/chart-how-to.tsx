"use client";

import type { ReactNode } from "react";

// Collapsible "How is this calculated, and how do I use it?" explainer shown
// under each macro chart's header. It mirrors the inline <details> the FCI chart
// uses (fci-chart.tsx); kept as one component so every chart shares the exact
// styling and placement. `items` are rendered as bullet points — pass plain
// strings, or JSX when a bullet needs an inline coloured regime label.
export function ChartHowTo({ summary, items }: { summary: string; items: ReactNode[] }) {
  return (
    <details className="mb-2 text-xs text-gray-600">
      <summary className="cursor-pointer select-none text-indigo-700 hover:text-indigo-900 font-medium">
        ⓘ {summary}
      </summary>
      <ul className="list-disc ml-5 mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </details>
  );
}
