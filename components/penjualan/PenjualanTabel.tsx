"use client";

import { Penjualan } from "@/app/types/penjualan";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatTanggal } from "@/helper/format";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PenjualanTabelProps {
  data: Penjualan[];
  isLoading: boolean;
  // error: string | null; // No longer needed
  onViewDetails: (penjualan: Penjualan) => void;
  onCancel: (id: string) => void;
  cancelingTransaction?: string | null;
}

export default function PenjualanTabel({
  data = [],
  isLoading,
  // error, // No longer needed
  onViewDetails,
  onCancel,
  cancelingTransaction,
}: PenjualanTabelProps) {
  type PenjualanWithPelanggan = Penjualan & {
    pelanggan?: { nama_pelanggan?: string };
  };
  if (isLoading) {
    return <p>Loading...</p>;
  }

  // if (error) { // No longer needed
  //   return <p className="text-red-500">{error}</p>;
  // }

  if (data.length === 0) {
    return <p>Tidak ada data penjualan.</p>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Invoice</TableHead>
            <TableHead>No. Dokumen</TableHead>
            <TableHead>Metode Pengambilan</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Pelanggan</TableHead>
            <TableHead className="text-center">Total</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data
            .filter((p): p is Penjualan & { id: string } => !!p.id)
            .map((penjualan) => (
              <TableRow key={penjualan.id}>
                <TableCell className="font-medium">
                  {penjualan.no_invoice}
                </TableCell>
                <TableCell>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{penjualan.no_npb}</li>
                    <li>{penjualan.no_do || "-"}</li>
                  </ul>
                </TableCell>
                <TableCell>{penjualan.metode_pengambilan}</TableCell>
                <TableCell>{formatTanggal(penjualan.tanggal)}</TableCell>
                <TableCell>
                  {penjualan.namaPelanggan ||
                    // fallback when payload includes nested pelanggan object
                    (penjualan as PenjualanWithPelanggan).pelanggan
                      ?.nama_pelanggan ||
                    "-"}
                </TableCell>
                <TableCell className="text-center">
                  {formatRupiah(penjualan.total_akhir ?? penjualan.total)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={
                      penjualan.status === "Lunas"
                        ? "primary"
                        : penjualan.status === "Batal"
                          ? "remove"
                          : "secondary"
                    }
                  >
                    {penjualan.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onViewDetails(penjualan)}
                      >
                        Lihat Detail
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onCancel(penjualan.id)}
                        disabled={cancelingTransaction === penjualan.id}
                      >
                        {cancelingTransaction === penjualan.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Membatalkan...
                          </>
                        ) : (
                          "Batal"
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
