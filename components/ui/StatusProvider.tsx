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

type StatusOptions = {
  title?: string;
  message: string;
  success?: boolean;
  refresh?: boolean; // reload page after close
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

  React.useEffect(() => {
    let t: any;
    if (open && opts?.timeoutMs) {
      t = setTimeout(() => {
        setOpen(false);
      }, opts.timeoutMs);
    }
    return () => clearTimeout(t);
  }, [open, opts]);

  React.useEffect(() => {
    if (!open && opts?.refresh) {
      // do a full reload to ensure latest data; this is simple and reliable
      window.location.reload();
    }
  }, [open, opts]);

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
