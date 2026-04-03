import { supabase } from "@/app/lib/supabase";

export const getAccessToken = async (): Promise<string | null> => {
  // Always refresh to ensure we have a valid token
  const refresh = await supabase.auth.refreshSession();
  if (refresh.error) {
    return null;
  }
  return refresh.data.session?.access_token || null;
};
