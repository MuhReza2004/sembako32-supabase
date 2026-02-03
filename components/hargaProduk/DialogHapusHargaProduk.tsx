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
import { SupplierProduk } from "@/app/types/supplier";
import { AlertCircle } from "lucide-react";
import { formatRupiah } from "@/helper/format";

interface DialogHapusHargaProdukProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  item: SupplierProduk | null;
  isLoading?: boolean;
  supplierName?: string;
  productName?: string;
}

export const DialogHapusHargaProduk: React.FC<DialogHapusHargaProdukProps> = ({
  open,
  onOpenChange,
  onConfirm,
  item,
  isLoading = false,
  supplierName = "",
  productName = "",
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming supplier produk deletion:", error);
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
            Hapus Harga Produk
          </DialogTitle>
          <DialogDescription>
            Tindakan ini tidak dapat dibatalkan. Data harga produk akan dihapus
            secara permanen.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Supplier:</span>{" "}
              {item.supplierNama || supplierName || item.supplier_id}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Produk:</span>{" "}
              {item.produkNama || productName || item.produk_id}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Harga Beli:</span>{" "}
              {formatRupiah(item.harga_beli)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Harga Jual:</span>{" "}
              {formatRupiah(item.harga_jual)}
            </p>
            <p className="text-sm text-red-600 mt-3 font-semibold">
              Apakah Anda yakin ingin menghapus harga produk ini?
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
            {currentLoading ? "Menghapus..." : "Hapus Harga Produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
