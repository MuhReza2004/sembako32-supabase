"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pembelian } from "@/app/types/pembelian";
import { Supplier, SupplierProduk } from "@/app/types/supplier";
import { Produk } from "@/app/types/produk";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { formatRupiah } from "@/helper/format";

interface DialogKonfirmasiPembelianProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pembelianData: Omit<Pembelian, "id" | "created_at" | "updated_at"> | null;
  supplier: Supplier | null;
  produkList: Produk[];
  supplierProdukList: SupplierProduk[];
  onConfirm: () => void;
  isLoading: boolean;
}

export function DialogKonfirmasiPembelian({
  open,
  onOpenChange,
  pembelianData,
  supplier,
  produkList,
  supplierProdukList,
  onConfirm,
  isLoading,
}: DialogKonfirmasiPembelianProps) {
  if (!pembelianData || !supplier) return null;

  const { tanggal, no_do, no_npb, invoice, items, total } = pembelianData;

  const getProductName = (supplierProdukId: string) => {
    const supplierProduk = supplierProdukList.find(
      (sp) => sp.id === supplierProdukId,
    );
    if (!supplierProduk) return "Produk tidak ditemukan";
    const product = produkList.find((p) => p.id === supplierProduk.produk_id);
    return product?.nama || "Nama produk tidak ada";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Konfirmasi Detail Pembelian</DialogTitle>
          <DialogDescription>
            Harap periksa kembali detail transaksi sebelum melanjutkan.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-background p-4">
              <h3 className="font-semibold">Informasi Dokumen</h3>
              <Separator />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{supplier.nama}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">
                    {/* Ensure tanggal is a valid date string or Date object */}
                    {tanggal
                      ? format(new Date(tanggal), "d MMMM yyyy", { locale: id })
                      : "Invalid Date"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">No. NPB</p>
                  <p className="font-medium">{no_npb || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">No. DO</p>
                  <p className="font-medium">{no_do || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Invoice/Faktur</p>
                  <p className="font-medium">{invoice || "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-4">
              <h3 className="font-semibold">Ringkasan Item</h3>
              <Separator />
              <div className="space-y-2">
                {items?.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center rounded-md p-2 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        {getProductName(item.supplier_produk_id)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.qty} x {formatRupiah(item.harga)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatRupiah(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <p className="text-lg font-bold">Total</p>
                <p className="text-lg font-bold text-primary">
                  {formatRupiah(total)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Memproses..." : "Konfirmasi & Lanjutkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
