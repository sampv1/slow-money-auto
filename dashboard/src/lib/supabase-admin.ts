import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client holding the service-role key.
 *
 * Migration 045 revoked anon's write access — the anon key ships inside the
 * client JS bundle, so anyone could rewrite the dataset straight through
 * PostgREST. Every write the dashboard performs now goes through this client.
 *
 * SECURITY — the service-role key bypasses RLS completely:
 *   - the env var is `SUPABASE_SERVICE_ROLE_KEY`, deliberately NOT prefixed
 *     `NEXT_PUBLIC_`, which is what keeps Next from inlining it into client
 *     bundles;
 *   - import this module only from route handlers / server components. Never
 *     from a "use client" file, and never pass the client or its key into one.
 *
 * The guard below is the backstop for that rule. `server-only` is not a
 * dependency here, so instead we fail loudly if this module is ever evaluated in
 * a browser — a build that leaks it breaks immediately and visibly rather than
 * quietly shipping a full-access credential to every visitor.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "supabase-admin must never be imported into client code — it carries the service-role key.",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

/**
 * The write client, or `null` when the key is not configured.
 *
 * Returns null rather than throwing at import time so that a deployment missing
 * the env var still serves every read-only page; only the write routes fail, and
 * they fail with an explicit 503 (see `adminUnavailable`) instead of appearing
 * to succeed. A denied PostgREST write answers 204 with zero rows affected, not
 * an error, so "looks like it worked" is the failure mode to design against.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, {
      // No cookie/session handling: this client is never a logged-in user, and
      // persisting a session in a shared server runtime would be a bug.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/** Uniform 503 for the write routes when the service-role key is missing. */
export function adminUnavailable(): Response {
  return Response.json(
    {
      error:
        "Server is not configured for writes (SUPABASE_SERVICE_ROLE_KEY missing). " +
        "Set it in the deployment environment.",
    },
    { status: 503 },
  );
}
