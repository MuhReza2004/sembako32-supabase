"use client";

import { useEffect, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Penjualan, PenjualanDetail } from "@/app/types/penjualan";
import { supabase } from "@/app/lib/supabase";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import { PenjualanReportHeader } from "@/components/laporan/PenjualanReportHeader";
import { PenjualanSummaryCards } from "@/components/laporan/PenjualanSummaryCards";
import { PenjualanFilter } from "@/components/laporan/PenjualanFilter";
import { PenjualanTable } from "@/components/laporan/PenjualanTable";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/app/lib/auth-client";

const PAGE_SIZE = 10;

type PenjualanDetailRow = PenjualanDetail & {
  supplier_produk?: {
    produk?: { nama?: string };
  };
};

type PenjualanRow = Penjualan & {
  pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
  items?: PenjualanDetailRow[];
};

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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Lunas" | "Belum Lunas" | "Batal"
  >("all");
  const [page, setPage] = useState(0); // Page index, starts from 0
  const [hasMore, setHasMore] = useState(true);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalPajak: 0,
    penjualanBersih: 0,
    paidSales: 0,
    unpaidSales: 0,
    canceledSales: 0,
  });

  const fetchPenjualan = useCallback(
    async (pageIndex: number, shouldAppend = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const term = debouncedSearchTerm.trim();

        // if term is provided, we look up matching pelanggan IDs first and then apply OR clause
        let pelangganIds: string[] = [];
        if (term) {
          const { data: pelangganData, error: pelangganError } = await supabase
            .from("pelanggan")
            .select("id")
            .ilike("nama_pelanggan", `%${term}%`);
          if (pelangganError) {
            console.error("Error fetching pelanggan IDs:", pelangganError);
          } else {
            pelangganIds = pelangganData?.map((p) => p.id) || [];
          }
        }

        const buildOrClause = () => {
          if (!term) return null;
          const orParts = [`no_invoice.ilike.%${term}%`];
          if (pelangganIds.length > 0) {
            const plainIds = pelangganIds.join(",");
            orParts.push(`pelanggan_id.in.(${plainIds})`);
          }
          return orParts.join(",");
        };

        const orClause = buildOrClause();

        const summaryQuery = () => {
          let q = supabase
            .from("penjualan")
            .select("total, total_akhir, pajak, status", { count: "exact" })
            .order("tanggal", { ascending: false });
          if (startDate) {
            q = q.gte("tanggal", startDate);
          }
          if (endDate) {
            q = q.lte("tanggal", endDate);
          }
          if (statusFilter !== "all") {
            q = q.eq("status", statusFilter);
          }
          if (orClause) {
            q = q.or(orClause);
          }
          return q;
        };

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
        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        if (orClause) {
          query = query.or(orClause);
        }

        const from = pageIndex * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        const [summaryRes, pageRes] = await Promise.all([
          summaryQuery(),
          query,
        ]);

        const { data: penjualanData, error: penjualanError } = pageRes;

        if (penjualanError) {
          throw penjualanError;
        }

        const formattedData = (penjualanData as PenjualanRow[]).map((item) => ({
          ...item,
          namaPelanggan: item.pelanggan?.nama_pelanggan,
          alamatPelanggan: item.pelanggan?.alamat,
          items: (item.items || []).map((detail: PenjualanDetailRow) => ({
            ...detail,
            namaProduk:
              detail.supplier_produk?.produk?.nama || "Produk tidak ditemukan",
            hargaJual: detail.harga,
            qty: detail.qty,
          })),
        })) as Penjualan[];

        setData((prevData) =>
          shouldAppend ? [...prevData, ...formattedData] : formattedData,
        );
        setHasMore(penjualanData.length === PAGE_SIZE);

        const summaryRows =
          (summaryRes.data as Pick<
            Penjualan,
            "total" | "total_akhir" | "pajak" | "status"
          >[]) || [];
        const activeSales = summaryRows.filter(
          (sale) => sale.status !== "Batal",
        );
        const totalRevenue = activeSales.reduce(
          (sum, sale) => sum + (sale.total_akhir ?? sale.total ?? 0),
          0,
        );
        const totalPajak = activeSales.reduce(
          (sum, sale) => sum + (sale.pajak || 0),
          0,
        );
        const paidSales = summaryRows.filter(
          (sale) => sale.status === "Lunas",
        ).length;
        const unpaidSales = summaryRows.filter(
          (sale) => sale.status === "Belum Lunas",
        ).length;
        const canceledSales = summaryRows.filter(
          (sale) => sale.status === "Batal",
        ).length;
        setSummary({
          totalSales: summaryRows.length,
          totalRevenue,
          totalPajak,
          penjualanBersih: totalRevenue - totalPajak,
          paidSales,
          unpaidSales,
          canceledSales,
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        console.error("Error fetching sales:", err);
        setError("Gagal memuat data penjualan: " + errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate, debouncedSearchTerm, statusFilter],
  );

  useEffect(() => {
    setPage(0); // Reset page when filters change
    fetchPenjualan(0, false);
  }, [startDate, endDate, debouncedSearchTerm, statusFilter, fetchPenjualan]);

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
      const token = await getAccessToken();
      const response = await fetch("/api/generate-sales-report", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const {
    totalSales,
    totalRevenue,
    totalPajak,
    penjualanBersih,
    paidSales,
    unpaidSales,
    canceledSales,
  } = summary;

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
      <PenjualanReportHeader onExportPDF={exportToPDF} />

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
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[240px]">
          <label className="text-sm text-muted-foreground">Cari</label>
          <input
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Cari invoice / pelanggan"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="min-w-[200px]">
          <label className="text-sm text-muted-foreground">Status</label>
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "Lunas" | "Belum Lunas" | "Batal",
              )
            }
          >
            <option value="all">Semua</option>
            <option value="Lunas">Lunas</option>
            <option value="Belum Lunas">Belum Lunas</option>
            <option value="Batal">Batal</option>
          </select>
        </div>
      </div>

      <PenjualanTable data={data} onViewDetails={handleViewDetails} />

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
