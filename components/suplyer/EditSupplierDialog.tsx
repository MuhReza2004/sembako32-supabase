"use client";

import { getAllSuppliers } from "@/app/services/supplyer.service";
import { useEffect, useState } from "react";
import { Supplier } from "@/app/types/suplyer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [telp, setTelp] = useState("");
  const [status, setStatus] = useState(true);
  const [error, setError] = useState<string>("");

  /* =====================
     INIT DATA
     ===================== */
  useEffect(() => {
    if (supplier) {
      setNama(supplier.nama);
      setAlamat(supplier.alamat);
      setTelp(supplier.telp);
      setStatus(supplier.status);
    }
  }, [supplier]);

  /* =====================
     SAVE
     ===================== */
  const handleSave = async () => {
    if (!supplier) return;

    // Check for duplicate name
    const allSuppliers = await getAllSuppliers();
    const isDuplicate = allSuppliers.some(
      (s) =>
        s.nama.toLowerCase() === nama.toLowerCase() && s.id !== supplier.id,
    );

    if (isDuplicate) {
      setError("Nama supplier sudah terdaftar!");
      return;
    }

    setError("");

    onSave({
      ...supplier,
      nama,
      alamat,
      telp,
      status,
      updatedAt: new Date(),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nama Supplier</Label>
            <Input
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                setError("");
              }}
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>

          <div>
            <Label>Alamat</Label>
            <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </div>

          <div>
            <Label>Telepon</Label>
            <Input value={telp} onChange={(e) => setTelp(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Status Aktif</Label>
            <Switch checked={status} onCheckedChange={setStatus} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>Simpan Perubahan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
