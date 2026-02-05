"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type StatusOptions = {
  title?: string;
  message: string;
  success?: boolean;
  refresh?: boolean; // refresh data on route change
  timeoutMs?: number; // auto close
};

const StatusContext = React.createContext<{
  showStatus: (opts: StatusOptions) => void;
  hideStatus: () => void;
} | null>(null);

export const useStatus = () => {
  const ctx = React.useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used within StatusProvider");
  return ctx;
};

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<StatusOptions | null>(null);
  const router = useRouter(); // Initialize useRouter

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (open && opts?.timeoutMs) {
      t = setTimeout(() => {
        setOpen(false);
      }, opts.timeoutMs);
    }
    return () => clearTimeout(t);
  }, [open, opts]);

  React.useEffect(() => {
    if (!open && opts?.refresh) {
      // Use router.refresh() for a soft navigation that re-fetches data
      router.refresh();
    }
  }, [open, opts, router]); // Add router to dependency array

  const showStatus = (o: StatusOptions) => {
    setOpts(o);
    setOpen(true);
  };

  const hideStatus = () => {
    setOpen(false);
  };

  return (
    <StatusContext.Provider value={{ showStatus, hideStatus }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {opts?.title || (opts?.success ? "Sukses" : "Informasi")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p>{opts?.message}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StatusContext.Provider>
  );
}

export default StatusProvider;
