"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The one markdown renderer in the app.
 *
 * The prose styling is lifted from ResponseViewer, which had it inline. That
 * component is NOT switched over to this one: /logs redirects to /macro, so it
 * renders nowhere today, and its table wrapper carries a full-bleed negative
 * margin this one deliberately does not. Rewriting a component nothing renders,
 * to a slightly different result nobody can look at, is not a refactor — it is
 * an unverifiable change. If Daily Logs comes back, move it over then and check
 * it on screen.
 *
 * react-markdown escapes HTML rather than executing it (no rehype-raw here),
 * which is what lets the stored text be trusted as data. Nothing upstream
 * sanitises it.
 */
const PROSE =
  "prose prose-sm max-w-none break-words prose-headings:text-fg prose-headings:break-words " +
  "prose-p:text-fg prose-strong:text-fg prose-li:text-fg prose-table:text-body-lg " +
  "prose-th:bg-canvas prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-1.5 " +
  "prose-thead:border-b prose-thead:border-line prose-tr:border-b prose-tr:border-line-faint " +
  "prose-hr:border-line prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:break-words";

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`${PROSE} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Every table scrolls inside its own box. A wide table is the one
          // thing an author can paste that would otherwise blow out the page
          // width — the site's own tables all do this too (lib/table.ts).
          table: ({ children: kids, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props}>{kids}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
