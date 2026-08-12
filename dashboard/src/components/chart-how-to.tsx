"use client";

import type { ReactNode } from "react";

/**
 * The "how is this calculated, and how do I use it?" disclosure under a chart
 * header. One shared component so every chart (the macro panels and the
 * implied-risk page) gets identical styling and placement.
 *
 * `items` render as bullets — plain strings, or JSX where a bullet needs an
 * inline coloured regime label.
 *
 * `takeaway` is the ONE sentence that stays visible while the rest is collapsed.
 * The pattern comes from Simply Wall St: lead with the consequence, put the
 * methodology one click away. It is optional because it cannot be derived — the
 * existing `items` are 41–119 words each, so surfacing one of them by default
 * would ADD height rather than save it, which is the opposite of the point. Each
 * chart needs a short, deliberately written consequence line instead.
 */
export function ChartHowTo({
  summary,
  items,
  takeaway,
}: {
  summary: string;
  items: ReactNode[];
  takeaway?: ReactNode;
}) {
  return (
    <div className="mb-2">
      {takeaway && <p className="mb-1 text-body text-fg">{takeaway}</p>}
      <details className="text-data text-fg-muted">
        <summary className="cursor-pointer select-none text-accent hover:text-accent-hover font-medium">
          ⓘ {summary}
        </summary>
        <ul className="list-disc ml-5 mt-2 space-y-1.5 marker:text-fg-faint">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
