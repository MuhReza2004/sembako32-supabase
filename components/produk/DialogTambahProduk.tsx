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
import { ProdukFormData } from "@/app/types/produk";
import { getNewKodeProduk } from "@/app/services/produk.service";

interface DialogTambahProdukProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProdukFormData) => Promise<void>;
  isLoading?: boolean;
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
  onSubmit,
  isLoading = false,
}) => {
  const [hargaJualFormatted, setHargaJualFormatted] = useState("");

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
    },
  });

  useEffect(() => {
    if (open) {
      reset(); // Reset form on open
    }
  }, [open, reset]);

  const onSubmitForm = async (data: ProdukFormData) => {
    const kode = await getNewKodeProduk();
    const dataWithKode = { ...data, kode };
    await onSubmit(dataWithKode);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Produk Baru</DialogTitle>
          <DialogDescription>
            Isi informasi produk di bawah ini. Kode Produk akan dibuat otomatis.
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
              {isLoading ? "Menyimpan..." : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
