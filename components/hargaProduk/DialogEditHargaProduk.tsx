"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SupplierProduk, SupplierProdukFormData } from "@/app/types/suplyer";
import { updateSupplierProduk } from "@/app/services/supplierProduk.service";
import { getAllSuppliers } from "@/app/services/supplyer.service";
import { getAllProduk } from "@/app/services/produk.service";
import { Supplier } from "@/app/types/suplyer";
import { Produk } from "@/app/types/produk";
import { formatRupiah } from "@/helper/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SupplierProduk | null;
  onSuccess?: () => void;
}

export default function DialogEditHargaProduk({
  open,
  onOpenChange,
  item,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [displayPrice, setDisplayPrice] = useState("");
  const [displaySellPrice, setDisplaySellPrice] = useState("");
  const [margin, setMargin] = useState(0);
  const [marginPercentage, setMarginPercentage] = useState(0);

  const [formData, setFormData] = useState<SupplierProdukFormData>({
    supplierId: "",
    produkId: "",
    hargaBeli: 0,
    hargaJual: 0,
    stok: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      const [sups, prods] = await Promise.all([
        getAllSuppliers(),
        getAllProduk(),
      ]);
      setSuppliers(sups);
      setProducts(prods);
    };
    if (open) fetchData();
  }, [open]);

  useEffect(() => {
    if (item) {
      setFormData({
        supplierId: item.supplierId,
        produkId: item.produkId,
        hargaBeli: item.hargaBeli,
        hargaJual: item.hargaJual,
        stok: item.stok,
      });
      setDisplayPrice(formatRupiah(item.hargaBeli));
      setDisplaySellPrice(formatRupiah(item.hargaJual));
      const newMargin = item.hargaJual - item.hargaBeli;
      setMargin(newMargin);
      setMarginPercentage(
        item.hargaBeli > 0 ? (newMargin / item.hargaBeli) * 100 : 0,
      );
    }
  }, [item]);

  const handlePriceChange = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d]/g, "");
    const numberValue = parseInt(numericValue) || 0;

    setFormData((p) => {
      const newFormData = { ...p, hargaBeli: numberValue };
      const newMargin = newFormData.hargaJual - newFormData.hargaBeli;
      setMargin(newMargin);
      setMarginPercentage(
        newFormData.hargaBeli > 0
          ? (newMargin / newFormData.hargaBeli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplayPrice(formatRupiah(numberValue));
  };

  const handleSellPriceChange = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d]/g, "");
    const numberValue = parseInt(numericValue) || 0;

    setFormData((p) => {
      const newFormData = { ...p, hargaJual: numberValue };
      const newMargin = newFormData.hargaJual - newFormData.hargaBeli;
      setMargin(newMargin);
      setMarginPercentage(
        newFormData.hargaBeli > 0
          ? (newMargin / newFormData.hargaBeli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplaySellPrice(formatRupiah(numberValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);

    await updateSupplierProduk(item.id, formData);

    setLoading(false);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Supplier Produk</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Supplier *</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, supplierId: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Produk *</Label>
            <Select
              value={formData.produkId}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, produkId: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Produk" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Harga Beli *</Label>
            <Input
              value={displayPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="Rp 0"
              required
            />
          </div>

          <div>
            <Label>Harga Jual *</Label>
            <Input
              value={displaySellPrice}
              onChange={(e) => handleSellPriceChange(e.target.value)}
              placeholder="Rp 0"
              required
            />
          </div>

          <div>
            <Label>Margin</Label>
            <Input value={formatRupiah(margin)} readOnly placeholder="Rp 0" />
          </div>

          <div>
            <Label>Margin (%)</Label>
            <Input
              value={`${marginPercentage.toFixed(2)}%`}
              readOnly
              placeholder="0.00%"
            />
          </div>

          <div>
            <Label>Stok Fisik *</Label>
            <Input
              type="number"
              value={formData.stok}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  stok: parseInt(e.target.value) || 0,
                }))
              }
              placeholder="0"
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
