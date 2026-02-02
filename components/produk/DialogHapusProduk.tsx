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
import { Produk } from "@/app/types/produk";
import { AlertCircle } from "lucide-react";

interface DialogHapusProdukProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  produk: Produk | null;
  isLoading?: boolean;
}

export const DialogHapusProduk: React.FC<DialogHapusProdukProps> = ({
  open,
  onOpenChange,
  onConfirm,
  produk,
  isLoading = false,
}) => {
  const handleDelete = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Hapus Produk
          </DialogTitle>
          <DialogDescription>
            Tindakan ini tidak dapat dibatalkan. Data produk akan dihapus secara
            permanen.
          </DialogDescription>
        </DialogHeader>

        {produk && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">ID Produk:</span>{" "}
              {produk.id}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Nama:</span> {produk.nama}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Kode:</span> {produk.kode}
            </p>
            <p className="text-sm text-red-600 mt-3 font-semibold">
              Apakah Anda yakin ingin menghapus produk ini?
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "Menghapus..." : "Hapus Produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
