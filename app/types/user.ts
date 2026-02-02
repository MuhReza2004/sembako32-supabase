export type UserRole = "admin" | "staff";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
