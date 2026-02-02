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
import { useState, useEffect } from "react";
import { addPiutangPayment } from "@/app/services/penjualan.service";
import { formatRupiah } from "@/helper/format";

interface DialogBayarPiutangProps {
  isOpen: boolean;
  onClose: () => void;
  piutang: Penjualan;
  onSuccess: () => void;
}

export default function DialogBayarPiutang({
  isOpen,
  onClose,
  piutang,
  onSuccess,
}: DialogBayarPiutangProps) {
  const [tanggalBayar, setTanggalBayar] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [jumlahBayar, setJumlahBayar] = useState(0);
  const [jumlahBayarInput, setJumlahBayarInput] = useState("");
  const [metodePembayaran, setMetodePembayaran] = useState("Transfer");
  const [atasNama, setAtasNama] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalDibayar = piutang.total_dibayar || 0;
  const sisaUtang = (piutang.total_akhir || piutang.total) - totalDibayar;

  useEffect(() => {
    // Reset state when dialog opens or piutang changes
    setJumlahBayar(sisaUtang);
    setJumlahBayarInput(formatRupiah(sisaUtang));
    setTanggalBayar(new Date().toISOString().split("T")[0]);
    setAtasNama(piutang.namaPelanggan || "");
    setError(null);
  }, [isOpen, piutang, sisaUtang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (jumlahBayar <= 0) {
      setError("Jumlah bayar harus lebih dari nol.");
      setIsSubmitting(false);
      return;
    }
    if (jumlahBayar > sisaUtang) {
      setError(
        `Jumlah bayar tidak boleh melebihi sisa utang (${formatRupiah(
          sisaUtang,
        )}).`,
      );
      setIsSubmitting(false);
      return;
    }
    if (!piutang.id) {
      setError("ID Penjualan tidak ditemukan.");
      setIsSubmitting(false);
      return;
    }

    try {
      await addPiutangPayment(piutang.id, {
        tanggal: tanggalBayar,
        jumlah: jumlahBayar,
        metode_pembayaran: metodePembayaran,
        atas_nama: atasNama,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan pembayaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pembayaran Piutang ({piutang.no_invoice})</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Informasi Transaksi */}
          <div className="space-y-4">
            <div>
              <Label>Nama Pelanggan</Label>
              <Input value={piutang.namaPelanggan || ""} disabled />
            </div>
            <div>
              <Label>Sisa Utang</Label>
              <Input value={formatRupiah(sisaUtang)} disabled />
            </div>
          </div>

          {/* Daftar Produk */}
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
                          {item.namaProduk || "Produk Tidak Ditemukan"}
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

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tanggalBayar">Tanggal Bayar</Label>
                <Input
                  id="tanggalBayar"
                  type="date"
                  value={tanggalBayar}
                  onChange={(e) => setTanggalBayar(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="jumlahBayar">Jumlah Bayar (Rp)</Label>
                <Input
                  id="jumlahBayar"
                  type="text"
                  value={jumlahBayarInput}
                  onChange={(e) => {
                    const input = e.target.value;
                    const numeric = input.replace(/[^0-9]/g, "");
                    const numericValue = Number(numeric);
                    setJumlahBayar(numericValue);
                    setJumlahBayarInput(formatRupiah(numericValue));
                  }}
                  placeholder={`Maksimal: ${formatRupiah(sisaUtang)}`}
                  required
                />
              </div>
              <div>
                <Label htmlFor="metodePembayaran">Metode Pembayaran</Label>
                <select
                  id="metodePembayaran"
                  value={metodePembayaran}
                  onChange={(e) => setMetodePembayaran(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="Transfer">Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Debit">Debit</option>
                  <option value="Kredit">Kredit</option>
                </select>
              </div>
              <div>
                <Label htmlFor="atasNama">Atas Nama</Label>
                <Input
                  id="atasNama"
                  type="text"
                  value={atasNama}
                  onChange={(e) => setAtasNama(e.target.value)}
                  placeholder="Masukkan nama pembayar"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
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