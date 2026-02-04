"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/helper/format";
import { AlertCircle, Plus, Trash2, Save } from "lucide-react";
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
import { useStatus } from "@/components/ui/StatusProvider";

type PenjualanFormData = Omit<Penjualan, "id" | "created_at" | "updated_at">;

interface PenjualanFormProps {
  products: Produk[];
  supplierProduks: any[];
  pelangganList: Pelanggan[];
  editingPenjualan?: Penjualan | null;
}

export function PenjualanForm({
  pelangganList,
  supplierProduks,
  products,
  editingPenjualan,
}: PenjualanFormProps) {
  const router = useRouter();
  const { showStatus } = useStatus();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PenjualanFormData>({
    defaultValues: editingPenjualan
      ? {
          ...editingPenjualan,
          items: editingPenjualan.items || [],
        }
      : {
          tanggal: new Date().toISOString().split("T")[0],
          status: "Lunas",
          items: [],
          metode_pengambilan: "Ambil Langsung",
          pajak_enabled: false,
          diskon: 0,
        },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // const [error, setError] = useState<string | null>(null); // No longer needed

  useEffect(() => {
    const generateNumbers = async () => {
      if (!editingPenjualan) {
        try {
          const [invoiceNum, npbNum, doNum] = await Promise.all([
            generateInvoiceNumber(),
            generateNPBNumber(),
            generateDONumber(),
          ]);
          setValue("no_invoice", invoiceNum);
          setValue("no_npb", npbNum);
          setValue("no_do", doNum);
        } catch (error: any) {
          console.error("Error generating document numbers:", error);
          showStatus({
            message:
              "Gagal membuat nomor dokumen otomatis: " + error.message,
            success: false,
          });
        }
      }
    };
    generateNumbers();
  }, [editingPenjualan, setValue, showStatus]);

  const watchItems = watch("items");
  const watchPajakEnabled = watch("pajak_enabled");
  const watchDiskon = watch("diskon");
  const watchStatus = watch("status");
  const watchMetodePembayaran = watch("metode_pembayaran");

  const { subTotal, totalPajak, total } = useMemo(() => {
    const subTotal = watchItems.reduce((sum, i) => sum + i.subtotal, 0);
    const totalSetelahDiskon = subTotal - (watchDiskon || 0);
    const totalPajak = watchPajakEnabled ? totalSetelahDiskon * 0.11 : 0;
    const total = totalSetelahDiskon + totalPajak;
    return { subTotal, totalPajak, total };
  }, [watchItems, watchDiskon, watchPajakEnabled]);

  const onSubmit = async (data: PenjualanFormData) => {
    // setError(null); // No longer needed

    console.log("Form submission started with data:", data);

    if (data.items.length === 0) {
      const msg = "Pastikan ada produk yang dipilih";
      showStatus({
        message: msg,
        success: false,
      });
      return;
    }

    if (data.status === "Belum Lunas" && !data.tanggal_jatuh_tempo) {
      const msg = "Tanggal Jatuh Tempo harus diisi jika status belum lunas.";
      showStatus({
        message: msg,
        success: false,
      });
      return;
    }

    try {
      const finalData = {
        ...data,
        total: subTotal,
        pajak: totalPajak,
        total_akhir: total,
      };

      console.log("Final data to submit:", finalData);

      if (editingPenjualan?.id) {
        await updatePenjualan(editingPenjualan.id, finalData);
        showStatus({
          message: "Penjualan berhasil diperbarui!",
          success: true,
          refresh: true,
        });
      } else {
        await createPenjualan(finalData);
        showStatus({
          message: "Penjualan berhasil disimpan!",
          success: true,
          refresh: true,
        });
      }
      router.push("/dashboard/admin/transaksi/penjualan");
    } catch (error: any) {
      console.error("Error during submit:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage =
        error?.message ||
        error?.error_description ||
        "Gagal menyimpan penjualan";
      showStatus({
        message: errorMessage,
        success: false,
      });
    }
  };

  useEffect(() => {
    if (watchMetodePembayaran === "Transfer") {
      setValue("nama_bank", "BRI");
      setValue("nama_pemilik_rekening", "RAHMAT SYUKUR");
      setValue("nomor_rekening", "7071 0101 9195 533");
    } else {
      // clear defaults when not Transfer to avoid stale values
      setValue("nama_bank", "");
      setValue("nama_pemilik_rekening", "");
      setValue("nomor_rekening", "");
    }
  }, [watchMetodePembayaran, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* {error && ( // No longer needed
        <Card className="border-red-300 bg-red-50 p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-800">Terjadi Kesalahan</h4>
          </div>
          <p className="text-sm text-red-700 mt-2 ml-8">{error}</p>
        </Card>
      )} */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Informasi Pelanggan & Pengiriman</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pelanggan_id">Pelanggan</Label>
                <Controller
                  name="pelanggan_id"
                  control={control}
                  rules={{ required: "Pelanggan wajib dipilih" }}
                  render={({ field }) => (
                    <ComboboxPelanggan
                      pelangganList={pelangganList}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <div>
                <Label htmlFor="metode_pengambilan">Metode Pengambilan</Label>
                <Controller
                  name="metode_pengambilan"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="metode_pengambilan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ambil Langsung">
                          Ambil Langsung
                        </SelectItem>
                        <SelectItem value="Diantar">Diantar</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Tambah Produk</CardTitle>
            </CardHeader>
            <CardContent>
              <AddItemForm
                supplierProduks={supplierProduks}
                onAddItem={(item) => append(item)}
                onStatusReport={showStatus} // Pass showStatus down
              />
            </CardContent>
          </Card>

          {fields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daftar Produk ({fields.length})</CardTitle>
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
                    {fields.map((item, index) => {
                      const produk = products.find(
                        (p) =>
                          p.id ===
                          supplierProduks.find(
                            (sp) => sp.id === item.supplier_produk_id,
                          )?.produk_id,
                      );
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{produk?.nama || "..."}</TableCell>
                          <TableCell>{item.qty}</TableCell>
                          <TableCell>{formatRupiah(item.harga)}</TableCell>
                          <TableCell>{formatRupiah(item.subtotal)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                <Controller
                  name="metode_pembayaran"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Metode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tunai">Tunai</SelectItem>
                        <SelectItem value="Transfer">Transfer Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {watchMetodePembayaran === "Transfer" && (
                <>
                  <div>
                    <Label htmlFor="nama_bank">Nama Bank</Label>
                    <Input id="nama_bank" {...register("nama_bank")} />
                  </div>
                  <div>
                    <Label htmlFor="nama_pemilik_rekening">
                      Nama Pemilik Rekening
                    </Label>
                    <Input
                      id="nama_pemilik_rekening"
                      {...register("nama_pemilik_rekening")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nomor_rekening">Nomor Rekening</Label>
                    <Input
                      id="nomor_rekening"
                      {...register("nomor_rekening")}
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Status Pembayaran</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lunas">Lunas</SelectItem>
                        <SelectItem value="Belum Lunas">Belum Lunas</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {watchStatus === "Belum Lunas" && (
                <div>
                  <Label>Tanggal Jatuh Tempo</Label>
                  <Input type="date" {...register("tanggal_jatuh_tempo")} />
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
                  <Controller
                    name="diskon"
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="number"
                        {...field}
                        className="w-28 h-8 text-right"
                      />
                    )}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <Label>Pajak 11%</Label>
                  <Controller
                    name="pajak_enabled"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {watchPajakEnabled && (
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
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 text-lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {editingPenjualan ? "Perbarui Transaksi" : "Simpan Transaksi"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AddItemForm({
  supplierProduks,
  onAddItem,
  onStatusReport,
}: {
  supplierProduks: any[];
  onAddItem: (item: PenjualanDetail) => void;
  onStatusReport: ReturnType<typeof useStatus>["showStatus"]; // Added prop
}) {
  const [supplierProdukId, setSupplierProdukId] = useState("");
  const [qty, setQty] = useState(1);
  // const [error, setError] = useState<string | null>(null); // No longer needed

  const handleAddItem = () => {
    // setError(null); // No longer needed
    if (!supplierProdukId || qty <= 0) {
      onStatusReport({
        message: "Pilih produk dan masukkan jumlah yang valid",
        success: false,
      });
      return;
    }
    const supplierProduk = supplierProduks.find(
      (sp) => sp.id === supplierProdukId,
    );
    if (!supplierProduk) {
      onStatusReport({
        message: "Produk tidak ditemukan",
        success: false,
      });
      return;
    }
    if (qty > supplierProduk.stok) {
      onStatusReport({
        message: `Stok ${
          supplierProduk.produk?.nama || "Produk"
        } tidak mencukupi (sisa: ${supplierProduk.stok})`,
        success: false,
      });
      return;
    }
    onAddItem({
      id: "",
      penjualan_id: "",
      supplier_produk_id: supplierProdukId,
      qty,
      harga: supplierProduk.harga_jual,
      subtotal: supplierProduk.harga_jual * qty,
      created_at: new Date().toISOString(),
    });
    setSupplierProdukId("");
    setQty(1);
  };

  return (
    <div className="space-y-4">
      {/* {error && <p className="text-sm text-red-500">{error}</p>} */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <Label>Pilih Produk</Label>
          <ComboboxSupplierProduk
            supplierProdukList={supplierProduks}
            value={supplierProdukId}
            onChange={setSupplierProdukId}
          />
        </div>
        <div>
          <Label>Jumlah</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            placeholder="1"
          />
        </div>
      </div>
      <Button type="button" onClick={handleAddItem} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Tambah Produk ke Daftar
      </Button>
    </div>
  );
}

