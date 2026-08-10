import { revalidateTag } from "next/cache";
import { supabaseAdmin, adminUnavailable } from "@/lib/supabase-admin";
import { TAG_FEEDBACK } from "@/lib/cached-data";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const MAX_MESSAGE_LEN = 5000;
const MAX_CONTACT_LEN = 200;

// 5 submissions per 10 minutes per client. Generous for a human filling in a
// form, tight enough that scripted spam needs real effort. Applied BEFORE the
// body is parsed so a flood cannot make us do work first.
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`feedback:${clientKey(request)}`, LIMIT, WINDOW_MS);
    if (!gate.ok) {
      return Response.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
      );
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const contact = typeof body.contact === "string" ? body.contact.trim() : "";

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return Response.json({ error: `Message too long (max ${MAX_MESSAGE_LEN} chars)` }, { status: 400 });
    }
    if (contact.length > MAX_CONTACT_LEN) {
      return Response.json({ error: `Contact too long (max ${MAX_CONTACT_LEN} chars)` }, { status: 400 });
    }

    // Migration 045 dropped the "Anyone can submit feedback" anon INSERT policy,
    // which had let callers POST straight to PostgREST and skip the length checks
    // above. This route is now the only way in — and so the single place to add
    // rate limiting.
    const admin = supabaseAdmin();
    if (!admin) return adminUnavailable();

    const { error } = await admin
      .from("feedbacks")
      .insert({
        message,
        contact: contact || null,
      });

    if (error) {
      return Response.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
    }

    // Drop the cached feedbacks list so the new message shows immediately.
    revalidateTag(TAG_FEEDBACK, { expire: 0 });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}
