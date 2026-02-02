"use client";

import { useState } from "react";
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

import { SupplierFormData } from "@/app/types/suplyer";
import { addSupplier, getAllSuppliers } from "@/app/services/supplyer.service";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [formData, setFormData] = useState<SupplierFormData>({
    kode: "",
    nama: "",
    alamat: "",
    telp: "",
    status: true,
  });

  /* =====================
     SUBMIT
     ===================== */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Fetch all existing suppliers to check for duplicates
      const existingSuppliers = await getAllSuppliers();

      // Check for duplicate name (case-insensitive)
      const isDuplicate = existingSuppliers.some(
        (supplier) =>
          supplier.nama.toLowerCase() === formData.nama.toLowerCase(),
      );

      if (isDuplicate) {
        setError(
          "Nama supplier sudah terdaftar. Silakan gunakan nama yang berbeda.",
        );
        setLoading(false);
        return;
      }

      // Generate kode automatically
      const kode = `SUP-${Date.now()}`;
      const dataWithKode = { ...formData, kode };

      await addSupplier(dataWithKode);

      setLoading(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding supplier:", error);
      setError(
        "Terjadi kesalahan saat menambahkan supplier. Silakan coba lagi.",
      );
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Supplier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nama Supplier</Label>
            <Input
              value={formData.nama}
              onChange={(e) => {
                setFormData((p) => ({ ...p, nama: e.target.value }));
                setError(""); // Clear error when user starts typing
              }}
              required
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>

          <div>
            <Label>Alamat</Label>
            <Input
              value={formData.alamat}
              onChange={(e) =>
                setFormData((p) => ({ ...p, alamat: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <Label>Telepon</Label>
            <Input
              value={formData.telp}
              onChange={(e) =>
                setFormData((p) => ({ ...p, telp: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Status Aktif</Label>
            <Switch
              checked={formData.status}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, status: checked }))
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
