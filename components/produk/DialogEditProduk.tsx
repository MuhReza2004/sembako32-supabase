"use client";

import React, { useEffect } from "react";
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
import { ProdukFormData, Produk } from "@/app/types/produk";

interface DialogEditProdukProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProdukFormData) => Promise<void>;
  produk: Produk | null;
  isLoading?: boolean;
}

const SATUAN_OPTIONS = [
  { value: "Sak", label: "Sak" },
  { value: "Pcs", label: "Pcs" },
  { value: "Kg", label: "Kg" },
  { value: "Liter", label: "Liter" },
  { value: "Dus", label: "Dus" },
];

export const DialogEditProduk: React.FC<DialogEditProdukProps> = ({
  open,
  onOpenChange,
  onSubmit,
  produk,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProdukFormData>({
    defaultValues: produk || {
      kode: "",
      nama: "",
      satuan: "Pcs",
      kategori: "",
      status: "aktif",
    },
  });

  const onSubmitForm = async (data: ProdukFormData) => {
    await onSubmit(data);
  };

  useEffect(() => {
    if (produk && open) {
      reset(produk);
    }
  }, [produk, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Produk</DialogTitle>
          <DialogDescription>
            Perbarui informasi produk di bawah ini.
          </DialogDescription>
        </DialogHeader>

        {produk && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
            ID Produk:{" "}
            <span className="font-mono font-semibold">{produk.id}</span>
          </div>
        )}

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
                <p className="text-sm text-red-500">{errors.satuan.message}</p>
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
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Menyimpan..." : "Update Produk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
