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

export type UserRole = "admin" | "pro" | null;

/**
 * Get the current user's role, or null if not logged in.
 * Uses Supabase Auth getUser() (verified server-side) + profiles table.
 */
export async function getUserRole(): Promise<UserRole> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (profile?.role as UserRole) ?? "pro";
}
