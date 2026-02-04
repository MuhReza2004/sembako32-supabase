import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Penjualan } from "@/app/types/penjualan";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { addPiutangPayment } from "@/app/services/penjualan.service";
import { formatRupiah } from "@/helper/format";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";

interface DialogBayarPiutangProps {
  isOpen: boolean;
  onClose: () => void;
  piutang: Penjualan;
  // onSuccess: () => void; // Replaced with onStatusReport
  onStatusReport: ReturnType<typeof useStatus>["showStatus"];
}

type FormData = {
  tanggal: string;
  jumlah: number;
  metode_pembayaran: string;
  atas_nama: string;
};

export default function DialogBayarPiutang({
  isOpen,
  onClose,
  piutang,
  onStatusReport,
}: DialogBayarPiutangProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const confirm = useConfirm();
  const [bayarLunas, setBayarLunas] = useState(false);

  const totalDibayar = piutang.total_dibayar || 0;
  const totalDibayarResolved =
    (piutang as any).totalDibayar || piutang.total_dibayar || 0;
  const sisaUtang = (piutang.total_akhir || piutang.total) - totalDibayarResolved;

  useEffect(() => {
    if (isOpen) {
      reset({
        tanggal: new Date().toISOString().split("T")[0],
        jumlah: 0,
        metode_pembayaran: "Transfer",
        atas_nama:
          (piutang as any).namaPelanggan || piutang.nama_pelanggan || "",
      });
      setBayarLunas(false);
    }
  }, [isOpen, piutang, sisaUtang, reset]);

  const onSubmit = async (data: FormData) => {
    if (data.jumlah <= 0) {
      onStatusReport({
        message: "Jumlah bayar harus lebih dari nol.",
        success: false,
      });
      return;
    }
    if (data.jumlah > sisaUtang) {
      onStatusReport({
        message: `Jumlah bayar tidak boleh melebihi sisa utang (${formatRupiah(
          sisaUtang,
        )}).`,
        success: false,
      });
      return;
    }
    if (!piutang.id) {
      onStatusReport({
        message: "ID Penjualan tidak ditemukan.",
        success: false,
      });
      return;
    }

    const confirmed = await confirm({
      title: "Konfirmasi Pembayaran Piutang",
      message: `Anda akan membayar sejumlah ${formatRupiah(
        data.jumlah,
      )} untuk invoice ${
        piutang.no_invoice
      }. Lanjutkan?`,
      confirmText: "Bayar",
      cancelText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await addPiutangPayment(piutang.id, data);
      onStatusReport({
        message: "Pembayaran piutang berhasil!",
        success: true,
        refresh: true,
      });
      onClose();
    } catch (err: any) {
      onStatusReport({
        message: err.message || "Gagal menyimpan pembayaran.",
        success: false,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pembayaran Piutang ({piutang.no_invoice})</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Nama Pelanggan</Label>
              <Input
                value={(piutang as any).namaPelanggan || piutang.nama_pelanggan || ""}
                disabled
              />
            </div>
            <div>
              <Label>Sisa Utang</Label>
              <Input value={formatRupiah(sisaUtang)} disabled />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3">Daftar Produk</h3>
            {piutang.items && piutang.items.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="font-semibold text-gray-700">
                        Nama Produk
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 text-center">
                        Qty
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 text-right">
                        Harga
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {piutang.items.map((item, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {(
                            (item as any).namaProduk ||
                            (item as any).nama_produk ||
                            (item as any).produk?.nama ||
                            "Produk Tidak Ditemukan"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.qty} {item.satuan || ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(item.harga)}
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600 text-right">
                          {formatRupiah(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-gray-500 text-sm">Tidak ada data produk</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tanggal">Tanggal Bayar</Label>
                <Input
                  id="tanggal"
                  type="date"
                  {...register("tanggal", { required: true })}
                />
              </div>
              <div>
                <Label htmlFor="jumlah">Jumlah Bayar (Rp)</Label>
                <Controller
                  name="jumlah"
                  control={control}
                  rules={{ required: true, min: 1 }}
                  render={({ field }) => (
                    <Input
                      id="jumlah"
                      type="text"
                      value={formatRupiah(field.value)}
                      onChange={(e) => {
                        const input = e.target.value;
                        const numeric = input.replace(/[^0-9]/g, "");
                        field.onChange(Number(numeric));
                        if (bayarLunas) setBayarLunas(false);
                      }}
                      placeholder={`Maksimal: ${formatRupiah(sisaUtang)}`}
                    />
                  )}
                />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bayarLunas}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBayarLunas(checked);
                      setValue("jumlah", checked ? sisaUtang : 0);
                    }}
                  />
                  Bayar lunas (isi otomatis {formatRupiah(sisaUtang)})
                </label>
              </div>
              <div>
                <Label htmlFor="metode_pembayaran">Metode Pembayaran</Label>
                <select
                  id="metode_pembayaran"
                  {...register("metode_pembayaran", { required: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Transfer">Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Debit">Debit</option>
                  <option value="Kredit">Kredit</option>
                </select>
              </div>
              <div>
                <Label htmlFor="atas_nama">Atas Nama</Label>
                <Input
                  id="atas_nama"
                  type="text"
                  {...register("atas_nama", { required: true })}
                  placeholder="Masukkan nama pembayar"
                />
              </div>
              {errors.jumlah && (
                <p className="text-red-500 text-sm">
                  {errors.jumlah.message}
                </p>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
