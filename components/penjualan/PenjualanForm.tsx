"use client";

import { useEffect, useState, useMemo } from "react";
import {
  createPenjualan,
  updatePenjualan,
  generateInvoiceNumber,
  generateNPBNumber,
  generateDONumber,
} from "@/app/services/penjualan.service";
import { PenjualanDetail, Penjualan } from "@/app/types/penjualan";
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
import { ComboboxProduk } from "@/components/ui/combobox-produk";
import { Card } from "@/components/ui/card";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { formatRupiah } from "@/helper/format";
import {
  AlertCircle,
  Plus,
  Trash2,
  Receipt,
  User,
  Package,
  CreditCard,
  CheckCircle2,
  Truck,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface PenjualanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPenjualan?: Penjualan | null;
}

export default function PenjualanForm({
  open,
  onOpenChange,
  onSuccess,
  editingPenjualan,
}: PenjualanFormProps) {
  const [pelanggan_id, setPelangganId] = useState("");
  const [nama_pelanggan, setNamaPelanggan] = useState("");
  const [nama_toko, setNamaToko] = useState("");
  const [alamat_pelanggan, setAlamatPelanggan] = useState("");
  const [no_invoice, setInvoiceNumber] = useState("");
  const [no_npb, setNpbNumber] = useState("");
  const [no_do, setDoNumber] = useState("");
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [items, setItems] = useState<PenjualanDetail[]>([]);
  const [status, setStatus] = useState<"Lunas" | "Belum Lunas">("Lunas");
  const [metode_pembayaran, setMetodePembayaran] = useState<
    "Tunai" | "Transfer"
  >("Tunai");
  const [metode_pengambilan, setMetodePengambilan] = useState<
    "Ambil Langsung" | "Diantar"
  >("Ambil Langsung");
  const [nomor_rekening, setNomorRekening] = useState("");
  const [nama_bank, setNamaBank] = useState("");
  const [nama_pemilik_rekening, setNamaPemilikRekening] = useState("");
  const [diskon, setDiskon] = useState(0);
  const [pajak_enabled, setPajakEnabled] = useState(true);
  const [tanggal_jatuh_tempo, setTanggalJatuhTempo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setPelangganId("");
    setNamaPelanggan("");
    setNamaToko("");
    setAlamatPelanggan("");
    setItems([]);
    setStatus("Lunas");
    setMetodePembayaran("Tunai");
    setMetodePengambilan("Ambil Langsung");
    setNomorRekening("1953017106");
    setNamaBank("BNI");
    setNamaPemilikRekening("RIZAL");
    setDiskon(0);
    setPajakEnabled(true);
    setTanggalJatuhTempo("");
    setError(null);
    if (!editingPenjualan) {
      generateInvoiceNumber().then(setInvoiceNumber);
      generateNPBNumber().then(setNpbNumber);
      generateDONumber().then(setDoNumber);
    }
  };

  useEffect(() => {
    if (open) {
      if (editingPenjualan) {
        // Populate form with existing data for editing
        const penj = editingPenjualan as Penjualan;
        setPelangganId(penj.pelanggan_id);
        setNamaPelanggan(penj.namaPelanggan || ""); // Keep for display
        setNamaToko(penj.namaPelanggan || ""); // Assuming namaToko maps to namaPelanggan if not present
        setAlamatPelanggan(penj.alamatPelanggan || ""); // Keep for display
        setInvoiceNumber(penj.no_invoice || "");
        setNpbNumber(penj.no_npb || "");
        setDoNumber(penj.no_do || "");
        setMetodePengambilan(penj.metode_pengambilan || "Ambil Langsung");
        setItems(penj.items || []);
        setStatus((penj.status as "Lunas" | "Belum Lunas") || "Lunas");
        setMetodePembayaran(
          (penj.metode_pembayaran as "Tunai" | "Transfer") || "Tunai",
        );
        setNomorRekening(penj.nomor_rekening || "");
        setNamaBank(penj.nama_bank || "");
        setNamaPemilikRekening(penj.nama_pemilik_rekening || "");
        setDiskon(penj.diskon || 0);
        setPajakEnabled(penj.pajak_enabled ?? true);
        setTanggalJatuhTempo(penj.tanggal_jatuh_tempo || "");
        setError(null);
      } else {
        resetForm();
      }
    }

    // Supabase real-time subscription for produkList
    const fetchProduk = async () => {
      const { data, error } = await supabase
        .from("produk")
        .select("*")
        .order("nama", { ascending: true });
      if (error) {
        console.error("Error fetching produk:", error);
      } else {
        setProdukList(data.filter((p) => p.status === "aktif") as Produk[]);
      }
    };

    const produkSubscription = supabase
      .from("produk")
      .on("*", (payload) => {
        fetchProduk(); // Re-fetch all produk on any change
      })
      .subscribe();

    fetchProduk(); // Initial fetch

    // Supabase real-time subscription for pelangganList
    const fetchPelanggan = async () => {
      const { data, error } = await supabase
        .from("pelanggan")
        .select("*")
        .order("nama_pelanggan", { ascending: true });
      if (error) {
        console.error("Error fetching pelanggan:", error);
      } else {
        setPelangganList(data as Pelanggan[]);
      }
    };

    const pelangganSubscription = supabase
      .from("pelanggan")
      .on("*", (payload) => {
        fetchPelanggan(); // Re-fetch all pelanggan on any change
      })
      .subscribe();

    fetchPelanggan(); // Initial fetch

    return () => {
      supabase.removeSubscription(produkSubscription);
      supabase.removeSubscription(pelangganSubscription);
    };
  }, [open, editingPenjualan]);

  const addItem = () => {
    setItems([
      ...items,
      {
        supplier_produk_id: "",
        namaProduk: "",
        satuan: "",
        harga: 0,
        qty: 1,
        subtotal: 0,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[i];
    (item as any)[field] = value;

    // Use `supplier_produk_id` here
    const produk = produkList.find((p) => p.id === item.supplier_produk_id);

    if (field === "supplier_produk_id" && produk) {
      item.namaProduk = produk.nama;
      item.harga = (produk as any).harga_jual || 0; // Assuming produk also has harga_jual now or fetch it
      item.satuan = produk.satuan;
    }

    if (produk && item.qty > produk.stok) {
      setError(`Stok ${produk.nama} tidak mencukupi (sisa: ${produk.stok})`);
      item.qty = produk.stok;
    } else {
      setError(null);
    }

    item.subtotal = item.harga * item.qty;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.subtotal, 0),
    [items],
  );

  const pajak = useMemo(() => {
    if (!pajak_enabled) return 0;
    return (subtotal - diskon) * 0.11;
  }, [subtotal, diskon, pajak_enabled]);

  const totalAkhir = useMemo(
    () => subtotal - diskon + pajak,
    [subtotal, diskon, pajak],
  );

  const submit = async () => {
    setError(null);
    if (!pelanggan_id) {
      setError("Pilih pelanggan terlebih dahulu");
      return;
    }
    if (
      items.length === 0 ||
      items.some((item) => !item.supplier_produk_id || !item.qty)
    ) {
      setError("Pastikan ada produk yang dipilih dan kuantitas terisi");
      return;
    }

    if (status === "Belum Lunas" && !tanggal_jatuh_tempo) {
      setError("Tanggal jatuh tempo harus diisi jika status belum lunas");
      return;
    }

    setIsLoading(true);
    try {
      const penjualanData: Penjualan = {
        no_invoice: no_invoice,
        no_npb: no_npb,
        pelanggan_id: pelanggan_id,
        tanggal: editingPenjualan
          ? editingPenjualan.tanggal
          : new Date().toISOString().split('T')[0], // Format to YYYY-MM-DD
        items: items,
        total: subtotal,
        diskon: diskon,
        pajak: pajak,
        total_akhir: totalAkhir,
        status: status,
        metode_pembayaran: metode_pembayaran,
        metode_pengambilan: metode_pengambilan,
        pajak_enabled: pajak_enabled,
        catatan: editingPenjualan?.catatan, // Assuming catatan might exist or needs to be added
        // id, created_at, updated_at will be set by Supabase or backend
        id: editingPenjualan?.id || '', 
        created_at: editingPenjualan?.created_at || new Date().toISOString(),
        updated_at: editingPenjualan?.updated_at || new Date().toISOString(),
      };

      if (metode_pengambilan === "Diantar") {
        penjualanData.no_do = no_do;
      }

      // Only include bank details if payment method is Transfer
      if (metode_pembayaran === "Transfer") {
        penjualanData.nomor_rekening = nomor_rekening;
        penjualanData.nama_bank = nama_bank;
        penjualanData.nama_pemilik_rekening = nama_pemilik_rekening;
      }

      // Include tanggal_jatuh_tempo if status is Belum Lunas
      if (status === "Belum Lunas") {
        penjualanData.tanggal_jatuh_tempo = tanggal_jatuh_tempo;
      }

      if (editingPenjualan && editingPenjualan.id) {
        await updatePenjualan(editingPenjualan.id, penjualanData);
        alert("Penjualan berhasil diperbarui!");
      } else {
        await createPenjualan(penjualanData);
        alert("Penjualan berhasil disimpan!");
      }

      onSuccess();
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Gagal menyimpan penjualan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">
                Transaksi Penjualan Baru
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Isi detail transaksi penjualan kepada pelanggan
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ERROR ALERT */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* INFO SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Invoice */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-600" />
                Nomor Invoice
              </Label>
              <Input
                value={no_invoice}
                readOnly
                className="bg-gray-50 font-mono font-semibold"
              />
            </div>
            {/* NPB */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-600" />
                Nomor Pengambilan Barang (NPB)
              </Label>
              <Input
                value={no_npb}
                readOnly
                className="bg-gray-50 font-mono font-semibold"
              />
            </div>
            {/* Delivery Order */}
            {metode_pengambilan === "Diantar" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-gray-600" />
                  Nomor Delivery Order (DO)
                </Label>
                <Input
                  value={no_do}
                  readOnly
                  className="bg-gray-50 font-mono font-semibold"
                />
              </div>
            )}

            {/* Pelanggan */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
                Pelanggan
              </Label>
              <Select
                onValueChange={(val) => {
                  const p = pelangganList.find((x) => x.id === val);
                  if (p && p.id) {
                    setPelangganId(p.id as string);
                    setNamaPelanggan(p.nama_pelanggan as string);
                    setNamaToko(p.nama_toko as string);
                    setAlamatPelanggan(p.alamat as string);
                  }
                }}
                value={pelanggan_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  {pelangganList
                    .filter(
                      (p): p is Pelanggan & { id: string } =>
                        p.id !== undefined,
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nama_pelanggan || ""} - {p.nama_toko || ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Pembayaran */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gray-600" />
                Status Pembayaran
              </Label>
              <Select onValueChange={(v: any) => setStatus(v)} value={status}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lunas">Lunas</SelectItem>
                  <SelectItem value="Belum Lunas">Belum Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Metode Pengambilan */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-600" />
                Metode Pengambilan
              </Label>
              <Select
                onValueChange={(v: any) => setMetodePengambilan(v)}
                value={metode_pengambilan}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ambil Langsung">Ambil Langsung</SelectItem>
                  <SelectItem value="Diantar">Diantar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal Jatuh Tempo - hanya muncul jika Belum Lunas */}
            {status === "Belum Lunas" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Tanggal Jatuh Tempo
                </Label>
                <Input
                  type="date"
                  value={tanggal_jatuh_tempo}
                  onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                  placeholder="Pilih tanggal jatuh tempo"
                />
              </div>
            )}

            {/* Metode Pembayaran */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-600" />
                Metode Pembayaran
              </Label>
              <Select
                onValueChange={(v: any) => {
                  setMetodePembayaran(v);
                  if (v === "Tunai") {
                    setNomorRekening("");
                  }
                }}
                value={metode_pembayaran}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tunai">Tunai</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Details - hanya muncul jika Transfer */}
            {metode_pembayaran === "Transfer" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">
                    Nama Bank
                  </Label>
                  <Input
                    value={nama_bank}
                    onChange={(e) => setNamaBank(e.target.value)}
                    placeholder="Masukkan nama bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">
                    Nama Pemilik Rekening
                  </Label>
                  <Input
                    value={nama_pemilik_rekening}
                    onChange={(e) => setNamaPemilikRekening(e.target.value)}
                    placeholder="Masukkan nama pemilik rekening"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">
                    Nomor Rekening
                  </Label>
                  <Input
                    value={nomor_rekening}
                    onChange={(e) => setNomorRekening(e.target.value)}
                    placeholder="Masukkan nomor rekening"
                  />
                </div>
              </>
            )}

            {/* Diskon */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Diskon (Rp)
              </Label>
              <Input
                type="number"
                min={0}
                value={diskon}
                onChange={(e) => setDiskon(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* Pajak Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Pajak PPN 11%
              </Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pajak-toggle"
                  checked={pajak_enabled}
                  onChange={(e) => setPajakEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <Label htmlFor="pajak-toggle" className="text-sm text-gray-700">
                  {pajak_enabled ? "Aktif" : "Nonaktif"}
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* ITEMS SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-600" />
                <Label className="text-base font-semibold text-foreground">
                  Daftar Produk
                </Label>
              </div>
              <Button onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Produk
              </Button>
            </div>

            {items.length > 0 ? (
              <div className="space-y-3">
                {/* Table Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-3 bg-gray-50 rounded-lg font-medium text-sm text-foreground">
                  <div className="col-span-4">Produk</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2">Satuan</div>
                  <div className="col-span-2">Harga</div>
                  <div className="col-span-2">Subtotal</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Table Body */}
                {items.map((item, i) => {
                  const selectedProduk = produkList.find(
                    (p) => p.id === item.supplier_produk_id,
                  );
                  return (
                    <Card
                      key={i}
                      className="p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        {/* Produk */}
                        <div className="md:col-span-4 space-y-1">
                          <Label className="md:hidden text-xs text-gray-600">
                            Produk
                          </Label>
                          <ComboboxProduk
                            produkList={produkList}
                            value={item.supplier_produk_id}
                            onChange={(val) =>
                              updateItem(i, "supplier_produk_id", val)
                            }
                          />
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-1 space-y-1">
                          <Label className="md:hidden text-xs text-gray-600">
                            Qty
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={selectedProduk?.stok}
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(i, "qty", Number(e.target.value))
                            }
                            disabled={!item.supplier_produk_id}
                            className="w-full"
                          />
                        </div>

                        {/* Satuan */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="md:hidden text-xs text-gray-600">
                            Satuan
                          </Label>
                          <div className="font-medium text-foreground px-3 py-2 bg-gray-50 rounded-md">
                            {item.satuan || "-"}
                          </div>
                        </div>

                        {/* Harga */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="md:hidden text-xs text-gray-600">
                            Harga Satuan
                          </Label>
                          <div className="font-medium text-foreground px-3 py-2 bg-gray-50 rounded-md">
                            {formatRupiah(item.harga || 0)}
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="md:hidden text-xs text-gray-600">
                            Subtotal
                          </Label>
                          <div className="font-semibold text-green-600 px-3 py-2 bg-green-50 rounded-md">
                            {formatRupiah(item.subtotal)}
                          </div>
                        </div>

                        {/* Delete */}
                        <div className="md:col-span-1 flex md:justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(i)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">
                  Belum ada produk ditambahkan
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Klik tombol "Tambah Produk" untuk memulai
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* TOTAL SECTION */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Subtotal:</div>
              <div className="text-right">{formatRupiah(subtotal)}</div>
              <div>Diskon:</div>
              <div className="text-right text-red-600">
                -{formatRupiah(diskon)}
              </div>
              {pajak_enabled && (
                <>
                  <div>PPN 11%:</div>
                  <div className="text-right">{formatRupiah(pajak)}</div>
                </>
              )}
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">
                Total Akhir
              </span>
              <span className="text-3xl font-bold text-green-600">
                {formatRupiah(totalAkhir)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={isLoading || !pelanggan_id || items.length === 0}
            className="min-w-[150px]"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Memproses...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Proses
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
