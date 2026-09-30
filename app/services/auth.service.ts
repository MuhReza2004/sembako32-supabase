import { supabase } from "../lib/supabase";

// Registrasi publik sengaja tidak disediakan (lihat docs/FINDINGS.md F-02).
// Akun baru dibuat admin lewat Supabase Dashboard → Authentication → Add user.
export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Error logging in user:", error);
    throw error;
  }
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error logging out user from Supabase:", error);
    throw error;
  }

  // This fetch likely clears server-side session/cookies, so keep it.
  await fetch("/api/auth/logout", {
    method: "POST",
  });
};
