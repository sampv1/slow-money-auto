"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function FeedbackForm({ locale }: { locale: Locale }) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contact }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("");
        setContact("");
      } else {
        setStatus("error");
        setError(data.error ?? "Failed to send");
      }
    } catch (err) {
      setStatus("error");
      setError(`Network error: ${err}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          {t(locale, "feedbackTitle")}
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          maxLength={5000}
          placeholder={t(locale, "feedbackPlaceholder")}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <div>
        <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
          {t(locale, "feedbackContactLabel")}
          <span className="ml-1 text-xs text-gray-400 font-normal">
            ({t(locale, "optional")})
          </span>
        </label>
        <input
          id="contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={200}
          placeholder={t(locale, "feedbackContactPlaceholder")}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "submitting" || !message.trim()}
          className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? t(locale, "sending") : t(locale, "send")}
        </button>

        {status === "success" && (
          <span className="text-sm text-green-600">{t(locale, "feedbackSuccess")}</span>
        )}
        {status === "error" && error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
      </div>
    </form>
  );
}
