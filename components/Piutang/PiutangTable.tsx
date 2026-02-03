import { Penjualan } from "@/app/types/penjualan";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import DialogBayarPiutang from "./DialogBayarPiutang";

import { Button } from "@/components/ui/button";
import { formatRupiah, formatTanggal } from "@/helper/format";
import DialogDetailPiutang from "./DialogDetailPiutang";
import { exportPiutangTableToPDF } from "@/helper/pdfExport";
import { FileText } from "lucide-react";

interface PiutangTableProps {
  piutang: Penjualan[];
  onPaymentSuccess: () => void;
}

export default function PiutangTable({
  piutang = [],
  onPaymentSuccess,
}: PiutangTableProps) {
  const [selectedPiutang, setSelectedPiutang] = useState<Penjualan | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPiutangDetail, setSelectedPiutangDetail] =
    useState<Penjualan | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const handleOpenDialog = (p: Penjualan) => {
    setSelectedPiutang(p);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setSelectedPiutang(null);
    setIsDialogOpen(false);
  };

  const handleOpenDetailDialog = (p: Penjualan) => {
    setSelectedPiutangDetail(p);
    setIsDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setSelectedPiutangDetail(null);
    setIsDetailDialogOpen(false);
  };

  const handlePaymentSuccess = () => {
    handleCloseDialog();
    onPaymentSuccess(); // Refresh data on the main page
  };

  const handleExportPDF = () => {
    exportPiutangTableToPDF(piutang);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Daftar Piutang</h2>
        <Button
          onClick={handleExportPDF}
          variant="outline"
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Export PDF
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Invoice</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Nama Pelanggan</TableHead>
            <TableHead>Total Tagihan</TableHead>
            <TableHead>Total Dibayar</TableHead>
            <TableHead>Sisa Utang</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(piutang || []).map((p) => {
            const totalDibayar = p.total_dibayar || 0;
            const sisaUtang = p.total_akhir - totalDibayar;
            return (
              <TableRow key={p.id}>
                <TableCell>{p.no_invoice}</TableCell>
                <TableCell>{formatTanggal(p.tanggal)}</TableCell>
                <TableCell>{p.nama_pelanggan}</TableCell>
                <TableCell>{formatRupiah(p.total_akhir)}</TableCell>
                <TableCell>{formatRupiah(totalDibayar)}</TableCell>
                <TableCell>{formatRupiah(sisaUtang)}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      p.status === "Lunas"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {p.status === "Belum Lunas" && (
                      <Button onClick={() => handleOpenDialog(p)}>Bayar</Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleOpenDetailDialog(p)}
                    >
                      Detail
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {selectedPiutang && (
        <DialogBayarPiutang
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          piutang={selectedPiutang}
          onSuccess={handlePaymentSuccess}
        />
      )}
      <DialogDetailPiutang
        isOpen={isDetailDialogOpen}
        onClose={handleCloseDetailDialog}
        piutang={selectedPiutangDetail}
      />
    </>
  );
}