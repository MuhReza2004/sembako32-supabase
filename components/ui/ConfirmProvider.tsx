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

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

const ConfirmContext = React.createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export const useConfirm = () => {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolveRef = React.useRef<(v: boolean) => void | null>(null);

  const confirm = (o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpts(o);
      resolveRef.current = resolve;
      setOpen(true);
    });
  };

  const handleClose = (result: boolean) => {
    setOpen(false);
    if (resolveRef.current) {
      resolveRef.current(result);
    }
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => v === false && handleClose(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opts?.title || "Konfirmasi"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p>{opts?.message}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              {opts?.cancelText || "Batal"}
            </Button>
            <Button onClick={() => handleClose(true)}>
              {opts?.confirmText || "Ya"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export default ConfirmProvider;
