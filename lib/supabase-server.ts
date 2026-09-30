import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Untuk Server Components / Server Actions. Mengembalikan user terverifikasi
// dan role dari tabel public.users (sumber yang sama dengan RLS is_admin()).
export const getServerUserRole = async (): Promise<{
  userId: string;
  role: string;
} | null> => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Component tidak boleh menulis cookie; refresh ditangani middleware.
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile?.role) return null;

  return { userId: user.id, role: profile.role };
};
