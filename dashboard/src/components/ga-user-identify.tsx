"use client";

import { useEffect } from "react";
import { identifyUser } from "@/lib/analytics";

export function GAUserIdentify({ userId }: { userId: string }) {
  useEffect(() => {
    identifyUser(userId);
  }, [userId]);
  return null;
}
