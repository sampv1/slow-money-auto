"use client";

import { sendGAEvent } from "@next/third-parties/google";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function track(event: string, params?: Record<string, unknown>) {
  if (!GA_MEASUREMENT_ID) return;
  sendGAEvent("event", event, params ?? {});
}

export function identifyUser(userId: string) {
  if (!GA_MEASUREMENT_ID) return;
  sendGAEvent("config", GA_MEASUREMENT_ID, { user_id: userId });
}
