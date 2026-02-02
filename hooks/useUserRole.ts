"use client";

import { getUserById } from "@/app/services/user.service";
import { UserRole } from "@/app/types/user";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setLoading(true);
          setError(null);

          if (!session?.user) {
            setRole(null);
            setLoading(false);
            return;
          }

          // Use user.id for Supabase user object
          const profile = await getUserById(session.user.id);
          setRole(profile?.role ?? null);
        } catch (err: any) {
          console.error("Error fetching user role:", err);
          setError(err?.message || "Gagal memuat role user");
          setRole(null);
        } finally {
          setLoading(false);
        }
      },
    );

    // Initial check for current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        try {
            setLoading(true);
            setError(null);
            if (session?.user) {
                const profile = await getUserById(session.user.id);
                setRole(profile?.role ?? null);
            } else {
                setRole(null);
            }
        } catch (err: any) {
            console.error("Error fetching initial user role:", err);
            setError(err?.message || "Gagal memuat role user awal");
            setRole(null);
        } finally {
            setLoading(false);
        }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { role, loading, error };
}
