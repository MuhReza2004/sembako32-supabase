"use client";

import { Pembelian } from "@/app/types/pembelian";
import { formatRupiah } from "@/helper/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Calendar,
  FileText,
  Truck,
  TrendingUp,
  Eye,
  Edit,
} from "lucide-react";
import { useState } from "react";
import DialogDetailPembelian from "./DialogDetailPembelian";
import DialogEditPembelian from "./DialogEditPembelian";

export function PembelianTabel({
  data,
  isLoading,
}: {
  data: Pembelian[];
  isLoading: boolean;
}) {
  const [selectedPembelian, setSelectedPembelian] = useState<Pembelian | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const grandTotal = data.reduce((sum, p) => sum + p.total, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Memuat data pembelian...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100">
              <TableHead className="font-semibold text-gray-700">
                Supplier
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Tanggal
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                No Dokumen
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Invoice
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                Total
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                Status
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-gray-500"
                >
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Belum ada data pembelian</p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((p, idx) => (
                <TableRow
                  key={p.id}
                  className={`hover:bg-blue-50/50 transition-colors ${
                    p.status === "Pending"
                      ? "bg-yellow-50"
                      : p.status === "Decline"
                        ? "bg-red-100"
                        : idx % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50/50"
                  }`}
                >
                  <TableCell className="font-medium text-gray-900">
                    {p.nama_supplier || "Unknown Supplier"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {new Date(p.tanggal).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{p.no_npb || "-"} </li>
                      <li>{p.no_do || "-"}</li>
                    </ul>
                  </TableCell>
                  <TableCell>
                    {p.invoice ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.invoice}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-bold text-blue-600 text-base">
                      {formatRupiah(p.total)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={`${
                        p.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : p.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPembelian(p);
                          setDetailOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={p.status !== "Pending"}
                        onClick={() => {
                          setSelectedPembelian(p);
                          setEditOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className=" bg-green-600">
                <TableCell
                  colSpan={4}
                  className="text-white font-bold text-base"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 " />
                    TOTAL KESELURUHAN
                  </div>
                </TableCell>
                <TableCell className="text-right text-white font-bold text-lg">
                  {formatRupiah(grandTotal || 0)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <DialogDetailPembelian
        open={detailOpen}
        onOpenChange={setDetailOpen}
        pembelian={selectedPembelian}
      />
      <DialogEditPembelian
        open={editOpen}
        onOpenChange={setEditOpen}
        pembelian={selectedPembelian}
        onSuccess={() => {}}
      />
    </div>
  );
}
