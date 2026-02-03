"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createPenjualan,
  updatePenjualan,
  generateInvoiceNumber,
  generateNPBNumber,
  generateDONumber,
} from "@/app/services/penjualan.service";
import { PenjualanDetail, Penjualan } from "@/app/types/penjualan";
import { SupplierProduk } from "@/app/types/suplyer";
import { Produk } from "@/app/types/produk";
import { Pelanggan } from "@/app/types/pelanggan";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/app/lib/supabase";
import { formatRupiah } from "@/helper/format";
import {
  AlertCircle,
  Plus,
  Trash2,
  Receipt,
  ArrowLeft,
  Save,
  ShoppingCart,
  Package,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ComboboxPelanggan } from "@/components/ui/combobox-pelanggan";
import { ComboboxSupplierProduk } from "@/components/ui/combobox-supplier-produk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function TambahPenjualanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [isFormReady, setIsFormReady] = useState(false);
  const [pelangganId, setPelangganId] = useState("");
  const [catatan, setCatatan] = useState("");
  const [noInvoice, setNoInvoice] = useState("Generating...");
  const [noNpb, setNoNpb] = useState("Generating...");
  const [noDo, setNoDo] = useState("Generating...");
  const [metodePengambilan, setMetodePengambilan] = useState<
    "Ambil Langsung" | "Diantar"
  >("Ambil Langsung");
  const [supplierProdukList, setSupplierProdukList] = useState<
    SupplierProduk[]
  >([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [items, setItems] = useState<PenjualanDetail[]>([]);
  const [currentItem, setCurrentItem] = useState<{
    supplier_produk_id: string;
    qty: number;
  }>({
    supplier_produk_id: "",
    qty: 1,
  });
  const [status, setStatus] = useState<"Lunas" | "Belum Lunas" | "Batal">(
    "Lunas",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPenjualan, setEditingPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [metodePembayaran, setMetodePembayaran] = useState("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState("");
  const [pajakEnabled, setPajakEnabled] = useState(false);
  const [diskon, setDiskon] = useState(0);

  const resetForm = async () => {
    setIsFormReady(false);
    setPelangganId("");
    setCatatan("");
    setItems([]);
    setStatus("Lunas");
    setMetodePembayaran("");
    setMetodePengambilan("Ambil Langsung");
    setTanggalJatuhTempo("");
    setPajakEnabled(false);
    setDiskon(0);
    setError(null);
    if (!editId) {
      const [invoiceNum, npbNum, doNum] = await Promise.all([
        generateInvoiceNumber(),
        generateNPBNumber(),
        generateDONumber(),
      ]);
      setNoInvoice(invoiceNum);
      setNoNpb(npbNum);
      setNoDo(doNum);
    }
    setIsFormReady(true);
  };

  useEffect(() => {
    const fetchAndSetData = async () => {
      setIsLoading(true);
      setIsFormReady(false);
      const { data: supplierProds, error: spError } = await supabase
        .from("supplier_produk")
        .select("*, produk(*)");
      if (spError) console.error("Error fetching supplier_produk", spError);
      else setSupplierProdukList(supplierProds as SupplierProduk[]);

      const { data: prods, error: pError } = await supabase
        .from("produk")
        .select("*")
        .eq("status", "aktif");
      if (pError) console.error("Error fetching produk", pError);
      else setProdukList(prods as Produk[]);

      const { data: allPelanggan, error: pelError } = await supabase
        .from("pelanggan")
        .select("*");
      if (pelError) console.error("Error fetching pelanggan", pelError);
      else setPelangganList(allPelanggan as Pelanggan[]);

      if (editId) {
        const { data: penjualan, error: singlePenjualanError } = await supabase
          .from("penjualan")
          .select("*, penjualan_detail(*)")
          .eq("id", editId)
          .single();

        if (singlePenjualanError) {
          setError("Gagal memuat data penjualan untuk diedit.");
        } else if (penjualan) {
          setEditingPenjualan(penjualan as Penjualan);
          setPelangganId(penjualan.pelanggan_id);
          setCatatan(penjualan.catatan || "");
          setNoInvoice(penjualan.no_invoice);
          setNoNpb(penjualan.no_npb);
          setNoDo(penjualan.no_do || "");
          setMetodePengambilan(penjualan.metode_pengambilan);
          setItems(penjualan.penjualan_detail || []);
          setStatus(penjualan.status as "Lunas" | "Belum Lunas" | "Batal");
          setMetodePembayaran(penjualan.metode_pembayaran || "");
          setTanggalJatuhTempo(penjualan.tanggal_jatuh_tempo || "");
          setPajakEnabled(penjualan.pajak_enabled || false);
          setDiskon(penjualan.diskon || 0);
        }
        setIsFormReady(true);
      } else {
        await resetForm();
      }
      setIsLoading(false);
    };

    fetchAndSetData();
  }, [editId]);

  const addItemToList = () => {
    if (!currentItem.supplier_produk_id || currentItem.qty <= 0) {
      return setError("Pilih produk dan masukkan jumlah yang valid");
    }
    const supplierProduk = supplierProdukList.find(
      (sp) => sp.id === currentItem.supplier_produk_id,
    );
    if (!supplierProduk) return setError("Produk tidak ditemukan");
    const produk = (supplierProduk as any).produk;
    if (currentItem.qty > supplierProduk.stok) {
      return setError(
        `Stok ${produk?.nama || "Produk"} tidak mencukupi (sisa: ${supplierProduk.stok})`,
      );
    }

    const existingIndex = items.findIndex(
      (item) => item.supplier_produk_id === currentItem.supplier_produk_id,
    );

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].qty += currentItem.qty;
      newItems[existingIndex].subtotal =
        newItems[existingIndex].harga * newItems[existingIndex].qty;
      setItems(newItems);
    } else {
      setItems([
        ...items,
        {
          id: "",
          pembelian_id: "",
          supplier_produk_id: currentItem.supplier_produk_id,
          qty: currentItem.qty,
          harga: supplierProduk.harga_jual,
          subtotal: supplierProduk.harga_jual * currentItem.qty,
          namaProduk: produk?.nama,
          satuan: produk?.satuan,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setCurrentItem({ supplier_produk_id: "", qty: 1 });
    setError(null);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const { subTotal, totalPajak, total } = useMemo(() => {
    const subTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const totalSetelahDiskon = subTotal - diskon;
    const totalPajak = pajakEnabled ? totalSetelahDiskon * 0.11 : 0;
    const total = totalSetelahDiskon + totalPajak;
    return { subTotal, totalPajak, total };
  }, [items, diskon, pajakEnabled]);

  const submit = async () => {
    setError(null);
    if (!pelangganId) return setError("Pilih pelanggan terlebih dahulu");
    if (items.length === 0) return setError("Pastikan ada produk yang dipilih");

    setIsLoading(true);
    try {
      const penjualanData = {
        tanggal:
          editingPenjualan?.tanggal || new Date().toISOString().split("T")[0],
        pelanggan_id: pelangganId,
        catatan: catatan,
        no_invoice: noInvoice,
        no_npb: noNpb,
        metode_pengambilan: metodePengambilan,
        total: subTotal,
        status: status,
        items: items,
        metode_pembayaran: metodePembayaran,
        tanggal_jatuh_tempo: tanggalJatuhTempo,
        pajak_enabled: pajakEnabled,
        pajak: totalPajak,
        diskon: diskon,
        total_akhir: total,
        no_do: metodePengambilan === "Diantar" ? noDo : undefined,
      };

      if (editingPenjualan?.id) {
        await updatePenjualan(editingPenjualan.id, penjualanData as any);
        alert("Penjualan berhasil diperbarui!");
      } else {
        await createPenjualan(penjualanData as any);
        alert("Penjualan berhasil disimpan!");
      }
      router.push("/dashboard/admin/transaksi/penjualan");
    } catch (error: any) {
      console.error("Error during submit:", JSON.stringify(error, null, 2));
      setError(error.message || "Gagal menyimpan penjualan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div className="flex items-center gap-4 mt-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">
                {editingPenjualan ? "Edit" : "Buat"} Transaksi Penjualan
              </h1>
              <p className="text-gray-500">
                Isi detail transaksi untuk membuat penjualan baru.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Card className="border-red-300 bg-red-50 p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-800">Terjadi Kesalahan</h4>
            </div>
            <p className="text-sm text-red-700 mt-2 ml-8">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Informasi Pelanggan & Pengiriman</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pelanggan">Pelanggan</Label>
                  <ComboboxPelanggan
                    pelangganList={pelangganList}
                    value={pelangganId}
                    onChange={setPelangganId}
                  />
                </div>
                <div>
                  <Label htmlFor="metodePengambilan">Metode Pengambilan</Label>
                  <Select
                    onValueChange={(v: any) => setMetodePengambilan(v)}
                    value={metodePengambilan}
                  >
                    <SelectTrigger id="metodePengambilan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ambil Langsung">
                        Ambil Langsung
                      </SelectItem>
                      <SelectItem value="Diantar">Diantar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Tambah Produk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <Label>Pilih Produk</Label>
                    <ComboboxSupplierProduk
                      supplierProdukList={supplierProdukList}
                      produkList={produkList}
                      value={currentItem.supplier_produk_id}
                      onChange={(val) =>
                        setCurrentItem((prev) => ({
                          ...prev,
                          supplier_produk_id: val,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Jumlah</Label>
                    <Input
                      type="text"
                      min={1}
                      value={currentItem.qty}
                      onChange={(e) =>
                        setCurrentItem((prev) => ({
                          ...prev,
                          qty: Number(e.target.value),
                        }))
                      }
                      placeholder="1"
                    />
                  </div>
                </div>
                <Button onClick={addItemToList} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Produk ke Daftar
                </Button>
              </CardContent>
            </Card>

            {items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daftar Produk ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Jumlah</TableHead>
                        <TableHead>Harga</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.namaProduk || "..."}</TableCell>
                          <TableCell>{item.qty}</TableCell>
                          <TableCell>{formatRupiah(item.harga)}</TableCell>
                          <TableCell>{formatRupiah(item.subtotal)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(i)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>3. Pembayaran & Total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Metode Pembayaran</Label>
                  <Select
                    onValueChange={setMetodePembayaran}
                    value={metodePembayaran}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai">Tunai</SelectItem>
                      <SelectItem value="Transfer">Transfer Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Pembayaran</Label>
                  <Select
                    onValueChange={(v: any) => setStatus(v)}
                    value={status}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lunas">Lunas</SelectItem>
                      <SelectItem value="Belum Lunas">Belum Lunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {status === "Belum Lunas" && (
                  <div>
                    <Label>Tanggal Jatuh Tempo</Label>
                    <Input
                      type="date"
                      value={tanggalJatuhTempo}
                      onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Subtotal</span>
                    <span className="font-semibold">
                      {formatRupiah(subTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <Label>Diskon (Rp)</Label>
                    <Input
                      type="number"
                      value={diskon}
                      onChange={(e) => setDiskon(Number(e.target.value))}
                      className="w-28 h-8 text-right"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <Label>Pajak 11%</Label>
                    <Switch
                      checked={pajakEnabled}
                      onCheckedChange={setPajakEnabled}
                    />
                  </div>
                  {pajakEnabled && (
                    <div className="flex justify-between items-center">
                      <span></span>
                      <span className="text-sm">
                        + {formatRupiah(totalPajak)}
                      </span>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total Akhir</span>
                  <span>{formatRupiah(total)}</span>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={submit}
              disabled={
                isLoading || !isFormReady || !pelangganId || items.length === 0
              }
              className="w-full h-12 text-lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {editingPenjualan ? "Perbarui Transaksi" : "Simpan Transaksi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TambahPenjualanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <TambahPenjualanForm />
    </Suspense>
  );
}
