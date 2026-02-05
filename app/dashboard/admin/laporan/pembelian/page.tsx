"use client";

import { useEffect, useState, useCallback } from "react";
import { Pembelian, PembelianDetail } from "@/app/types/pembelian";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/helper/format";
import { Calendar, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 10;

type PembelianDetailRow = PembelianDetail & {
  supplier_produk?: {
    produk?: { nama?: string; satuan?: string };
  };
};

type PembelianRow = Pembelian & {
  supplier?: { nama?: string } | null;
  items?: PembelianDetailRow[];
};

export default function PembelianReportPage() {
  const [data, setData] = useState<Pembelian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchPembelian = useCallback(
    async (pageIndex: number) => {
      setIsLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("pembelian")
          .select(
            `
                *,
                supplier:supplier_id(*),
                items:pembelian_detail(*, supplier_produk:supplier_produk_id(*, produk:produk_id(*)))
            `,
          )
          .order("tanggal", { ascending: false });

        if (startDate) {
          query = query.gte("tanggal", startDate);
        }
        if (endDate) {
          query = query.lte("tanggal", endDate);
        }

        const from = pageIndex * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        const { data: pembelianData, error: pembelianError } = await query;

        if (pembelianError) {
          throw pembelianError;
        }

        const formattedData = (pembelianData as PembelianRow[]).map((item) => ({
          ...item,
          metode_pembayaran: item.metode_pembayaran || "Tunai",
          nama_bank: item.nama_bank || undefined,
          nama_pemilik_rekening: item.nama_pemilik_rekening || undefined,
          nomor_rekening: item.nomor_rekening || undefined,
          namaSupplier: item.supplier?.nama,
          items: (item.items || []).map((detail: PembelianDetailRow) => ({
            ...detail,
            namaProduk:
              detail.supplier_produk?.produk?.nama ||
              "Produk tidak ditemukan",
            satuan: detail.supplier_produk?.produk?.satuan || "",
            harga: detail.harga,
            qty: detail.qty,
          })),
        })) as Pembelian[];

        setData(formattedData);
        setHasMore(pembelianData.length === PAGE_SIZE);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        console.error("Error fetching purchases:", err);
        setError("Gagal memuat data pembelian: " + errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    setPage(0);
    fetchPembelian(0);
  }, [startDate, endDate, fetchPembelian]);

  const fetchNext = () => {
    if (hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPembelian(nextPage);
    }
  };

  const fetchPrev = () => {
    if (page > 0) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchPembelian(prevPage);
    }
  };

  const exportToPDF = async () => {
    const newTab = window.open("", "_blank");
    if (!newTab) {
      alert("Gagal membuka tab baru. Mohon izinkan pop-up untuk situs ini.");
      return;
    }
    newTab.document.write("Menghasilkan laporan PDF, mohon tunggu...");

    try {
      const response = await fetch("/api/generate-purchase-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      newTab.location.href = url;
    } catch (error) {
      console.error("Error exporting PDF:", error);
      if (newTab) {
        newTab.document.body.innerHTML = `<pre>Gagal membuat PDF. Silakan periksa konsol untuk detailnya.</pre>`;
      }
      alert("Gagal mengekspor laporan PDF. Silakan coba lagi.");
    }
  };

  const totalPurchases = data.length;
  const totalCost = data.reduce((sum, purchase) => sum + purchase.total, 0);
  const paidPurchases = data.filter(
    (purchase) => purchase.status === "Completed",
  ).length;
  const unpaidPurchases = data.filter(
    (purchase) =>
      purchase.status === "Pending" || purchase.status === "Decline",
  ).length;

  if (isLoading && page === 0 && data.length === 0) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Laporan Pembelian</h1>
        <div className="flex gap-2">
          <Button onClick={exportToPDF} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pembelian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPurchases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Biaya</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pembelian Lunas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {paidPurchases}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pembelian Belum Lunas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {unpaidPurchases}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Filter Periode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Pembelian</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Tidak ada data pembelian untuk periode yang dipilih.
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>No. Dokumen</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Produk Dibeli</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((purchase, index) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{page * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell>
                        {new Date(purchase.tanggal).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {purchase.invoice || "-"}
                      </TableCell>
                      <TableCell>
                        <ul className="list-disc list-inside space-y-1">
                          <li>{purchase.no_do || "-"}</li>
                          <li>{purchase.no_npb || "-"}</li>
                        </ul>
                      </TableCell>
                      <TableCell>{purchase.namaSupplier}</TableCell>
                      <TableCell>
                        {purchase.items && purchase.items.length > 0 ? (
                          <ul className="list-disc pl-4 text-xs">
                            {purchase.items.map((item) => (
                              <li key={item.id}>
                                {item.namaProduk} ({item.qty} {item.satuan} x{" "}
                                {formatRupiah(item.harga)})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Tidak ada item
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(purchase.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            purchase.status === "Completed"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {purchase.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || isLoading}>
          Sebelumnya
        </Button>
        <span className="text-sm">Halaman {page + 1}</span>
        <Button onClick={fetchNext} disabled={!hasMore || isLoading}>
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
