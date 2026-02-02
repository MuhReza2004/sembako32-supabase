"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Produk } from "@/app/types/produk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produk: Produk | null;
}

export default function DialogDetailProduk({
  open,
  onOpenChange,
  produk,
}: Props) {
  if (!produk) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detail Produk</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Nama Produk
            </label>
            <p className="text-lg font-semibold">{produk.nama}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Satuan</label>
            <p>{produk.satuan}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Badge
              variant={produk.status === "aktif" ? "default" : "secondary"}
            >
              {produk.status}
            </Badge>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Dibuat Pada
            </label>
            <p>
              {produk.createdAt
                ? new Date(produk.createdAt).toLocaleDateString("id-ID")
                : "-"}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Diubah Pada
            </label>
            <p>
              {produk.updatedAt
                ? new Date(produk.updatedAt).toLocaleDateString("id-ID")
                : "-"}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
