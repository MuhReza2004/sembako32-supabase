"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { SupplierFormData } from "@/app/types/supplier";
import { addSupplier } from "@/app/services/supplier.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function DialogTambahSupplier({
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    defaultValues: {
      kode: "",
      nama: "",
      alamat: "",
      telp: "",
      status: true,
    },
  });
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      reset();
      setError("");
    }
  }, [open, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      await addSupplier(data);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Supplier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Nama Supplier</Label>
            <Input
              {...register("nama", { required: "Nama supplier wajib diisi" })}
            />
            {errors.nama && (
              <p className="text-sm text-red-500 mt-1">
                {errors.nama.message}
              </p>
            )}
          </div>

          <div>
            <Label>Alamat</Label>
            <Input
              {...register("alamat", { required: "Alamat wajib diisi" })}
            />
            {errors.alamat && (
              <p className="text-sm text-red-500 mt-1">
                {errors.alamat.message}
              </p>
            )}
          </div>

          <div>
            <Label>Telepon</Label>
            <Input {...register("telp", { required: "Telepon wajib diisi" })} />
            {errors.telp && (
              <p className="text-sm text-red-500 mt-1">
                {errors.telp.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>Status Aktif</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
