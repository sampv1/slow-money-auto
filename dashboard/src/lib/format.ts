export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  if (price >= 1000) {
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return price.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatPnl(pnl: number | null): string {
  if (pnl === null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

export function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-gray-400";
  if (pnl > 0) return "text-green-600";
  if (pnl < 0) return "text-red-600";
  return "text-gray-600";
}

export function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "OPEN":
      return { label: "Open", className: "bg-blue-100 text-blue-700" };
    case "TP1_HIT":
      return { label: "TP1 Hit", className: "bg-emerald-100 text-emerald-700" };
    case "TP2_HIT":
      return { label: "TP2 Hit", className: "bg-green-100 text-green-800" };
    case "STOPPED":
      return { label: "Stopped", className: "bg-red-100 text-red-700" };
    case "EXPIRED":
      return { label: "Expired", className: "bg-amber-100 text-amber-700" };
    case "CLOSED_MANUAL":
      return { label: "Closed", className: "bg-gray-100 text-gray-700" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-600" };
  }
}

export function conclusionBadge(conclusion: string): { label: string; className: string } {
  switch (conclusion) {
    case "KB1":
      return { label: "KB1", className: "bg-green-100 text-green-700" };
    case "KB2":
      return { label: "KB2", className: "bg-amber-100 text-amber-700" };
    case "KB3":
      return { label: "KB3", className: "bg-red-100 text-red-700" };
    default:
      return { label: conclusion, className: "bg-gray-100 text-gray-600" };
  }
}
