"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Produk, ProdukFormData } from "@/app/types/produk";
import { AlertTriangle } from "lucide-react";

interface DialogProdukDuplikatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProduct: Produk | null;
  newData: ProdukFormData | null;
  onAddStok: () => Promise<void>;
  onAddNew: () => Promise<void>;
  isLoading?: boolean;
}

export const DialogProdukDuplikat: React.FC<DialogProdukDuplikatProps> = ({
  open,
  onOpenChange,
  existingProduct,
  newData,
  onAddStok,
  onAddNew,
  isLoading = false,
}) => {
  const handleAddStok = async () => {
    await onAddStok();
    onOpenChange(false);
  };

  const handleAddNew = async () => {
    await onAddNew();
    onOpenChange(false);
  };

  if (!existingProduct || !newData) return null;

  const totalStokBaru = existingProduct.stok + newData.stok;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Produk Sudah Ada
          </DialogTitle>
          <DialogDescription>
            Produk dengan nama yang sama sudah terdaftar di sistem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Produk yang ada */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Produk yang sudah ada:
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Nama:</span>{" "}
                {existingProduct.nama}
              </p>
              <p>
                <span className="font-medium">Stok saat ini:</span>{" "}
                <span className="font-semibold text-blue-600">
                  {existingProduct.stok}
                </span>{" "}
                {existingProduct.satuan}
              </p>
            </div>
          </div>

          {/* Data baru */}
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Data yang akan ditambahkan:
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Stok tambahan:</span>{" "}
                <span className="font-semibold text-green-600">
                  {newData.stok}
                </span>{" "}
                {newData.satuan}
              </p>
              <p>
                <span className="font-medium">Total stok setelah:</span>{" "}
                <span className="font-semibold text-green-600">
                  {totalStokBaru}
                </span>{" "}
                {newData.satuan}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">Pilih salah satu opsi:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <span className="font-medium">Tambah Stok:</span> Menambah stok
                produk yang sudah ada
              </li>
              <li>
                <span className="font-medium">Tambah Baru:</span> Membuat produk
                baru dengan nama yang sama (tidak disarankan)
              </li>
            </ul>
          </div>
        </div>

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
            onClick={handleAddNew}
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : "Tambah Baru"}
          </Button>
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleAddStok}
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : "Tambah Stok"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
