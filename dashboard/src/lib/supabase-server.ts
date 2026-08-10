import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client for server components / route handlers.
 * Reads and writes auth cookies via Next.js cookies() API.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll can fail in Server Components (read-only cookies).
            // This is fine — middleware handles the refresh.
          }
        },
      },
    },
  );
}

export type UserRole = "admin" | "viewer" | "pro" | null;

/**
 * Get the current user's role, or null if not logged in.
 * Uses Supabase Auth getUser() (verified server-side) + profiles table.
 */
export async function getUserRole(): Promise<UserRole> {
  const { role } = await getUserAndRole();
  return role;
}

/**
 * User + role in one pass — use when both are needed (e.g. the root layout)
 * so auth costs a single getUser() + profiles lookup instead of two.
 */
export async function getUserAndRole(): Promise<{
  user: { id: string; email?: string } | null;
  role: UserRole;
}> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // A FAILED lookup and a MISSING row are different things, and conflating them
  // is how a broken RLS policy stayed invisible: migration 045 briefly made this
  // query fail with 42P17 (recursive policy), the error was discarded, and every
  // admin silently became `pro` — no error, no log, just vanished admin nav and
  // /input redirecting to /login.
  //
  // On error: log it and fail CLOSED (role null). Denying on an unknown role is
  // the safe direction, and null is visible — the admin nav disappears, which is
  // a symptom someone reports, unlike a quiet demotion to a working-looking role.
  if (error) {
    console.error(
      `[auth] profiles lookup failed for user ${user.id}: ${error.code ?? "?"} ${error.message}`,
    );
    return { user, role: null };
  }

  // No row is legitimate — the signup trigger may not have fired yet. `pro` is
  // the least-privileged role, so this default grants nothing.
  return { user, role: (profile?.role as UserRole) ?? "pro" };
}

/**
 * Staff = admin + viewer. Both see the internal/admin nav block and
 * read-only dashboards. Only admin can also create data (Input page,
 * /api/push endpoint).
 */
export function isStaff(role: UserRole): boolean {
  return role === "admin" || role === "viewer";
}
