import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type GuardOk = {
  ok: true;
  userId: string;
  role: string;
};

type GuardFail = {
  ok: false;
  response: NextResponse;
};

const fail = (error: string, status: number, extra?: object): GuardFail => ({
  ok: false,
  response: NextResponse.json({ error, ...extra }, { status }),
});

// Role selalu dibaca dari tabel public.users (sumber yang sama dengan RLS
// is_admin()). Metadata token tidak dipakai karena user_metadata bisa diubah
// oleh user sendiri dan app_metadata bisa basi setelah role diubah.
const getRoleFromDb = async (userId: string): Promise<string | null> => {
  const { data: userProfile, error } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !userProfile?.role) return null;
  return userProfile.role;
};

const getUserIdFromRequest = async (
  request: NextRequest,
): Promise<string | null> => {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : authHeader;

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!error && data?.user) return data.user.id;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: read-only for auth checks in route handlers.
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
};

export const requireAuth = async (
  request: NextRequest,
): Promise<GuardOk | GuardFail> => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return fail("unauthorized", 401);

  const role = await getRoleFromDb(userId);
  if (!role) return fail("role_not_found", 403);

  return { ok: true, userId, role };
};

export const requireAdmin = async (
  request: NextRequest,
): Promise<GuardOk | GuardFail> => {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;
  const { userId, role } = auth;

  if (role !== "admin") {
    return fail("forbidden", 403, { role });
  }

  return { ok: true, userId, role };
};
