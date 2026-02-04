"use client";

import { useEffect, useState, useCallback } from "react";
import { Penjualan } from "@/app/types/penjualan";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import PiutangTable from "../../../../../components/Piutang/PiutangTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStatus } from "@/components/ui/StatusProvider";

export default function PiutangPage() {
  const [piutang, setPiutang] = useState<Penjualan[]>([]);
  const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null); // No longer needed
  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // To determine if there are more pages

  const { showStatus } = useStatus();

  const fetchPiutang = useCallback(async () => {
    setLoading(true);
    // setError(null); // No longer needed

    const from = page * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
      .from("penjualan")
      .select(
        `
        *,
        pelanggan (
          id,
          nama_pelanggan,
          alamat
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
        { count: "exact" },
      )
      .eq("status", "Belum Lunas")
      .order("tanggal", { ascending: false })
      .range(from, to);

    if (error) {
      showStatus({
        message: "Gagal memuat data piutang: " + error.message,
        success: false,
      });
      console.error("Error fetching piutang:", error);
      setPiutang([]);
    } else {
      const mappedData: Penjualan[] = data.map((item: any) => ({
        ...item,
        nama_pelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
        riwayatPembayaran: item.riwayat_pembayaran || [],
        items:
          item.penjualan_detail?.map((detail: any) => ({
            ...detail,
            namaProduk:
              detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
            satuan: detail.supplier_produk?.produk?.satuan || "",
          })) || [],
      }));
      setPiutang(mappedData);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, perPage, showStatus]);

  useEffect(() => {
    fetchPiutang();

    const channel = supabase
      .channel("piutang-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penjualan",
        },
        (payload) => {
          if (
            payload.new?.status === "Belum Lunas" ||
            payload.old?.status === "Belum Lunas"
          ) {
            fetchPiutang();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPiutang]);

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
