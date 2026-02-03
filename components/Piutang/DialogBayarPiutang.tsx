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
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { addPiutangPayment } from "@/app/services/penjualan.service";
import { formatRupiah } from "@/helper/format";

interface DialogBayarPiutangProps {
  isOpen: boolean;
  onClose: () => void;
  piutang: Penjualan;
  onSuccess: () => void;
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
  onSuccess,
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

  const totalDibayar = piutang.total_dibayar || 0;
  const sisaUtang = (piutang.total_akhir || piutang.total) - totalDibayar;

  useEffect(() => {
    if (isOpen) {
      reset({
        tanggal: new Date().toISOString().split("T")[0],
        jumlah: sisaUtang,
        metode_pembayaran: "Transfer",
        atas_nama: piutang.nama_pelanggan || "",
      });
    }
  }, [isOpen, piutang, sisaUtang, reset]);

  const onSubmit = async (data: FormData) => {
    if (data.jumlah <= 0) {
      alert("Jumlah bayar harus lebih dari nol.");
      return;
    }
    if (data.jumlah > sisaUtang) {
      alert(
        `Jumlah bayar tidak boleh melebihi sisa utang (${formatRupiah(
          sisaUtang,
        )}).`,
      );
      return;
    }
    if (!piutang.id) {
      alert("ID Penjualan tidak ditemukan.");
      return;
    }

    try {
      await addPiutangPayment(piutang.id, data);
      onSuccess();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan pembayaran.");
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
              <Input value={piutang.nama_pelanggan || ""} disabled />
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
                          {item.nama_produk || "Produk Tidak Ditemukan"}
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
                      }}
                      placeholder={`Maksimal: ${formatRupiah(sisaUtang)}`}
                    />
                  )}
                />
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