"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Supplier } from "@/app/types/supplier";
import { AlertCircle } from "lucide-react";

interface DialogHapusSupplierProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  supplier: Supplier | null;
  isLoading?: boolean;
}

export const DialogHapusSupplier: React.FC<DialogHapusSupplierProps> = ({
  open,
  onOpenChange,
  onConfirm,
  supplier,
  isLoading = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming supplier deletion:", error);
      // Error handling can be improved with toast notifications
    } finally {
      setIsDeleting(false);
    }
  };

  const currentLoading = isLoading || isDeleting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Hapus Supplier
          </DialogTitle>
          <DialogDescription>
            Tindakan ini tidak dapat dibatalkan. Data supplier akan dihapus
            secara permanen beserta data terkait.
          </DialogDescription>
        </DialogHeader>

        {supplier && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Kode:</span> {supplier.kode}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Nama:</span> {supplier.nama}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Telepon:</span> {supplier.telp}
            </p>
            <p className="text-sm text-red-600 mt-3 font-semibold">
              Apakah Anda yakin ingin menghapus supplier ini?
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={currentLoading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={currentLoading}
          >
            {currentLoading ? "Menghapus..." : "Hapus Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
