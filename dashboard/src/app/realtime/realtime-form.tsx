"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { track } from "@/lib/analytics";

export function RealtimeForm({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail && !cleanPhone) {
      setStatus("error");
      setError(t(locale, "realtimeAtLeastOne"));
      return;
    }

    setStatus("submitting");
    setError(null);

    // Pack into the existing /api/feedback shape so signups appear in the
    // admin Feedbacks page, clearly tagged so they can be triaged separately.
    const message = [
      "[Real-time waitlist signup]",
      cleanEmail ? `Email: ${cleanEmail}` : null,
      cleanPhone ? `Phone: ${cleanPhone}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const contact = cleanEmail || cleanPhone;

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contact }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setEmail("");
        setPhone("");
        track("realtime_waitlist_signup", {
          has_email: !!cleanEmail,
          has_phone: !!cleanPhone,
        });
      } else {
        setStatus("error");
        setError(data.error ?? "Failed to submit");
      }
    } catch (err) {
      setStatus("error");
      setError(`Network error: ${err}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="realtime-email" className="block text-sm font-medium text-gray-700 mb-1">
          {t(locale, "realtimeEmailLabel")}
        </label>
        <input
          id="realtime-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          placeholder={t(locale, "realtimeEmailPlaceholder")}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="realtime-phone" className="block text-sm font-medium text-gray-700 mb-1">
          {t(locale, "realtimePhoneLabel")}
        </label>
        <input
          id="realtime-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={200}
          placeholder={t(locale, "realtimePhonePlaceholder")}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <p className="text-xs text-gray-500">{t(locale, "realtimeContactHint")}</p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? t(locale, "realtimeSubmitting") : t(locale, "realtimeSubmit")}
        </button>

        {status === "success" && (
          <span className="text-sm text-green-600">{t(locale, "realtimeSuccess")}</span>
        )}
        {status === "error" && error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
      </div>
    </form>
  );
}
