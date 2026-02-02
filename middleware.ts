import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // If user is not logged in and tries to access protected routes, redirect to login
  if (!user && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // If user is logged in and tries to access login/register, redirect to dashboard
  if (user && (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register"))) {
    // We need to know the user's role to redirect them correctly
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (userProfile?.role === 'admin') {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    } else {
      return NextResponse.redirect(new URL("/dashboard/staff", request.url));
    }
  }

  // If user is trying to access admin dashboard, check their role
  if (user && pathname.startsWith("/dashboard/admin")) {
    const { data: userProfile, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Middleware DB Error:", error);
      return NextResponse.redirect(new URL("/dashboard/staff?error=db_error", request.url));
    }

    if (!userProfile) {
      return NextResponse.redirect(new URL("/dashboard/staff?error=no_profile", request.url));
    }

    if (userProfile.role !== "admin") {
      return NextResponse.redirect(new URL(`/dashboard/staff?error=not_admin&role=${userProfile.role}`, request.url));
    }
  }

  // Refresh session
  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/login", "/auth/register"],
};