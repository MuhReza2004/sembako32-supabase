"use client";

import { useEffect, useState } from "react";
import { createPembelian } from "@/app/services/pembelian.service";
import { PembelianDetail } from "@/app/types/pembelian";
import { addProduk } from "@/app/services/produk.service";
import {} from "@/app/services/supplyer.service";
import { Produk, ProdukFormData } from "@/app/types/produk";
import { Supplier, SupplierProduk } from "@/app/types/suplyer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DialogTambahProduk } from "../produk/DialogTambahProduk";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { Trash2, Plus, Package, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { DialogKonfirmasiPembelian } from "./DialogKonfirmasiPembelian";
import { Pembelian } from "@/app/types/pembelian";

interface PembelianFormProps {
  onSuccess?: () => void;
}

export default function PembelianForm({ onSuccess }: PembelianFormProps) {
  const [supplier_id, setSupplierId] = useState("");
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD format
  });
  const [no_do, setNoDO] = useState("");
  const [no_npb, setNoNPB] = useState("");
  const [invoice, setInvoice] = useState("");
  const [supplierProdukList, setSupplierProdukList] = useState<
    SupplierProduk[]
  >([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [items, setItems] = useState<PembelianDetail[]>([]);
  const [isTambahProdukOpen, setIsTambahProdukOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pembelianToConfirm, setPembelianToConfirm] = useState<
    (Omit<Pembelian, "id" | "created_at" | "updated_at" | "namaSupplier"> & { items: PembelianDetail[] }) | null
  >(null);

  useEffect(() => {
    // Supabase real-time subscription for supplierProdukList
    const fetchSupplierProduk = async () => {
      const { data, error } = await supabase
        .from("supplier_produk")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching supplier produk:", error);
      } else {
        setSupplierProdukList(data as SupplierProduk[]);
      }
    };

    fetchSupplierProduk();

    const supplierProdukChannel = supabase
      .channel("supplier_produk-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplier_produk" },
        fetchSupplierProduk,
      )
      .subscribe();

    // Supabase real-time subscription for supplierList
    const fetchSupplier = async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("nama", { ascending: true });
      if (error) {
        console.error("Error fetching suppliers:", error);
      } else {
        setSupplierList(data as Supplier[]);
      }
    };

    fetchSupplier();

    const supplierChannel = supabase
      .channel("suppliers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suppliers" },
        fetchSupplier,
      )
      .subscribe();

    // Supabase real-time subscription for produkList
    const fetchProduk = async () => {
      const { data, error } = await supabase
        .from("produk")
        .select("*")
        .order("nama", { ascending: true });
      if (error) {
        console.error("Error fetching produk:", error);
      } else {
        setProdukList(data as Produk[]);
      }
    };

    fetchProduk();

    const produkChannel = supabase
      .channel("produk-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "produk" },
        fetchProduk,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(supplierProdukChannel);
      supabase.removeChannel(supplierChannel);
      supabase.removeChannel(produkChannel);
    };
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        supplier_produk_id: "",
        qty: 1,
        harga: 0,
        subtotal: 0,
        created_at: new Date().toISOString(), // Add created_at
      },
    ]);
  };

  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[i] as any;
    item[field] = value;

    if (field === "supplier_produk_id") {
      const sp = supplierProdukList.find((x) => x.id === value);
      if (sp) {
        item.harga = sp.harga_beli; // use harga_beli from supplier product
      }
    }

    item.subtotal = item.harga * item.qty;
    setItems(newItems);
  };

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  const handleOpenConfirmDialog = () => {
    if (!supplier_id) {
      alert("Pilih supplier terlebih dahulu");
      return;
    }
    if (items.some((item) => !item.supplier_produk_id || !item.qty)) {
      alert("Pastikan semua produk dan kuantitas terisi");
      return;
    }

    const pembelianData: Omit<Pembelian, "id" | "created_at" | "updated_at" | "namaSupplier"> & { items: PembelianDetail[] } = {
      supplier_id,
      tanggal,
      no_do,
      no_npb,
      invoice,
      total,
      status: "Pending", // default status
      items,
    };
    setPembelianToConfirm(pembelianData);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pembelianToConfirm) return;

    setIsLoading(true);
    try {
      await createPembelian(pembelianToConfirm);

      alert("Pembelian berhasil!");
      setIsConfirmDialogOpen(false);
      setPembelianToConfirm(null);
      setItems([]);
      setNoDO("");
      setNoNPB("");
      setInvoice("");
      setTanggal(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan pembelian");
    } finally {
      setIsLoading(false);
    }
  };

  const checkDuplicateProduct = (nama: string) => {
    if (!nama) return false;
    return produkList.some(
      (p) =>
        p.nama &&
        typeof p.nama === "string" &&
        p.nama.toLowerCase() === nama.toLowerCase(),
    );
  };

  const handleTambahProdukSubmit = async (data: ProdukFormData) => {
    if (checkDuplicateProduct(data.nama)) {
      alert("Produk dengan nama ini sudah ada!");
      return;
    }

    setIsLoading(true);
    try {
      await addProduk(data);

      alert("Produk baru berhasil ditambahkan!");
      setIsTambahProdukOpen(false);
    } catch (error) {
      console.error(error);
      alert("Gagal menambah produk baru");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Informasi Supplier & Dokumen */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold mb-3">
              Informasi Supplier & Dokumen
            </h3>
            <Separator />
          </div>

          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-sm font-medium">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Select
                onValueChange={(val) => setSupplierId(val)}
                value={supplier_id}
              >
                <SelectTrigger id="supplier" suppressHydrationWarning>
                  <SelectValue placeholder="Pilih Supplier" />
                </SelectTrigger>
                <SelectContent suppressHydrationWarning>
                  {supplierList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tanggal" className="text-sm font-medium">
                  Tanggal <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tanggal"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noNPB" className="text-sm font-medium">
                  No. Penerimaan Barang (NPB)
                </Label>
                <Input
                  id="noNPB"
                  placeholder="NPB"
                  value={no_npb}
                  onChange={(e) => setNoNPB(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noDO" className="text-sm font-medium">
                  No. Delivery Order (DO)
                </Label>
                <Input
                  id="noDO"
                  placeholder="DO"
                  value={no_do}
                  onChange={(e) => setNoDO(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice" className="text-sm font-medium">
                  Invoice / Faktur
                </Label>
                <Input
                  id="invoice"
                  placeholder="Invoice"
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Item Pembelian */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Item Pembelian</h3>
              <p className="text-sm text-muted-foreground">
                Tambahkan produk yang dibeli
              </p>
            </div>
            <Button
              onClick={addItem}
              variant="outline"
              size="sm"
              disabled={!supplier_id}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Item
            </Button>
          </div>

          <Separator />

          {items.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 rounded-lg border-2 border-dashed">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground font-medium">
                Belum ada item pembelian
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Pilih supplier dan klik "Tambah Item" untuk memulai
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header - Desktop only */}
              <div className="hidden lg:grid grid-cols-[2.5fr_0.8fr_1.2fr_1.2fr_60px] gap-3 px-4 py-2 bg-primary/5 rounded-md text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Produk</div>
                <div>Qty</div>
                <div>Harga Satuan</div>
                <div>Subtotal</div>
                <div></div>
              </div>

              {/* Items */}
              {items.map((item, i) => (
                <div
                  key={i}
                  className="border-2 rounded-lg p-3 bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[2.5fr_0.8fr_1.2fr_1.2fr_60px] gap-3 items-center">
                    {/* Produk */}
                    <div className="space-y-1.5">
                      <Label className="lg:hidden text-xs font-medium text-muted-foreground">
                        Produk
                      </Label>
                      <Select
                        onValueChange={(val) =>
                          updateItem(i, "supplier_produk_id", val)
                        }
                        value={item.supplier_produk_id}
                      >
                        <SelectTrigger
                          className="h-auto min-h-[36px]"
                          suppressHydrationWarning
                        >
                          <SelectValue
                            placeholder="Pilih Produk"
                            className="whitespace-normal break-words text-left"
                          />
                        </SelectTrigger>

                        <SelectContent
                          className="max-w-[350px]"
                          suppressHydrationWarning
                        >
                          {supplierProdukList
                            .filter((sp) => sp.supplier_id === supplier_id)
                            .map((sp) => {
                              const produk = produkList.find(
                                (p) => p.id === sp.produk_id,
                              );
                              return (
                                <SelectItem
                                  key={sp.id}
                                  value={sp.id}
                                  className="whitespace-normal break-words leading-snug"
                                >
                                  <div className="flex flex-col">
                                    <span>{produk?.nama}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Stok: {sp.stok}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="lg:hidden text-xs font-medium text-muted-foreground">
                        Quantity
                      </Label>
                      <Input
                        type="text"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(i, "qty", Number(e.target.value))
                        }
                        placeholder="Qty"
                        className="h-9"
                      />
                    </div>

                    {/* Harga */}
                    <div className="space-y-1.5">
                      <Label className="lg:hidden text-xs font-medium text-muted-foreground">
                        Harga Satuan
                      </Label>
                      <Input
                        type="text"
                        value={"Rp " + item.harga.toLocaleString("id-ID")}
                        readOnly
                        className="bg-muted/50 h-9"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="space-y-1.5">
                      <Label className="lg:hidden text-xs font-medium text-muted-foreground">
                        Subtotal
                      </Label>
                      <div className="font-semibold text-sm flex items-center h-9 px-3 bg-muted/30 rounded-md">
                        Rp {item.subtotal.toLocaleString("id-ID")}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <div className="flex justify-end lg:justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setItems(items.filter((_, idx) => idx !== i))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Submit */}
        <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t-2 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary/5 p-4 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Total Pembelian
              </p>
              <div className="text-3xl font-bold text-primary">
                Rp {total.toLocaleString("id-ID")}
              </div>
            </div>
            <Button
              onClick={handleOpenConfirmDialog}
              size="lg"
              disabled={isLoading || items.length === 0 || !supplier_id}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {isLoading ? (
                "Memproses..."
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Proses Pembelian
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DialogTambahProduk
        open={isTambahProdukOpen}
        onOpenChange={setIsTambahProdukOpen}
        onSubmit={handleTambahProdukSubmit}
        isLoading={isLoading}
      />

      <DialogKonfirmasiPembelian
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        pembelianData={pembelianToConfirm}
        supplier={supplierList.find((s) => s.id === supplier_id) || null}
        produkList={produkList}
        supplierProdukList={supplierProdukList}
        onConfirm={handleConfirmSubmit}
        isLoading={isLoading}
      />
    </>
  );
}
