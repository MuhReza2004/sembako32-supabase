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
import { Pelanggan, PelangganFormData } from "@/app/types/pelanggan";
import { AlertTriangle } from "lucide-react";

interface DialogPelangganDuplikatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCustomer: Pelanggan | null;
  newData: PelangganFormData | null;
  onAddNew: () => Promise<void>;
  onSkip: () => Promise<void>;
  isLoading?: boolean;
}

export const DialogPelangganDuplikat: React.FC<
  DialogPelangganDuplikatProps
> = ({
  open,
  onOpenChange,
  existingCustomer,
  newData,
  onAddNew,
  onSkip,
  isLoading = false,
}) => {
  const handleAddNew = async () => {
    await onAddNew();
    onOpenChange(false);
  };

  const handleSkip = async () => {
    await onSkip();
    onOpenChange(false);
  };

  if (!existingCustomer || !newData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Pelanggan Sudah Ada
          </DialogTitle>
          <DialogDescription>
            Pelanggan dengan nomor telepon yang sama sudah terdaftar di sistem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pelanggan yang ada */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Pelanggan yang sudah ada:
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Nama:</span>{" "}
                {existingCustomer.namaPelanggan}
              </p>
              <p>
                <span className="font-medium">No. Telp:</span>{" "}
                <span className="font-semibold text-blue-600">
                  {existingCustomer.noTelp}
                </span>
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {existingCustomer.email || "-"}
              </p>
              <p>
                <span className="font-medium">Alamat:</span>{" "}
                {existingCustomer.alamat}
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
                <span className="font-medium">Nama:</span>{" "}
                <span className="font-semibold text-green-600">
                  {newData.namaPelanggan}
                </span>
              </p>
              <p>
                <span className="font-medium">Alamat:</span> {newData.alamat}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">Pilih salah satu opsi:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <span className="font-medium">Lewati:</span> Jangan tambahkan
                pelanggan ini
              </li>
              <li>
                <span className="font-medium">Tambah Baru:</span> Tambahkan
                pelanggan baru dengan nomor telepon yang sama
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
            onClick={handleSkip}
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : "Lewati"}
          </Button>
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleAddNew}
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : "Tambah Baru"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
