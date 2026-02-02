"use client";

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { PelangganFormData, Pelanggan } from "@/app/types/pelanggan";

interface DialogEditPelangganProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PelangganFormData) => Promise<void>;
  pelanggan: Pelanggan | null;
  isLoading?: boolean;
}

const SATUAN_OPTIONS = [
  { value: "sak", label: "Sak" },
  { value: "pcs", label: "Pcs" },
  { value: "kg", label: "Kg" },
  { value: "liter", label: "Liter" },
];

export const DialogEditPelanggan: React.FC<DialogEditPelangganProps> = ({
  open,
  onOpenChange,
  onSubmit,
  pelanggan,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PelangganFormData>({
    defaultValues: pelanggan || {
      namaPelanggan: "",
      kodePelanggan: "",
      alamat: "",
      noTelp: "",
      email: "",
      status: "aktif",
    },
  });

  const onSubmitForm = async (data: PelangganFormData) => {
    await onSubmit(data);
  };

  useEffect(() => {
    if (pelanggan && open) {
      reset(pelanggan);
    }
  }, [pelanggan, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pelanggan</DialogTitle>
          <DialogDescription>
            Perbarui informasi pelanggan di bawah ini.
          </DialogDescription>
        </DialogHeader>

        {pelanggan && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
            ID Pelanggan:{" "}
            <span className="font-mono font-semibold">
              {pelanggan.idPelanggan}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Row 1: Nama & Kode */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="namaPelanggan" className="font-semibold">
                Nama Pelanggan *
              </Label>
              <Input
                id="namaPelanggan"
                placeholder="Masukkan nama pelanggan"
                {...register("namaPelanggan", {
                  required: "Nama pelanggan wajib diisi",
                  minLength: { value: 3, message: "Minimal 3 karakter" },
                })}
                className={errors.namaPelanggan ? "border-red-500" : ""}
              />
              {errors.namaPelanggan && (
                <p className="text-sm text-red-500">
                  {errors.namaPelanggan.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kodePelanggan" className="font-semibold">
                Kode Pelanggan
              </Label>
              <Input
                id="kodePelanggan"
                {...register("kodePelanggan")}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500">Kode tidak dapat diubah</p>
            </div>
          </div>

          {/* Row 2: Nama Toko & NIB*/}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="namaToko" className="font-semibold">
                Nama Toko *
              </Label>
              <Input
                id="namaToko"
                placeholder="Misal: Toko ABC"
                {...register("namaToko", {
                  required: "Nama toko wajib diisi",
                  minLength: { value: 3, message: "Minimal 3 karakter" },
                })}
                className={errors.namaToko ? "border-red-500" : ""}
              />
              {errors.namaToko && (
                <p className="text-sm text-red-500">
                  {errors.namaToko.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nib" className="font-semibold">
                NIB(nomor Induk Berusaha)
              </Label>
              <Input
                id="nib"
                placeholder="Misal: 1234567890"
                {...register("nib", {
                  required: "NIB wajib diisi",
                  minLength: { value: 10, message: "Minimal 10 karakter" },
                })}
                className={errors.nib ? "border-red-500" : ""}
              />
              {errors.nib && (
                <p className="text-sm text-red-500">{errors.nib.message}</p>
              )}
            </div>
          </div>
          {/* Row 2: No Telp & Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="noTelp" className="font-semibold">
                Nomor Telepon *
              </Label>
              <Input
                id="noTelp"
                placeholder="Misal: 081234567890"
                {...register("noTelp", {
                  required: "Nomor telepon wajib diisi",
                  minLength: { value: 10, message: "Minimal 10 angka" },
                })}
                className={errors.noTelp ? "border-red-500" : ""}
              />
              {errors.noTelp && (
                <p className="text-sm text-red-500">{errors.noTelp.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Misal: pelanggan@email.com"
                {...register("email", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Format email tidak valid",
                  },
                })}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Row 3: Alamat */}
          <div className="space-y-2">
            <Label htmlFor="alamat" className="font-semibold">
              Alamat *
            </Label>
            <textarea
              id="alamat"
              placeholder="Masukkan alamat lengkap"
              {...register("alamat", {
                required: "Alamat wajib diisi",
                minLength: { value: 5, message: "Minimal 5 karakter" },
              })}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                errors.alamat ? "border-red-500" : "border-gray-300"
              }`}
              rows={3}
            />
            {errors.alamat && (
              <p className="text-sm text-red-500">{errors.alamat.message}</p>
            )}
          </div>

          {/* Status */}
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
              {isLoading ? "Menyimpan..." : "Update Pelanggan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
