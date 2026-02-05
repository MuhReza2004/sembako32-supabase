"use client";

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

import { SupplierProdukFormData } from "@/app/types/supplier";
import {
  addSupplierProduk,
  checkSupplierProdukExists,
} from "@/app/services/supplierProduk.service";
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
  onStatusReport: ReturnType<typeof useStatus>["showStatus"]; // New prop for status reporting
  preselectedSupplierId?: string;
}

export default function DialogTambahHargaProduk({
  open,
  onOpenChange,
  onStatusReport,
  preselectedSupplierId,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [formData, setFormData] = useState<SupplierProdukFormData>({
    supplier_id: "",
    produk_id: "",
    harga_beli: 0,
    harga_jual_normal: 0,
    harga_jual_grosir: 0,
    stok: 0,
  });

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.nama.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [products, searchQuery],
  );

  useEffect(() => {
    if (open) {
      // Reset form data when dialog opens
      setFormData({
        supplier_id: preselectedSupplierId || "",
        produk_id: "",
        harga_beli: 0,
        harga_jual_normal: 0,
        harga_jual_grosir: 0,
        stok: 0,
      });
      setDisplayPrice("");
      setDisplaySellPriceNormal("");
      setDisplaySellPriceGrosir("");
      setSearchQuery("");
      setShowDropdown(false);
    }
  }, [open, preselectedSupplierId]);

  useEffect(() => {
    const supportError = suppliersError ?? productsError;
    if (open && supportError) {
      onStatusReport({
        message: "Gagal memuat data supplier/produk: " + supportError.message,
        success: false,
      });
    }
  }, [open, suppliersError, productsError, onStatusReport]);

  useEffect(() => {
    if (formData.produk_id && products.length > 0) {
      const selectedProduct = products.find((p) => p.id === formData.produk_id);
      if (selectedProduct) {
        setSearchQuery(selectedProduct.nama);
      }
    } else if (!formData.produk_id) {
      setSearchQuery("");
    }
  }, [formData.produk_id, products]);

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
    setLoading(true);

    try {
      // Check if supplier-product combination already exists
      const exists = await checkSupplierProdukExists(
        formData.supplier_id,
        formData.produk_id,
      );

      if (exists) {
        onStatusReport({
          message: "Produk dengan supplier yang sama sudah ada. Tidak dapat menambahkan harga produk yang sama.",
          success: false,
        });
        setLoading(false);
        return;
      }

      await addSupplierProduk(formData);

      onStatusReport({
        message: "Harga produk berhasil ditambahkan",
        success: true,
        refresh: true,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error adding supplier product:", error);
      onStatusReport({
        message: "Gagal menambahkan harga produk: " + errorMessage,
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
          <DialogTitle>Tambah Supplier Produk</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Supplier *</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, supplier_id: val }))
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

          <div className="relative">
            <Label>Produk *</Label>
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Cari Produk"
              required
            />
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, produk_id: p.id }));
                      setSearchQuery(p.nama);
                      setShowDropdown(false);
                    }}
                  >
                    {p.nama}
                  </div>
                ))}
              </div>
            )}
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
              type="text"
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
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
