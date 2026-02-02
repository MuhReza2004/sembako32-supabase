"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/app/services/auth.service";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  return (
    <Button variant="primary" onClick={handleLogout}>
      Logout
    </Button>
  );
}
