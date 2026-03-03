"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStatus } from "@/components/ui/StatusProvider";

export default function LoginSuccessListener() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showStatus } = useStatus();
  const hasShown = useRef(false);

  useEffect(() => {
    const loginParam = searchParams.get("login");
    if (loginParam !== "success" || hasShown.current) return;

    hasShown.current = true;
    showStatus({
      title: "Login Berhasil",
      message: "Selamat datang di dashboard. Semoga hari Anda produktif!",
      success: true,
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("login");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParams, showStatus]);

  return null;
}
