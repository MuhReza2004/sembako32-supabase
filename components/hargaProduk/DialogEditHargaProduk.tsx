import { useState, useEffect, useMemo } from "react";
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

import { SupplierProduk, SupplierProdukFormData } from "@/app/types/supplier";
import { updateSupplierProduk } from "@/app/services/supplierProduk.service";
import { getAllSuppliers } from "@/app/services/supplier.service";
import { getAllProduk } from "@/app/services/produk.service";
import { Supplier } from "@/app/types/supplier";
import { Produk } from "@/app/types/produk";
import { formatRupiah } from "@/helper/format";
import { useStatus } from "@/components/ui/StatusProvider";
import { useCachedList } from "@/hooks/useCachedList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SupplierProduk | null;
  onStatusReport: ReturnType<typeof useStatus>["showStatus"]; // New prop for status reporting
}

export default function DialogEditHargaProduk({
  open,
  onOpenChange,
  item,
  onStatusReport,
}: Props) {
  const [loading, setLoading] = useState(false);
  const {
    data: suppliers,
    error: suppliersError,
  } = useCachedList<Supplier>(getAllSuppliers, {
    enabled: open,
    forceOnEnable: true,
  });
  const {
    data: products,
    error: productsError,
  } = useCachedList<Produk>(getAllProduk, {
    enabled: open,
    forceOnEnable: true,
  });
  const [displayPrice, setDisplayPrice] = useState("");
  const [displaySellPriceNormal, setDisplaySellPriceNormal] = useState("");
  const [displaySellPriceGrosir, setDisplaySellPriceGrosir] = useState("");
  const [marginNormal, setMarginNormal] = useState(0);
  const [marginPercentageNormal, setMarginPercentageNormal] = useState(0);
  const [marginGrosir, setMarginGrosir] = useState(0);
  const [marginPercentageGrosir, setMarginPercentageGrosir] = useState(0);

  const [formData, setFormData] = useState<SupplierProdukFormData>({
    supplier_id: "",
    produk_id: "",
    harga_beli: 0,
    harga_jual_normal: 0,
    harga_jual_grosir: 0,
    stok: 0,
  });

  useEffect(() => {
    const supportError = suppliersError ?? productsError;
    if (open && supportError) {
      onStatusReport({
        message: "Gagal memuat data pendukung: " + supportError.message,
        success: false,
      });
      console.error("Failed to fetch support data:", supportError);
    }
  }, [open, suppliersError, productsError, onStatusReport]);

  useEffect(() => {
    if (open && item) {
      setFormData({
        supplier_id: item.supplier_id,
        produk_id: item.produk_id,
        harga_beli: item.harga_beli,
        harga_jual_normal: item.harga_jual_normal ?? item.harga_jual ?? 0,
        harga_jual_grosir: item.harga_jual_grosir ?? item.harga_jual ?? 0,
        stok: item.stok,
      });
      setDisplayPrice(formatRupiah(item.harga_beli));
      const hargaNormal = item.harga_jual_normal ?? item.harga_jual ?? 0;
      const hargaGrosir = item.harga_jual_grosir ?? item.harga_jual ?? 0;
      setDisplaySellPriceNormal(formatRupiah(hargaNormal));
      setDisplaySellPriceGrosir(formatRupiah(hargaGrosir));
      const newMarginNormal = hargaNormal - item.harga_beli;
      const newMarginGrosir = hargaGrosir - item.harga_beli;
      setMarginNormal(newMarginNormal);
      setMarginPercentageNormal(
        item.harga_beli > 0 ? (newMarginNormal / item.harga_beli) * 100 : 0,
      );
      setMarginGrosir(newMarginGrosir);
      setMarginPercentageGrosir(
        item.harga_beli > 0 ? (newMarginGrosir / item.harga_beli) * 100 : 0,
      );
    }
  }, [open, item, suppliers, products]);

  const supplierOptions = useMemo(() => {
    if (!item?.supplier_id) return suppliers;
    const exists = suppliers.some((s) => s.id === item.supplier_id);
    if (exists) return suppliers;
    const fallbackName = item.supplierNama || item.supplier_id;
    return [{ id: item.supplier_id, nama: fallbackName } as Supplier, ...suppliers];
  }, [suppliers, item]);

  const productOptions = useMemo(() => {
    if (!item?.produk_id) return products;
    const exists = products.some((p) => p.id === item.produk_id);
    if (exists) return products;
    const fallbackName = item.produkNama || item.produk_id;
    return [{ id: item.produk_id, nama: fallbackName } as Produk, ...products];
  }, [products, item]);

  const handlePriceChange = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d]/g, "");
    const numberValue = parseInt(numericValue) || 0;

    setFormData((p) => {
      const newFormData = { ...p, harga_beli: numberValue };
      const newMarginNormal =
        newFormData.harga_jual_normal - newFormData.harga_beli;
      setMarginNormal(newMarginNormal);
      setMarginPercentageNormal(
        newFormData.harga_beli > 0
          ? (newMarginNormal / newFormData.harga_beli) * 100
          : 0,
      );
      const newMarginGrosir =
        newFormData.harga_jual_grosir - newFormData.harga_beli;
      setMarginGrosir(newMarginGrosir);
      setMarginPercentageGrosir(
        newFormData.harga_beli > 0
          ? (newMarginGrosir / newFormData.harga_beli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplayPrice(formatRupiah(numberValue));
  };

  const handleSellPriceNormalChange = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d]/g, "");
    const numberValue = parseInt(numericValue) || 0;

    setFormData((p) => {
      const newFormData = { ...p, harga_jual_normal: numberValue };
      const newMargin = newFormData.harga_jual_normal - newFormData.harga_beli;
      setMarginNormal(newMargin);
      setMarginPercentageNormal(
        newFormData.harga_beli > 0
          ? (newMargin / newFormData.harga_beli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplaySellPriceNormal(formatRupiah(numberValue));
  };

  const handleSellPriceGrosirChange = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, "");
    const numberValue = parseInt(numericValue) || 0;

    setFormData((p) => {
      const newFormData = { ...p, harga_jual_grosir: numberValue };
      const newMargin = newFormData.harga_jual_grosir - newFormData.harga_beli;
      setMarginGrosir(newMargin);
      setMarginPercentageGrosir(
        newFormData.harga_beli > 0
          ? (newMargin / newFormData.harga_beli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplaySellPriceGrosir(formatRupiah(numberValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);

    try {
      await updateSupplierProduk(item.id, formData);
      onStatusReport({
        message: "Harga produk berhasil diperbarui",
        success: true,
        refresh: true,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error updating supplier product:", error);
      onStatusReport({
        message: "Gagal memperbarui harga produk: " + errorMessage,
        success: false,
      });
    } finally {
      setLoading(false);
    }
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
              key={`${item?.id || "edit"}-supplier`}
              value={formData.supplier_id}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, supplier_id: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Supplier" />
              </SelectTrigger>
              <SelectContent>
                {supplierOptions.map((s) => (
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
              key={`${item?.id || "edit"}-produk`}
              value={formData.produk_id}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, produk_id: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Produk" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((p) => (
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
            <Label>Harga Jual Normal *</Label>
            <Input
              value={displaySellPriceNormal}
              onChange={(e) => handleSellPriceNormalChange(e.target.value)}
              placeholder="Rp 0"
              required
            />
          </div>

          <div>
            <Label>Harga Jual Grosir *</Label>
            <Input
              value={displaySellPriceGrosir}
              onChange={(e) => handleSellPriceGrosirChange(e.target.value)}
              placeholder="Rp 0"
              required
            />
          </div>

          <div>
            <Label>Margin Normal</Label>
            <Input
              value={`${formatRupiah(marginNormal)} (${marginPercentageNormal.toFixed(2)}%)`}
              readOnly
              placeholder="Rp 0"
            />
          </div>

          <div>
            <Label>Margin Grosir</Label>
            <Input
              value={`${formatRupiah(marginGrosir)} (${marginPercentageGrosir.toFixed(2)}%)`}
              readOnly
              placeholder="Rp 0"
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
