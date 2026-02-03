"use client";

import { useEffect, useState, useCallback } from "react";
import { Penjualan, PenjualanDetail } from "@/app/types/penjualan";
import { supabase } from "@/app/lib/supabase";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import { formatRupiah } from "@/helper/format";
import { PenjualanReportHeader } from "@/components/laporan/PenjualanReportHeader";
import { PenjualanSummaryCards } from "@/components/laporan/PenjualanSummaryCards";
import { PenjualanFilter } from "@/components/laporan/PenjualanFilter";
import { PenjualanTable } from "@/components/laporan/PenjualanTable";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function PenjualanReportPage() {
  const [data, setData] = useState<Penjualan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogDetailOpen, setDialogDetailOpen] = useState(false);
  const [selectedPenjualan, setSelectedPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0); // Page index, starts from 0
  const [hasMore, setHasMore] = useState(true);

  const fetchPenjualan = useCallback(
    async (pageIndex: number, shouldAppend = false) => {
      setIsLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("penjualan")
          .select(
            `
          *,
          pelanggan:pelanggan_id(*),
          items:penjualan_detail(*, supplier_produk:supplier_produk_id(*, produk:produk_id(*)))
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

        const { data: penjualanData, error: penjualanError } = await query;

        if (penjualanError) {
          throw penjualanError;
        }

        const formattedData = penjualanData.map((item) => ({
          ...item,
          nama_pelanggan: item.pelanggan?.nama_pelanggan,
          alamat_pelanggan: item.pelanggan?.alamat,
          items: item.items.map((detail: PenjualanDetail) => ({
            ...detail,
            nama_produk:
              (detail.supplier_produk as any)?.produk?.nama ||
              "Produk tidak ditemukan",
            hargaJual: detail.harga,
            qty: detail.qty,
          })),
        })) as Penjualan[];

        setData((prevData) =>
          shouldAppend ? [...prevData, ...formattedData] : formattedData,
        );
        setHasMore(penjualanData.length === PAGE_SIZE);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        console.error("Error fetching sales:", err);
        setError("Gagal memuat data penjualan: " + errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    setPage(0); // Reset page when filters change
    fetchPenjualan(0, false);
  }, [startDate, endDate, fetchPenjualan]);

  const fetchNext = () => {
    if (hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPenjualan(nextPage, false);
    }
  };

  const fetchPrev = () => {
    if (page > 0) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchPenjualan(prevPage, false);
    }
  };

  const handleViewDetails = (penjualan: Penjualan) => {
    setSelectedPenjualan(penjualan);
    setDialogDetailOpen(true);
  };

  const exportToPDF = async () => {
    const newTab = window.open("", "_blank");
    if (!newTab) {
      alert("Gagal membuka tab baru. Mohon izinkan pop-up untuk situs ini.");
      return;
    }
    newTab.document.write("Menghasilkan laporan PDF, mohon tunggu...");

    try {
      const response = await fetch("/api/generate-sales-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

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

  const totalSales = data.length;
  const activeSales = data.filter((sale) => sale.status !== "Batal");
  const totalRevenue = activeSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalPajak = activeSales.reduce(
    (sum, sale) => sum + (sale.pajak || 0),
    0,
  );
  const penjualanBersih = totalRevenue - totalPajak;
  const paidSales = data.filter((sale) => sale.status === "Lunas").length;
  const unpaidSales = data.filter(
    (sale) => sale.status === "Belum Lunas",
  ).length;
  const canceledSales = data.filter((sale) => sale.status === "Batal").length;

  if (isLoading && page === 0 && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Memuat data laporan penjualan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PenjualanReportHeader
        onExportPDF={exportToPDF}
        onExportExcel={() => alert("Export to excel is not implemented yet")}
      />

      <PenjualanSummaryCards
        totalSales={totalSales}
        totalRevenue={totalRevenue}
        totalPajak={totalPajak}
        penjualanBersih={penjualanBersih}
        paidSales={paidSales}
        unpaidSales={unpaidSales}
        canceledSales={canceledSales}
      />

      <PenjualanFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      <PenjualanTable
        data={data}
        onViewDetails={handleViewDetails}
        onExportExcel={() => alert("Export to excel is not implemented yet")}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPrev}
          disabled={page === 0 || isLoading}
        >
          Sebelumnya
        </Button>
        <span className="text-sm">Halaman {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchNext}
          disabled={!hasMore || isLoading}
        >
          Berikutnya
        </Button>
      </div>

      <DialogDetailPenjualan
        open={dialogDetailOpen}
        onOpenChange={setDialogDetailOpen}
        penjualan={selectedPenjualan}
      />
    </div>
  );
}
