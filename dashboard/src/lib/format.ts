import type { Locale } from "./i18n";
import { t } from "./i18n";

export function formatPrice(price: number | null): string {
  if (price === null) return "\u2014";
  if (price >= 1000) {
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return price.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatPnl(pnl: number | null): string {
  if (pnl === null) return "\u2014";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

export function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-gray-400";
  if (pnl > 0) return "text-green-600";
  if (pnl < 0) return "text-red-600";
  return "text-gray-600";
}

export function statusBadge(status: string, locale: Locale = "en"): { label: string; className: string } {
  switch (status) {
    case "OPEN":
      return { label: t(locale, "statusOpen"), className: "bg-blue-100 text-blue-700" };
    case "TP1_HIT":
      return { label: t(locale, "statusTp1Hit"), className: "bg-emerald-100 text-emerald-700" };
    case "TP2_HIT":
      return { label: t(locale, "statusTp2Hit"), className: "bg-green-100 text-green-800" };
    case "STOPPED":
      return { label: t(locale, "statusStopped"), className: "bg-red-100 text-red-700" };
    case "EXPIRED":
      return { label: t(locale, "statusExpired"), className: "bg-amber-100 text-amber-700" };
    case "CLOSED_MANUAL":
      return { label: t(locale, "statusClosed"), className: "bg-gray-100 text-gray-700" };
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

export function regimeLabel(regime: number, locale: Locale = "en"): string {
  switch (regime) {
    case 1: return t(locale, "regime1");
    case 2: return t(locale, "regime2");
    case 3: return t(locale, "regime3");
    case 4: return t(locale, "regime4");
    default: return String(regime);
  }
}
