"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Penjualan } from "@/app/types/penjualan";
import PenjualanTabel from "@/components/penjualan/PenjualanTabel";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelPenjualan as serviceCancelPenjualan,
  getPenjualanById,
  getPenjualanPage,
} from "@/app/services/penjualan.service";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";
import { useDebounce } from "@/hooks/useDebounce";
import { useBatchedRefresh } from "@/hooks/useBatchedRefresh";

export default function PenjualanPage() {
  const router = useRouter();
  const [data, setData] = useState<Penjualan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null); // No longer needed
  const [dialogDetailOpen, setDialogDetailOpen] = useState(false);
  const [selectedPenjualan, setSelectedPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [cancelingTransaction, setCancelingTransaction] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Belum Lunas" | "Lunas" | "Batal"
  >("all");
  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // To determine if there are more pages
  const [statusCounts, setStatusCounts] = useState({
    lunas: 0,
    belumLunas: 0,
    batal: 0,
    total: 0,
  });

  const confirm = useConfirm();
  const { showStatus } = useStatus();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    // setError(null); // No longer needed

    try {
      const term = debouncedSearch.trim();

      let pelangganIds: string[] = [];
      if (term) {
        const { data: pelangganRows } = await supabase
          .from("pelanggan")
          .select("id")
          .ilike("nama_pelanggan", `%${term}%`);
        pelangganIds =
          (pelangganRows || [])
            .map((row) => row?.id as string | undefined)
            .filter((id): id is string => !!id) || [];
      }

      const buildCountQuery = (status: "Lunas" | "Belum Lunas" | "Batal") => {
        let q = supabase
          .from("penjualan")
          .select("id", { count: "exact", head: true })
          .eq("status", status);

        if (startDate) q = q.gte("tanggal", startDate);
        if (endDate) q = q.lte("tanggal", endDate);
        if (term) {
          const orParts: string[] = [
            `no_invoice.ilike.%${term}%`,
            `status.ilike.%${term}%`,
          ];
          if (pelangganIds.length > 0) {
            orParts.push(`pelanggan_id.in.(${pelangganIds.join(",")})`);
          }
          q = q.or(orParts.join(","));
        }
        return q;
      };

      const [lunasRes, belumRes, batalRes] = await Promise.all([
        buildCountQuery("Lunas"),
        buildCountQuery("Belum Lunas"),
        buildCountQuery("Batal"),
      ]);

      const lunas = lunasRes.count || 0;
      const belumLunas = belumRes.count || 0;
      const batal = batalRes.count || 0;
      setStatusCounts({
        lunas,
        belumLunas,
        batal,
        total: lunas + belumLunas + batal,
      });

      const result = await getPenjualanPage({
        page,
        perPage,
        searchTerm: debouncedSearch,
        startDate,
        endDate,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setData(result.data);
      setTotalCount(result.count);
    } catch (err: unknown) {
      console.error("Error fetching sales:", err);
      showStatus({
        message:
          "Gagal memuat data penjualan: " +
          (err instanceof Error ? err.message : "Unknown error"),
        success: false,
      });
      setData([]);
    }
    setIsLoading(false);
  }, [
    page,
    perPage,
    startDate,
    endDate,
    debouncedSearch,
    showStatus,
    statusFilter,
  ]);

  const { schedule: scheduleRefresh } = useBatchedRefresh(fetchData);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("penjualan-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penjualan",
        },
        () => {
          scheduleRefresh(); // Batch refresh on any change
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, scheduleRefresh]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, startDate, endDate, statusFilter]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const handleViewDetails = async (penjualan: Penjualan) => {
    try {
      const detail = await getPenjualanById(penjualan.id);
      if (!detail) {
        throw new Error("Detail penjualan tidak ditemukan.");
      }
      setSelectedPenjualan(detail);
      setDialogDetailOpen(true);
    } catch (error: unknown) {
      console.error("Error fetching penjualan detail:", error);
      showStatus({
        message:
          "Gagal memuat detail penjualan: " +
          (error instanceof Error ? error.message : "Unknown error"),
        success: false,
      });
    }
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: "Konfirmasi Pembatalan Transaksi",
      message:
        "Apakah Anda yakin ingin membatalkan transaksi ini? Status akan diubah menjadi 'Batal' dan stok produk akan dikembalikan.",
      confirmText: "Batalkan",
      cancelText: "Tidak",
    });

    if (!confirmed) {
      return;
    }

    setCancelingTransaction(id);
    try {
      await serviceCancelPenjualan(id);
      showStatus({
        message:
          "Transaksi berhasil dibatalkan. Status diubah menjadi 'Batal' dan stok telah dikembalikan.",
        success: true,
        refresh: true,
      });
    } catch (error: unknown) {
      console.error("Error canceling transaction:", error);
      showStatus({
        message:
          "Gagal membatalkan transaksi: " +
          (error instanceof Error ? error.message : "Unknown error"),
        success: false,
      });
    } finally {
      setCancelingTransaction(null);
    }
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Transaksi Penjualan
        </h1>
        <Button
          onClick={() =>
            router.push("/dashboard/admin/transaksi/penjualan/tambah")
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Buat Penjualan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-muted-foreground">Total Transaksi</div>
          <div className="text-2xl font-semibold">{statusCounts.total}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-muted-foreground">Lunas</div>
          <div className="text-2xl font-semibold text-green-700">
            {statusCounts.lunas}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-muted-foreground">Belum Lunas</div>
          <div className="text-2xl font-semibold text-yellow-700">
            {statusCounts.belumLunas}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-muted-foreground">Batal</div>
          <div className="text-2xl font-semibold text-red-700">
            {statusCounts.batal}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 ">
        <div className="w-1/3 mt-4">
          <Label htmlFor="search">Cari (Invoice / Pelanggan)</Label>
          <Input
            id="search"
            placeholder="Ketik untuk mencari..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-1/4">
          <Label htmlFor="startDate">Tanggal Mulai</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="w-1/4">
          <Label htmlFor="endDate">Tanggal Akhir</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="w-1/4">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "Belum Lunas" | "Lunas" | "Batal",
              )
            }
          >
            <option value="all">Semua</option>
            <option value="Belum Lunas">Belum Lunas</option>
            <option value="Lunas">Lunas</option>
            <option value="Batal">Batal</option>
          </select>
        </div>
      </div>

      <PenjualanTabel
        data={data} // Use raw data from fetchData, filtering moved to Supabase query
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        onCancel={handleCancel}
        cancelingTransaction={cancelingTransaction}
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
          disabled={!hasNextPage || isLoading}
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
