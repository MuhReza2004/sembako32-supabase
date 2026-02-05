"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { createPembelian } from "@/app/services/pembelian.service";
import { PembelianFormData } from "@/app/types/pembelian";
import { Produk } from "@/app/types/produk";
import { Supplier, SupplierProduk } from "@/app/types/supplier";
import { formatRupiah } from "@/helper/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

import { DialogKonfirmasiPembelian } from "./DialogKonfirmasiPembelian";
import { useStatus } from "@/components/ui/StatusProvider";

type SupplierOption = Pick<Supplier, "id" | "nama">;
type ProdukOption = Pick<Produk, "id" | "nama">;
type SupplierProdukOption = Pick<
  SupplierProduk,
  "id" | "supplier_id" | "produk_id" | "harga_beli" | "harga_jual" | "stok"
>;

interface PembelianFormProps {
  suppliers: SupplierOption[];
  products: ProdukOption[];
  supplierProduks: SupplierProdukOption[];
}


export default function PembelianForm({
  suppliers,
  products,
  supplierProduks,
}: PembelianFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<PembelianFormData>({
    defaultValues: {
      tanggal: new Date().toISOString().split("T")[0],
      status: "Pending",
      metode_pembayaran: "Tunai",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchSupplierId = useWatch({ control, name: "supplier_id" });
  const watchItems = useWatch({ control, name: "items" }) || [];
  const watchMetode = useWatch({ control, name: "metode_pembayaran" });

  const total = watchItems.reduce(
    (sum, i) => sum + Number(i.subtotal || 0),
    0,
  );

  const router = useRouter();
  const { showStatus } = useStatus();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pembelianToConfirm, setPembelianToConfirm] =
    useState<PembelianFormData | null>(null);

  const onSubmit = (data: PembelianFormData) => {
    const totalAmount = watchItems.reduce(
      (sum, i) => sum + Number(i.subtotal || 0),
      0,
    );
    setPembelianToConfirm({
      ...data,
      total: totalAmount,
    });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pembelianToConfirm) return;

    try {
      const payload = {
        ...pembelianToConfirm,
        items: pembelianToConfirm.items || [],
      };
      await createPembelian(payload);
      showStatus({
        message: "Pembelian berhasil ditambahkan!",
        success: true,
        refresh: true, // Refresh the page to show the new data in the table
      });
      setIsConfirmDialogOpen(false);
      router.push("/dashboard/admin/transaksi/pembelian");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(error);
      showStatus({
        message: "Gagal menyimpan pembelian: " + errorMessage,
        success: false,
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold mb-3">
            Informasi Supplier & Dokumen
          </h3>
          <Separator />

          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="supplier_id" className="text-sm font-medium">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="supplier_id"
                control={control}
                rules={{ required: "Supplier wajib dipilih" }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger id="supplier_id">
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
                )}
              />
              {errors.supplier_id && (
                <p className="text-sm text-red-500">
                  {errors.supplier_id.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tanggal" className="text-sm font-medium">
                  Tanggal <span className="text-destructive">*</span>
                </Label>
                <Input id="tanggal" type="date" {...register("tanggal")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_npb" className="text-sm font-medium">
                  No. Penerimaan Barang (NPB)
                </Label>
                <Input id="no_npb" placeholder="NPB" {...register("no_npb")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_do" className="text-sm font-medium">
                  No. Delivery Order (DO)
                </Label>
                <Input id="no_do" placeholder="DO" {...register("no_do")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice" className="text-sm font-medium">
                  Invoice / Faktur
                </Label>
                <Input
                  id="invoice"
                  placeholder="Invoice"
                  {...register("invoice")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="metode_pembayaran" className="text-sm font-medium">
                  Metode Pembayaran <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="metode_pembayaran"
                  control={control}
                  rules={{ required: "Metode pembayaran wajib dipilih" }}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => {
                        if (value === "Tunai") {
                          setValue("nama_bank", "");
                          setValue("nama_pemilik_rekening", "");
                          setValue("nomor_rekening", "");
                          clearErrors([
                            "nama_bank",
                            "nama_pemilik_rekening",
                            "nomor_rekening",
                          ]);
                        }
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                    >
                      <SelectTrigger id="metode_pembayaran">
                        <SelectValue placeholder="Pilih Metode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tunai">Tunai</SelectItem>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.metode_pembayaran && (
                  <p className="text-sm text-red-500">
                    {errors.metode_pembayaran.message}
                  </p>
                )}
              </div>

              {watchMetode === "Transfer" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nama_bank" className="text-sm font-medium">
                      Nama Bank <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nama_bank"
                      placeholder="Nama Bank"
                      {...register("nama_bank", {
                        required: "Nama bank wajib diisi",
                      })}
                    />
                    {errors.nama_bank && (
                      <p className="text-sm text-red-500">
                        {errors.nama_bank.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="nama_pemilik_rekening"
                      className="text-sm font-medium"
                    >
                      Nama Pemilik Rekening <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nama_pemilik_rekening"
                      placeholder="Nama Pemilik Rekening"
                      {...register("nama_pemilik_rekening", {
                        required: "Nama pemilik rekening wajib diisi",
                      })}
                    />
                    {errors.nama_pemilik_rekening && (
                      <p className="text-sm text-red-500">
                        {errors.nama_pemilik_rekening.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nomor_rekening" className="text-sm font-medium">
                      No. Rekening <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nomor_rekening"
                      placeholder="No. Rekening"
                      {...register("nomor_rekening", {
                        required: "No. rekening wajib diisi",
                      })}
                    />
                    {errors.nomor_rekening && (
                      <p className="text-sm text-red-500">
                        {errors.nomor_rekening.message}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Item Pembelian</h3>
              <p className="text-sm text-muted-foreground">
                Tambahkan produk yang dibeli
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.refresh()}
              >
                Refresh Harga
              </Button>
              <Button
                type="button"
                onClick={() =>
                  append({
                    supplier_produk_id: "",
                    qty: 1,
                    harga: 0,
                    subtotal: 0,
                  })
                }
                variant="outline"
                size="sm"
                disabled={!watchSupplierId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Item
              </Button>
            </div>
          </div>

          <Separator />

          {fields.map((item, index) => (
            <div
              key={item.id}
              className="border-2 rounded-lg p-3 bg-card hover:border-primary/50 transition-colors"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[2.5fr_0.8fr_1.2fr_1.2fr_60px] gap-3 items-center">
                <Controller
                  name={`items.${index}.supplier_produk_id`}
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => {
                        const sp = supplierProduks.find((x) => x.id === value);
                        if (sp) {
                          const harga = Number(sp.harga_beli || 0);
                          const qty = Number(watchItems[index].qty || 0);
                          setValue(`items.${index}.harga`, harga);
                          setValue(
                            `items.${index}.subtotal`,
                            harga * qty,
                          );
                        }
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Produk" />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierProduks
                          .filter((sp) => sp.supplier_id === watchSupplierId)
                          .map((sp) => {
                            const produk = products.find(
                              (p) => p.id === sp.produk_id,
                            );
                            return (
                              <SelectItem key={sp.id} value={sp.id}>
                                {produk?.nama}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  )}
                />

                <Input
                  type="number"
                  min={1}
                  step={1}
                  {...register(`items.${index}.qty`, {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const qty = Number(e.target.value || 0);
                      const harga = Number(watchItems[index].harga || 0);
                      setValue(`items.${index}.subtotal`, qty * harga);
                    },
                  })}
                  placeholder="Qty"
                />

                <Input
                  type="text"
                  value={formatRupiah(watchItems[index]?.harga || 0)}
                  readOnly
                  className="bg-muted/50 h-9"
                />

                <div className="font-semibold text-sm flex items-center h-9 px-3 bg-muted/30 rounded-md">
                  {formatRupiah(watchItems[index]?.subtotal || 0)}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t-2 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary/5 p-4 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Total Pembelian
              </p>
              <div className="text-3xl font-bold text-primary">
                {formatRupiah(total)}
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || fields.length === 0 || !watchSupplierId}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {isSubmitting ? (
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
      </form>

      <DialogKonfirmasiPembelian
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        pembelianData={pembelianToConfirm}
        supplier={
          suppliers.find((s) => s.id === pembelianToConfirm?.supplier_id) ||
          null
        }
        produkList={products}
        supplierProdukList={supplierProduks}
        onConfirm={handleConfirmSubmit}
        // isLoading={isSubmitting} // Removed
      />
    </>
  );
}
