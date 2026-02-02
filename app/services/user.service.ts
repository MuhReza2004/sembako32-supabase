import { supabase } from "../lib/supabase";
import { AppUser, UserRole } from "../types/user";

export const saveUser = async (uid: string, email: string, role: UserRole) => {
  const { data, error } = await supabase
    .from("users")
    .upsert({ id: uid, email, role });

  if (error) {
    console.error("Error saving user:", JSON.stringify(error, null, 2));
    throw error;
  }
  return data;
};

export const getUserById = async (uid: string): Promise<AppUser | null> => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 means no rows found
    console.error("Error getting user by ID:", error);
    throw error;
  }

  return data as AppUser | null;
};
