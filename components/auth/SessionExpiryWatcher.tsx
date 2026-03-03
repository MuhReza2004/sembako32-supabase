"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function SessionExpiryWatcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const triggerExpiry = async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setOpen(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign out errors
    }
  };

  const scheduleFromSession = (expiresAt?: number | null) => {
    clearTimer();
    if (!expiresAt) return;
    const ms = expiresAt * 1000 - Date.now();
    timerRef.current = setTimeout(
      () => void triggerExpiry(),
      Math.max(0, ms),
    );
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      scheduleFromSession(data.session?.expires_at ?? null);
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          clearTimer();
          return;
        }
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          scheduleFromSession(session?.expires_at ?? null);
        }
      },
    );

    return () => {
      active = false;
      clearTimer();
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    router.push("/auth/login");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : setOpen(v))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesi Anda Telah Habis</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Demi keamanan, Anda telah logout otomatis. Silakan login kembali.
        </p>
        <DialogFooter className="mt-4">
          <Button onClick={handleClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
