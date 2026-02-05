import { supabase } from "@/app/lib/supabase";

export const getAccessToken = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Failed to get session:", error);
    return null;
  }
  if (data.session?.access_token) return data.session.access_token;

  const refresh = await supabase.auth.refreshSession();
  if (refresh.error) {
    console.warn("Failed to refresh session:", refresh.error);
    return null;
  }
  return refresh.data.session?.access_token || null;
};
