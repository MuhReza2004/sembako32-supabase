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
      nama_pelanggan: "",
      kode_pelanggan: "",
      nama_toko: "",
      nib: "",
      alamat: "",
      no_telp: "",
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
              {pelanggan.id_pelanggan}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Row 1: Nama & Kode */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nama_pelanggan" className="font-semibold">
                Nama Pelanggan *
              </Label>
              <Input
                id="nama_pelanggan"
                placeholder="Masukkan nama pelanggan"
                {...register("nama_pelanggan", {
                  required: "Nama pelanggan wajib diisi",
                  minLength: { value: 3, message: "Minimal 3 karakter" },
                })}
                className={errors.nama_pelanggan ? "border-red-500" : ""}
              />
              {errors.nama_pelanggan && (
                <p className="text-sm text-red-500">
                  {errors.nama_pelanggan.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kode_pelanggan" className="font-semibold">
                Kode Pelanggan
              </Label>
              <Input
                id="kode_pelanggan"
                {...register("kode_pelanggan")}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500">Kode tidak dapat diubah</p>
            </div>
          </div>

          {/* Row 2: Nama Toko & NIB*/}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nama_toko" className="font-semibold">
                Nama Toko *
              </Label>
              <Input
                id="nama_toko"
                placeholder="Misal: Toko ABC"
                {...register("nama_toko", {
                  required: "Nama toko wajib diisi",
                  minLength: { value: 3, message: "Minimal 3 karakter" },
                })}
                className={errors.nama_toko ? "border-red-500" : ""}
              />
              {errors.nama_toko && (
                <p className="text-sm text-red-500">
                  {errors.nama_toko.message}
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
                {...register("nib", {})}
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
              <Label htmlFor="no_telp" className="font-semibold">
                Nomor Telepon *
              </Label>
              <Input
                id="no_telp"
                placeholder="Misal: 081234567890"
                {...register("no_telp", {})}
                className={errors.no_telp ? "border-red-500" : ""}
              />
              {errors.no_telp && (
                <p className="text-sm text-red-500">{errors.no_telp.message}</p>
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
