"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Supplier, SupplierFormData } from "@/app/types/supplier";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSave: (supplier: Supplier) => void;
}

export default function EditSupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSave,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>();
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (supplier) {
      reset(supplier);
      setError("");
    }
  }, [supplier, reset]);

  const onSubmit = (data: SupplierFormData) => {
    if (!supplier) return;
    onSave({ ...supplier, ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
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
              {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
