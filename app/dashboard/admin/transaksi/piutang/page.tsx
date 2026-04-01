"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Penjualan,
  PenjualanDetail,
  RiwayatPembayaran,
} from "@/app/types/penjualan";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import PiutangTable from "../../../../../components/Piutang/PiutangTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStatus } from "@/components/ui/StatusProvider";
import { useBatchedRefresh } from "@/hooks/useBatchedRefresh";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PiutangPage() {
  const [piutang, setPiutang] = useState<Penjualan[]>([]);
  const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null); // No longer needed
  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const perPage = 10;
  const [totalCount, setTotalCount] = useState(0); // To determine if there are more pages
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Belum Lunas" | "Lunas"
  >("Belum Lunas");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { showStatus } = useStatus();

  type PenjualanDetailRow = PenjualanDetail & {
    supplier_produk?: { produk?: { nama?: string; satuan?: string } };
  };

  type PenjualanRow = Penjualan & {
    pelanggan?: {
      nama_pelanggan?: string;
      alamat?: string;
      nama_toko?: string;
      no_telp?: string;
    } | null;
    riwayat_pembayaran?: RiwayatPembayaran[];
    penjualan_detail?: PenjualanDetailRow[];
  };

  const fetchPiutang = useCallback(async () => {
    setLoading(true);
    // setError(null); // No longer needed

    const from = page * perPage;
    const to = from + perPage - 1;
    const term = debouncedSearch.trim();

    let query = supabase
      .from("penjualan")
      .select(
        `
        *,
        pelanggan (
          id,
          nama_pelanggan,
          alamat,
          nama_toko,
          no_telp
        ),
        riwayat_pembayaran (
          id,
          penjualan_id,
          tanggal,
          jumlah,
          metode_pembayaran,
          atas_nama,
          created_at
        ),
        penjualan_detail (
          *,
          supplier_produk (
            produk (
              nama,
              satuan
            )
          )
        )
      `,
        { count: "planned" },
      )
      .order("tanggal", { ascending: false });

    if (statusFilter === "all") {
      query = query.range(from, to);
    }

    // NOTE: status will be derived from pembayaran below, so we don't filter at DB level.

    if (term) {
      const orParts: string[] = [`no_invoice.ilike.%${term}%`];
      const { data: pelangganRows } = await supabase
        .from("pelanggan")
        .select("id")
        .ilike("nama_pelanggan", `%${term}%`);
      const pelangganIds =
        (pelangganRows || [])
          .map((row) => row?.id as string | undefined)
          .filter((id): id is string => !!id) || [];
      if (pelangganIds.length > 0) {
        orParts.push(`pelanggan_id.in.(${pelangganIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }
    if (startDate) {
      query = query.gte("tanggal", startDate);
    }
    if (endDate) {
      query = query.lte("tanggal", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      showStatus({
        message: "Gagal memuat data piutang: " + error.message,
        success: false,
      });
      console.error("Error fetching piutang:", error);
      setPiutang([]);
      } else {
        const mappedData: Penjualan[] = (data as PenjualanRow[]).map((item) => {
          const totalAkhir = item.total_akhir ?? item.total ?? 0;
          const totalDibayar = item.total_dibayar ?? 0;
          const derivedStatus = totalAkhir - totalDibayar <= 0 ? "Lunas" : "Belum Lunas";
          return {
          ...item,
          status: derivedStatus,
          namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
          alamatPelanggan: item.pelanggan?.alamat || "",
          nama_toko: item.pelanggan?.nama_toko || "",
          no_telp: item.pelanggan?.no_telp || "",
          riwayatPembayaran: item.riwayat_pembayaran || [],
          items:
            item.penjualan_detail?.map((detail) => ({
              ...detail,
              namaProduk:
                detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
              satuan: detail.supplier_produk?.produk?.satuan || "",
            })) || [],
          };
        });
        const filteredData =
          statusFilter === "all"
            ? mappedData
            : mappedData.filter((item) => item.status === statusFilter);
        setPiutang(filteredData);
        setTotalCount(
          statusFilter === "all" ? count || 0 : filteredData.length,
        );
    }
    setLoading(false);
  }, [
    page,
    perPage,
    showStatus,
    debouncedSearch,
    statusFilter,
    startDate,
    endDate,
  ]);

  const { schedule: scheduleRefresh } = useBatchedRefresh(fetchPiutang);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPiutang();
    }, 0);

    const channel = supabase
      .channel("piutang-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penjualan",
        },
        (payload: { new?: { status?: string }; old?: { status?: string } }) => {
          const statuses = [payload.new?.status, payload.old?.status];
          if (statusFilter === "all") {
            scheduleRefresh();
            return;
          }
          if (statuses.includes(statusFilter)) {
            scheduleRefresh();
          }
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchPiutang, scheduleRefresh, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, startDate, endDate]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  // const refreshPiutang = () => { // No longer needed, refresh will be handled by useStatus
  //   fetchPiutang();
  // };

  const hasNextPage = (page + 1) * perPage < totalCount;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Daftar Piutang</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Piutang Usaha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="min-w-[220px]">
              <Label htmlFor="search">Cari (Invoice / Pelanggan)</Label>
              <Input
                id="search"
                placeholder="Ketik untuk mencari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="min-w-[200px]">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as "all" | "Belum Lunas" | "Lunas")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belum Lunas">Belum Lunas</SelectItem>
                  <SelectItem value="Lunas">Lunas</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="min-w-[200px]">
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {loading && <p>Memuat data...</p>}
          {/* {error && <p className="text-red-500">{error}</p>} // No longer needed */}
          {!loading && (
            <PiutangTable
              piutang={piutang}
              // onPaymentSuccess={refreshPiutang} // No longer needed
              onStatusReport={showStatus}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || loading}>
          Previous
        </Button>
        <Button onClick={fetchNext} disabled={!hasNextPage || loading}>
          Next
        </Button>
      </div>
    </div>
  );
}
