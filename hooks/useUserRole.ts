"use client";

import { getUserById } from "@/app/services/user.service";
import { UserRole } from "@/app/types/user";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client

type AuthSession = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>["data"]["session"];

type UserWithRoleMeta = {
  app_metadata?: { role?: UserRole };
  user_metadata?: { role?: UserRole };
};

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadRole = async (session: AuthSession) => {
      try {
        setLoading(true);
        setError(null);

        if (!session?.user) {
          if (isActive) setRole(null);
          return;
        }

        const user = session.user as UserWithRoleMeta;
        const tokenRole = user.app_metadata?.role ?? user.user_metadata?.role;

        if (tokenRole) {
          if (isActive) setRole(tokenRole);
          return;
        }

        const profile = await getUserById(session.user.id);
        if (isActive) setRole(profile?.role ?? null);
      } catch (err: unknown) {
        console.error("Error fetching user role:", err);
        if (isActive) {
          setError(err instanceof Error ? err.message : "Gagal memuat role user");
          setRole(null);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    // Initial check for current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadRole(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the initial event to avoid double fetch
      if (event === "INITIAL_SESSION") return;
      await loadRole(session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { role, loading, error };
}
