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
  X,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { getAllSuppliers } from "@/app/services/supplyer.service";
import { getAllProduk } from "@/app/services/produk.service";
import { getAllSupplierProduk } from "@/app/services/supplierProduk.service";
import { Supplier, SupplierProduk } from "@/app/types/suplyer";
import { Produk } from "@/app/types/produk";
import DialogDetailPembelian from "./DialogDetailPembelian";
import DialogEditPembelian from "./DialogEditPembelian";
import { getAllPembelian } from "@/app/services/pembelian.service";

export default function PembelianTable({
  data,
  searchTerm,
  startDate,
  endDate,
  refreshData,
}: {
  data: Pembelian[];
  searchTerm: string;
  startDate: string;
  endDate: string;
  refreshData: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [supplierProduks, setSupplierProduks] = useState<SupplierProduk[]>([]);
  const [selectedPembelian, setSelectedPembelian] = useState<Pembelian | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const sups = await getAllSuppliers();
      const prods = await getAllProduk();
      const supProds = await getAllSupplierProduk();
      setSuppliers(sups);
      setProducts(prods);
      setSupplierProduks(supProds);
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    let filtered = data;

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const supplierName =
          suppliers.find((s) => s.id === p.supplier_id)?.nama || "";
        return (
          p.invoice?.toLowerCase().includes(lowercasedTerm) ||
          p.noDO?.toLowerCase().includes(lowercasedTerm) ||
          supplierName.toLowerCase().includes(lowercasedTerm)
        );
      });
    }

    if (startDate) {
      filtered = filtered.filter(
        (p) => new Date(p.tanggal) >= new Date(startDate),
      );
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => new Date(p.tanggal) <= end);
    }

    return filtered;
  }, [data, searchTerm, startDate, endDate, suppliers]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  // Hitung total per bulan
  const totalPerBulan = useMemo(() => {
    const grouped = filteredData.reduce(
      (acc, p) => {
        const date = new Date(p.tanggal);
        const bulanTahun = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;
        const namaBulan = date.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });

        if (!acc[bulanTahun]) {
          acc[bulanTahun] = {
            nama: namaBulan,
            total: 0,
            jumlahTransaksi: 0,
          };
        }

        acc[bulanTahun].total += p.total;
        acc[bulanTahun].jumlahTransaksi += 1;

        return acc;
      },
      {} as Record<
        string,
        { nama: string; total: number; jumlahTransaksi: number }
      >,
    );

    return Object.values(grouped).sort((a, b) => b.nama.localeCompare(a.nama));
  }, [filteredData]);

  // Hitung grand total
  const grandTotal = useMemo(() => {
    return filteredData.reduce((sum, p) => sum + p.total, 0);
  }, [filteredData]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100">
              <TableHead className="font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Supplier
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Tanggal
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  No Dokumen
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Invoice
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Nama Produk
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">
                Qty
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">
                Harga
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">
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
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-12 text-gray-500"
                >
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Belum ada data pembelian</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((p, idx) => (
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
                    {suppliers.find((s) => s.id === p.supplier_id)?.nama ||
                      "Unknown Supplier"}
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
                  <TableCell>
                    {p.items && p.items.length > 1 ? (
                      <div className="space-y-1">
                        {p.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span className="text-gray-700">
                              {item.namaProduk || "Unknown Product"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-700">
                        {p.items?.[0]?.namaProduk || "Unknown Product"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.items && p.items.length > 1 ? (
                      <div className="space-y-1">
                        {p.items.map((item, index) => (
                          <div
                            key={index}
                            className="text-sm font-medium text-gray-700"
                          >
                            {item.qty}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-medium text-gray-700">
                        {p.items?.[0]?.qty}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.items && p.items.length > 1 ? (
                      <div className="space-y-1">
                        {p.items.map((item, index) => (
                          <div
                            key={index}
                            className="text-sm text-gray-600 font-mono"
                          >
                            {formatRupiah(item.harga)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-600 font-mono">
                        {formatRupiah(p.items?.[0]?.harga ?? 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
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
          {paginatedData.length > 0 && (
            <TableFooter>
              <TableRow className=" bg-green-600">
                <TableCell
                  colSpan={10}
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
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Sebelumnya
        </Button>
        <span className="text-sm">
          Halaman {currentPage} dari {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
        >
          Berikutnya
        </Button>
      </div>

      {/* Summary Card - Total Per Bulan */}
      {filteredData.length > 0 && totalPerBulan.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-white">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Ringkasan Modal Per Bulan
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {totalPerBulan.map((bulan, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">
                        {bulan.nama}
                      </p>
                      <p className="text-xs text-gray-400">
                        {bulan.jumlahTransaksi} transaksi
                      </p>
                    </div>
                    <div className="bg-emerald-100 rounded-full p-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatRupiah(bulan.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DialogDetailPembelian
        open={detailOpen}
        onOpenChange={setDetailOpen}
        pembelian={selectedPembelian}
      />
      <DialogEditPembelian
        open={editOpen}
        onOpenChange={setEditOpen}
        pembelian={selectedPembelian}
        onSuccess={refreshData}
      />
    </div>
  );
}
