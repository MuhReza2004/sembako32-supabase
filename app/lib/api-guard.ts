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

export const requireAuth = async (
  request: NextRequest,
): Promise<GuardOk | GuardFail> => {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {
          // No-op: read-only for auth checks.
        },
        remove() {
          // No-op: read-only for auth checks.
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      ),
    };
  }

  const userMeta = user as {
    app_metadata?: { role?: string };
    user_metadata?: { role?: string };
  };
  const tokenRole =
    userMeta?.app_metadata?.role ?? userMeta?.user_metadata?.role;

  let role = tokenRole || null;
  if (!role) {
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.role) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "role_not_found" },
          { status: 403 },
        ),
      };
    }
    role = userProfile.role;
  }

  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "role_not_found" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: user.id, role };
};

export const requireAdmin = async (
  request: NextRequest,
): Promise<GuardOk | GuardFail> => {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;
  const { userId, role } = auth;

  if (role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", role },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId, role };
};
