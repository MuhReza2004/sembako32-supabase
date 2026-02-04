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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [displayPrice, setDisplayPrice] = useState("");
  const [displaySellPrice, setDisplaySellPrice] = useState("");
  const [margin, setMargin] = useState(0);
  const [marginPercentage, setMarginPercentage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [formData, setFormData] = useState<SupplierProdukFormData>({
    supplier_id: "",
    produk_id: "",
    harga_beli: 0,
    harga_jual: 0,
    stok: 0,
  });

  const filteredProducts = products.filter((p) =>
    p.nama.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    const fetchData = async () => {
      const [sups, prods] = await Promise.all([
        getAllSuppliers(),
        getAllProduk(),
      ]);
      setSuppliers(sups);
      setProducts(prods);

      // Reset form data when dialog opens
      setFormData({
        supplier_id: preselectedSupplierId || "",
        produk_id: "",
        harga_beli: 0,
        harga_jual: 0,
        stok: 0,
      });
      setDisplayPrice("");
      setDisplaySellPrice("");
      setSearchQuery("");
      setShowDropdown(false);
    };
    if (open) {
      fetchData();
    }
  }, [open, preselectedSupplierId]);

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
      const newMargin = newFormData.harga_jual - newFormData.harga_beli;
      setMargin(newMargin);
      setMarginPercentage(
        newFormData.harga_beli > 0
          ? (newMargin / newFormData.harga_beli) * 100
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
      const newFormData = { ...p, harga_jual: numberValue };
      const newMargin = newFormData.harga_jual - newFormData.harga_beli;
      setMargin(newMargin);
      setMarginPercentage(
        newFormData.harga_beli > 0
          ? (newMargin / newFormData.harga_beli) * 100
          : 0,
      );
      return newFormData;
    });
    setDisplaySellPrice(formatRupiah(numberValue));
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
    } catch (error: any) {
      console.error("Error adding supplier product:", error);
      onStatusReport({
        message: "Gagal menambahkan harga produk: " + error.message,
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
