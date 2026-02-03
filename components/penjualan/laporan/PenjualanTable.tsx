"use client";

import { Penjualan } from "@/app/types/penjualan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/helper/format";
import { Download, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PenjualanTableProps {
  data: Penjualan[];
  onViewDetails: (penjualan: Penjualan) => void;
  onExportExcel: () => void;
}

export function PenjualanTable({
  data,
  onViewDetails,
  onExportExcel,
}: PenjualanTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between ">
        <CardTitle>Detail Penjualan</CardTitle>
        <Button onClick={onExportExcel} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada data penjualan untuk periode yang dipilih.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto print:overflow-visible">
            <Table className="text-xs print:text-sm print:border-collapse">
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead style={{ minWidth: "120px" }}>Invoice</TableHead>
                  <TableHead style={{ minWidth: "120px" }}>No. NPB</TableHead>
                  <TableHead style={{ minWidth: "120px" }}>No. DO</TableHead>
                  <TableHead style={{ minWidth: "130px" }}>
                    Metode Pengambilan
                  </TableHead>
                  <TableHead style={{ minWidth: "100px" }}>Tanggal</TableHead>
                  <TableHead style={{ minWidth: "180px" }}>
                    Pelanggan
                  </TableHead>
                  <TableHead style={{ minWidth: "250px" }}>
                    Produk Dibeli
                  </TableHead>
                  <TableHead
                    className="text-right"
                    style={{ minWidth: "100px" }}
                  >
                    Total
                  </TableHead>
                  <TableHead
                    className="text-center"
                    style={{ minWidth: "100px" }}
                  >
                    Status
                  </TableHead>
                  <TableHead
                    className="text-center"
                    style={{ minWidth: "60px" }}
                  >
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((penjualan) => (
                  <TableRow key={penjualan.id}>
                    <TableCell className="font-medium">
                      {penjualan.no_invoice}
                    </TableCell>
                    <TableCell className="font-medium">
                      {penjualan.no_npb}
                    </TableCell>
                    <TableCell className="font-medium">
                      {penjualan.no_do || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {penjualan.metode_pengambilan}
                    </TableCell>
                    <TableCell>
                      {new Date(penjualan.tanggal).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {penjualan.namaPelanggan || "Pelanggan Tidak Diketahui"}
                      </p>
                      {penjualan.alamatPelanggan && (
                        <p className="text-[10px] text-gray-500">
                          {penjualan.alamatPelanggan}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {penjualan.items && penjualan.items.length > 0 ? (
                        <ul className="list-disc pl-4 text-[9px]">
                          {penjualan.items.map((item) => (
                            <li key={item.id}>
                              {item.namaProduk} ({item.qty} x{" "}
                              {formatRupiah(item.hargaJual || 0)})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[9px] text-gray-500">
                          Tidak ada item
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(penjualan.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          penjualan.status === "Lunas"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : penjualan.status === "Batal"
                              ? "bg-gray-600 text-white hover:bg-gray-700"
                              : "bg-red-600 text-white hover:bg-red-700"
                        }
                      >
                        {penjualan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(penjualan)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
