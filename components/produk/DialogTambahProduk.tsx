"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Produk, ProdukFormData } from "@/app/types/produk";
import {
  getNewKodeProduk,
  addProduk,
  getProdukByName,
  updateProdukStok,
} from "@/app/services/produk.service";
import { DialogProdukDuplikat } from "./DialogProdukDuplikat"; // Import the duplicate dialog
import { useStatus } from "@/components/ui/StatusProvider";

interface DialogTambahProdukProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean; // Prop from parent for overall loading state
  onStatusReport: ReturnType<typeof useStatus>["showStatus"]; // New prop for status reporting
}

const SATUAN_OPTIONS = [
  { value: "Sak", label: "Sak" },
  { value: "Pcs", label: "Pcs" },
  { value: "Kg", label: "Kg" },
  { value: "Liter", label: "Liter" },
  { value: "Dus", label: "Dus" },
];

export const DialogTambahProduk: React.FC<DialogTambahProdukProps> = ({
  open,
  onOpenChange,
  isLoading: parentLoading = false,
  onStatusReport,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false); // Internal loading state for this dialog
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [existingProductData, setExistingProductData] = useState<Produk | null>(
    null,
  );
  const [newDataForDuplicate, setNewDataForDuplicate] =
    useState<ProdukFormData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProdukFormData>({
    defaultValues: {
      kode: "",
      nama: "",
      satuan: "Pcs",
      kategori: "",
      status: "aktif",
      stok: 0, // Ensure stok has a default value
    },
  });

  useEffect(() => {
    if (open) {
      reset(); // Reset form on open
      setExistingProductData(null);
      setNewDataForDuplicate(null);
      setShowDuplicateDialog(false);
    }
  }, [open, reset]);

  const onSubmitForm = async (data: ProdukFormData) => {
    setIsSubmitting(true);
    try {
      const existingProduct = await getProdukByName(data.nama);

      if (existingProduct) {
        setExistingProductData(existingProduct);
        setNewDataForDuplicate(data);
        setShowDuplicateDialog(true);
      } else {
        // No duplicate, proceed to add new product
        const kode = await getNewKodeProduk();
        await addProduk({ ...data, kode });
        onOpenChange(false);
        onStatusReport({
          message: "Produk berhasil ditambahkan",
          success: true,
          refresh: true,
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to add produk:", error);
      onStatusReport({
        message: "Gagal menambahkan produk: " + errorMessage,
        success: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToExistingStock = async () => {
    if (!existingProductData || !newDataForDuplicate) return;

    setIsSubmitting(true);
    try {
      const updatedStok = existingProductData.stok + newDataForDuplicate.stok;
      await updateProdukStok(existingProductData.id, updatedStok);
      onOpenChange(false);
      onStatusReport({
        message: "Stok produk berhasil diperbarui",
        success: true,
        refresh: true,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to update stock:", error);
      onStatusReport({
        message: "Gagal memperbarui stok: " + errorMessage,
        success: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewDuplicate = async () => {
    if (!newDataForDuplicate) return;

    setIsSubmitting(true);
    try {
      const kode = await getNewKodeProduk();
      await addProduk({ ...newDataForDuplicate, kode });
      onOpenChange(false);
      onStatusReport({
        message: "Produk baru berhasil ditambahkan",
        success: true,
        refresh: true,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to add new duplicate produk:", error);
      onStatusReport({
        message: "Gagal menambahkan produk baru: " + errorMessage,
        success: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentLoading = parentLoading || isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Produk Baru</DialogTitle>
            <DialogDescription>
              Isi informasi produk di bawah ini. Kode Produk akan dibuat
              otomatis.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nama" className="font-semibold">
                Nama Produk *
              </Label>
              <Input
                id="nama"
                placeholder="Masukkan nama produk"
                {...register("nama", {
                  required: "Nama produk wajib diisi",
                  minLength: { value: 3, message: "Minimal 3 karakter" },
                })}
                className={errors.nama ? "border-red-500" : ""}
              />
              {errors.nama && (
                <p className="text-sm text-red-500">{errors.nama.message}</p>
              )}
            </div>
            {/* Added Stock Input */}
            <div className="space-y-2">
              <Label htmlFor="stok" className="font-semibold">
                Stok Awal *
              </Label>
              <Input
                id="stok"
                type="number"
                min={0}
                placeholder="Masukkan jumlah stok awal"
                {...register("stok", {
                  required: "Stok awal wajib diisi",
                  min: { value: 0, message: "Stok tidak bisa negatif" },
                  valueAsNumber: true,
                })}
                className={errors.stok ? "border-red-500" : ""}
              />
              {errors.stok && (
                <p className="text-sm text-red-500">{errors.stok.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="satuan" className="font-semibold">
                  Satuan *
                </Label>
                <select
                  id="satuan"
                  {...register("satuan", { required: "Satuan wajib dipilih" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SATUAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.satuan && (
                  <p className="text-sm text-red-500">
                    {errors.satuan.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="kategori" className="font-semibold">
                  Kategori *
                </Label>
                <Input
                  id="kategori"
                  placeholder="Masukkan kategori"
                  {...register("kategori", {
                    required: "Kategori wajib diisi",
                  })}
                  className={errors.kategori ? "border-red-500" : ""}
                />
                {errors.kategori && (
                  <p className="text-sm text-red-500">
                    {errors.kategori.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="font-semibold">
                Status *
              </Label>
              <select
                id="status"
                {...register("status")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={currentLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={currentLoading}>
                {currentLoading ? "Menyimpan..." : "Tambah Produk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DialogProdukDuplikat
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        existingProduct={existingProductData}
        newData={newDataForDuplicate}
        onAddStok={handleAddToExistingStock}
        onAddNew={handleAddNewDuplicate}
        isLoading={currentLoading}
      />
    </>
  );
};
