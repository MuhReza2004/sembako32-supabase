import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() memverifikasi JWT ke Supabase Auth (getSession() tidak).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Hanya app_metadata yang tepercaya; user_metadata bisa diubah user sendiri.
  const tokenRole = user?.app_metadata?.role as string | undefined;

  const resolveRole = async (): Promise<string | null> => {
    if (!user) return null;
    if (tokenRole) return tokenRole;
    const { data: userProfile, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (error) {
      console.error("Middleware DB Error:", error);
      return null;
    }
    return userProfile?.role ?? null;
  };

  // If user is not logged in and tries to access protected routes, redirect to login
  if (!user && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // If user is logged in and tries to access login, redirect to dashboard
  if (user && pathname.startsWith("/auth/login")) {
    const role = await resolveRole();
    if (role === "admin") {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard/staff", request.url));
  }

  // If user is trying to access admin dashboard, check their role
  if (user && pathname.startsWith("/dashboard/admin")) {
    const role = await resolveRole();
    if (!role) {
      return NextResponse.redirect(
        new URL("/dashboard/staff?error=no_profile", request.url),
      );
    }
    if (role !== "admin") {
      return NextResponse.redirect(
        new URL(`/dashboard/staff?error=not_admin&role=${role}`, request.url),
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/login"],
};
