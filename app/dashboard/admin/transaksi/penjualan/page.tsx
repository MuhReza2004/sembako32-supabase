"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Penjualan } from "@/app/types/penjualan";
import PenjualanTabel from "@/components/penjualan/PenjualanTabel";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePenjualanStatus as serviceUpdatePenjualanStatus, cancelPenjualan as serviceCancelPenjualan } from "@/app/services/penjualan.service";


export default function PenjualanPage() {
  const router = useRouter();
  const [data, setData] = useState<Penjualan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogDetailOpen, setDialogDetailOpen] = useState(false);
  const [selectedPenjualan, setSelectedPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [cancelingTransaction, setCancelingTransaction] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // To determine if there are more pages


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("penjualan")
      .select(
        `
        *,
        pelanggan (
          id,
          nama_pelanggan,
          alamat
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
      .order("tanggal", { ascending: false });

    if (startDate && endDate) {
      queryBuilder = queryBuilder
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);
    }

    if (searchTerm) {
      queryBuilder = queryBuilder.or(
        `no_invoice.ilike.%${searchTerm}%,pelanggan.nama_pelanggan.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      console.error("Error fetching sales:", error);
      setError("Gagal memuat data penjualan.");
      setData([]);
    } else {
      const mappedData: Penjualan[] = data.map((item: any) => ({
        ...item,
        namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
        alamatPelanggan: item.pelanggan?.alamat || "",
        items:
          item.penjualan_detail?.map((detail: any) => ({
            ...detail,
            namaProduk:
              detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
            satuan: detail.supplier_produk?.produk?.satuan || "",
          })) || [],
      }));
      setData(mappedData);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, startDate, endDate, searchTerm]);


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
        (payload) => {
          fetchData(); // Re-fetch the current page on any change
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);


  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };


  const handleViewDetails = (penjualan: Penjualan) => {
    setSelectedPenjualan(penjualan);
    setDialogDetailOpen(true);
  };


  const handleUpdateStatus = async (
    id: string,
    status: "Lunas" | "Belum Lunas",
  ) => {
    setUpdatingStatus(id);
    try {
      await serviceUpdatePenjualanStatus(id, status);
      alert(`Status penjualan berhasil diubah menjadi ${status}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Gagal mengubah status penjualan.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (
      confirm(
        "Apakah Anda yakin ingin membatalkan transaksi ini? Status akan diubah menjadi 'Batal' dan stok produk akan dikembalikan.",
      )
    ) {
      setCancelingTransaction(id);
      try {
        await serviceCancelPenjualan(id);
        alert(
          "Transaksi berhasil dibatalkan. Status diubah menjadi 'Batal' dan stok telah dikembalikan.",
        );
      } catch (error) {
        console.error("Error canceling transaction:", error);
        alert("Gagal membatalkan transaksi.");
      } finally {
        setCancelingTransaction(null);
      }
    }
  };
  
  const handleEdit = (penjualan: Penjualan) => {
    router.push(
      `/dashboard/admin/transaksi/penjualan/tambah?id=${penjualan.id}`,
    );
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

      <div className="flex items-center gap-4">
        <div className="w-1/3">
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
      </div>

      <PenjualanTabel
        data={data} // Use raw data from fetchData, filtering moved to Supabase query
        isLoading={isLoading}
        error={error}
        onViewDetails={handleViewDetails}
        onUpdateStatus={handleUpdateStatus}
        onEdit={handleEdit}
        onCancel={handleCancel}
        updatingStatus={updatingStatus}
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
